import { createHash } from 'node:crypto';
import admin from 'firebase-admin';
import { getFirestore } from './firebaseAdmin.service.js';
import { getSavedQuery } from './queryHistory.service.js';
import type {
  DbEngine,
  SqlChange,
  SqlDiffSegment,
  SqlEdit,
  SqlEditAction,
  SqlEditInfo,
  SqlEditOrigin,
  UserRole,
} from '../types/index.js';

/**
 * Auditoría de las sentencias SQL editadas por el rol técnico.
 *
 * El técnico puede editar la sentencia recién generada y las consultas guardadas (no
 * las del historial: para editar una, primero la guarda). Cada edición que se ejecuta
 * o se guarda queda en `sqlEdits/{id}` con la sentencia original, la editada, las
 * partes reemplazadas, quién, cuándo y sobre qué conexión. El id es un hash del
 * usuario, la conexión y las dos sentencias: la misma edición ejecutada o guardada
 * varias veces es un solo registro, con sus acciones y la fecha de la última.
 *
 * Igual que el historial, un fallo acá no rompe la respuesta al usuario.
 */

const COLLECTION = 'sqlEdits';
const LIST_LIMIT = 100;
/** Sobre este tamaño (en tokens) la comparación fina sería cara: se informa como reemplazo total. */
const MAX_TOKENS = 3000;

/* --- Comparación por tokens --- */

// Espacios, identificadores (con punto), números, literales de texto, identificadores
// entre comillas o corchetes, y cualquier otro carácter suelto.
const TOKEN = /\s+|[A-Za-z_][\w$.]*|\d+(?:\.\d+)?|'(?:[^']|'')*'?|"[^"]*"?|\[[^\]]*\]?|[\s\S]/g;

function tokenize(sql: string): string[] {
  return sql.match(TOKEN) ?? [];
}

/** Segmentos iguales, quitados y agregados entre dos sentencias (LCS sobre tokens). */
export function diffSql(original: string, edited: string): SqlDiffSegment[] {
  const a = tokenize(original);
  const b = tokenize(edited);
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return [
      { type: 'removed', text: original },
      { type: 'added', text: edited },
    ];
  }
  // lcs[i][j] = largo de la subsecuencia común más larga de a[i..] y b[j..].
  const lcs: Uint16Array[] = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const segments: SqlDiffSegment[] = [];
  const push = (type: SqlDiffSegment['type'], text: string) => {
    const last = segments[segments.length - 1];
    if (last?.type === type) last.text += text;
    else segments.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('equal', a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('removed', a[i++]);
    else push('added', b[j++]);
  }
  while (i < a.length) push('removed', a[i++]);
  while (j < b.length) push('added', b[j++]);
  return segments;
}

/**
 * Cambios legibles: cada tramo distinto entre dos tramos iguales es un reemplazo
 * («X» por «Y»), una supresión o un agregado. Los cambios que son solo espacios o
 * saltos de línea no cuentan.
 */
export function summarizeChanges(segments: SqlDiffSegment[]): SqlChange[] {
  const changes: SqlChange[] = [];
  let removed = '';
  let added = '';
  const flush = () => {
    if (removed.trim() || added.trim()) changes.push({ removed: removed.trim(), added: added.trim() });
    removed = '';
    added = '';
  };
  for (const s of segments) {
    // Un espacio entre dos cambios no los separa: «SELECT a» → «SELECT b» es un solo reemplazo.
    if (s.type === 'equal' && (s.text.trim() || (!removed && !added))) flush();
    else if (s.type === 'removed') removed += s.text;
    else if (s.type === 'added') added += s.text;
    else {
      removed += s.text;
      added += s.text;
    }
  }
  flush();
  return changes;
}

/** `true` si las sentencias difieren en algo más que espacios. */
export function isEdited(original: string, edited: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
  return norm(original) !== norm(edited);
}

/* --- Validación de una edición --- */

export class SqlEditError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = 'SqlEditError';
  }
}

export interface ResolvedEdit {
  origin: SqlEditOrigin;
  originalSql: string;
  savedQueryId: string | null;
  savedQueryName: string | null;
}

/**
 * Interpreta el campo `edit` de una solicitud. Devuelve `null` si la sentencia no
 * cambió (no hay nada que auditar) y lanza `SqlEditError` si la edición no está
 * permitida: solo el rol técnico edita, y una consulta del historial se edita
 * guardándola primero. En una guardada, la sentencia original es la que está
 * guardada (no la que diga el cliente).
 */
export async function resolveEdit(
  uid: string,
  role: UserRole | undefined,
  info: unknown,
  sql: string,
): Promise<ResolvedEdit | null> {
  if (info === undefined || info === null) return null;
  const e = info as Partial<SqlEditInfo>;
  let resolved: ResolvedEdit;
  if (e.origin === 'historial') {
    if (typeof e.originalSql === 'string' && !isEdited(e.originalSql, sql)) return null;
    throw new SqlEditError(409, 'Una consulta del historial no se edita: guárdela primero y edítela desde Guardadas.');
  } else if (e.origin === 'generada') {
    if (typeof e.originalSql !== 'string' || !e.originalSql.trim()) {
      throw new SqlEditError(400, 'Falta "edit.originalSql" (la sentencia generada antes de editarla).');
    }
    resolved = { origin: 'generada', originalSql: e.originalSql, savedQueryId: null, savedQueryName: null };
  } else if (e.origin === 'guardada') {
    if (typeof e.savedQueryId !== 'string' || !e.savedQueryId) {
      throw new SqlEditError(400, 'Falta "edit.savedQueryId" (la consulta guardada que se editó).');
    }
    const saved = await getSavedQuery(uid, e.savedQueryId);
    if (!saved) throw new SqlEditError(404, 'La consulta guardada no existe.');
    resolved = { origin: 'guardada', originalSql: saved.sql, savedQueryId: saved.id, savedQueryName: saved.name };
  } else {
    throw new SqlEditError(400, 'Campo "edit.origin" inválido. Válidos: generada, guardada.');
  }
  if (!isEdited(resolved.originalSql, sql)) return null;
  if (role !== 'tecnico') throw new SqlEditError(403, 'Solo el rol técnico puede editar la sentencia.');
  return resolved;
}

/* --- Registro --- */

export interface SqlEditInput {
  uid: string;
  email: string | null;
  connectionId: string;
  connectionName: string;
  engine: DbEngine;
  origin: SqlEditOrigin;
  savedQueryId: string | null;
  savedQueryName: string | null;
  originalSql: string;
  editedSql: string;
  action: SqlEditAction;
}

export async function recordSqlEdit(input: SqlEditInput): Promise<void> {
  if (!isEdited(input.originalSql, input.editedSql)) return;
  try {
    const segments = diffSql(input.originalSql, input.editedSql);
    const id = createHash('sha256')
      .update([input.uid, input.connectionId, input.originalSql, input.editedSql].join('\u0000'))
      .digest('hex')
      .slice(0, 40);
    const ref = getFirestore().collection(COLLECTION).doc(id);
    const now = new Date();
    await getFirestore().runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (doc.exists) {
        tx.update(ref, { actions: admin.firestore.FieldValue.arrayUnion(input.action), lastAt: now });
        return;
      }
      tx.set(ref, {
        uid: input.uid,
        email: input.email,
        connectionId: input.connectionId,
        connectionName: input.connectionName,
        engine: input.engine,
        origin: input.origin,
        savedQueryId: input.savedQueryId,
        savedQueryName: input.savedQueryName,
        originalSql: input.originalSql,
        editedSql: input.editedSql,
        segments,
        changes: summarizeChanges(segments),
        actions: [input.action],
        createdAt: now,
        lastAt: now,
      });
    });
  } catch (err) {
    console.error('[sqlEditAudit] no se pudo registrar la edición:', err);
  }
}

/** Las últimas `LIST_LIMIT` ediciones de todos los usuarios, de la más reciente a la más vieja. */
export async function listSqlEdits(): Promise<SqlEdit[]> {
  const snapshot = await getFirestore().collection(COLLECTION).orderBy('createdAt', 'desc').limit(LIST_LIMIT).get();
  return snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      email: d.email ?? null,
      connectionId: d.connectionId,
      connectionName: d.connectionName,
      engine: d.engine,
      origin: d.origin,
      savedQueryId: d.savedQueryId ?? null,
      savedQueryName: d.savedQueryName ?? null,
      originalSql: d.originalSql,
      editedSql: d.editedSql,
      segments: d.segments,
      changes: d.changes,
      actions: d.actions,
      createdAt: d.createdAt.toDate().toISOString(),
      lastAt: d.lastAt.toDate().toISOString(),
    };
  });
}
