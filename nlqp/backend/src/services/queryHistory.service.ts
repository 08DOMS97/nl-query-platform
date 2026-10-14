import { getFirestore } from './firebaseAdmin.service.js';
import type { DbEngine, HistoryEntry, SavedQuery } from '../types/index.js';

/**
 * Módulo 5: historial y consultas guardadas, en Firestore y aislados por usuario.
 *
 *   users/{uid}/history — automático: cada consulta que `/executeQuery` ejecuta.
 *   users/{uid}/saved   — manual: solo lo que el usuario guarda con un nombre.
 *
 * Son colecciones independientes: guardar copia la consulta, no apunta al
 * historial. Ninguna de las dos ejecuta SQL; reusar una consulta vuelve a pasar
 * por `/executeQuery` y, con eso, por el Query Safety Engine.
 */

const HISTORY_LIMIT = 50;

function userCollection(uid: string, name: 'history' | 'saved') {
  return getFirestore().collection('users').doc(uid).collection(name);
}

/**
 * Registra una ejecución en el historial. Igual que el registro de uso, un fallo
 * acá nunca debe romper la respuesta real al usuario: se loguea y se sigue.
 */
export async function recordHistoryEntry(
  uid: string,
  entry: Omit<HistoryEntry, 'id' | 'executedAt'>,
): Promise<void> {
  try {
    await userCollection(uid, 'history').add({ ...entry, executedAt: new Date() });
  } catch (err) {
    console.error('[queryHistory] no se pudo registrar la consulta en el historial:', err);
  }
}

/** Las últimas `HISTORY_LIMIT` ejecuciones del usuario, de la más reciente a la más vieja. */
export async function listHistory(uid: string): Promise<HistoryEntry[]> {
  const snapshot = await userCollection(uid, 'history')
    .orderBy('executedAt', 'desc')
    .limit(HISTORY_LIMIT)
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      question: data.question ?? null,
      // Entradas anteriores al 10/10: solo motor; el id de su conexión inicial es el motor.
      connectionId: data.connectionId ?? data.engine,
      connectionName: data.connectionName ?? data.engine,
      engine: data.engine as DbEngine,
      sql: data.sql,
      success: data.success,
      totalRows: data.totalRows ?? null,
      errorReason: data.errorReason ?? null,
      executedAt: data.executedAt.toDate().toISOString(),
    };
  });
}

export async function listSavedQueries(uid: string): Promise<SavedQuery[]> {
  const snapshot = await userCollection(uid, 'saved').orderBy('savedAt', 'desc').get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      question: data.question ?? null,
      connectionId: data.connectionId ?? data.engine,
      connectionName: data.connectionName ?? data.engine,
      engine: data.engine as DbEngine,
      sql: data.sql,
      savedAt: data.savedAt.toDate().toISOString(),
    };
  });
}

export async function saveQuery(
  uid: string,
  query: Omit<SavedQuery, 'id' | 'savedAt'>,
): Promise<SavedQuery> {
  const savedAt = new Date();
  const ref = await userCollection(uid, 'saved').add({ ...query, savedAt });
  return { id: ref.id, ...query, savedAt: savedAt.toISOString() };
}

/** Una consulta guardada del usuario, o `null` si no existe. */
export async function getSavedQuery(uid: string, id: string): Promise<SavedQuery | null> {
  const doc = await userCollection(uid, 'saved').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name,
    question: data.question ?? null,
    connectionId: data.connectionId ?? data.engine,
    connectionName: data.connectionName ?? data.engine,
    engine: data.engine as DbEngine,
    sql: data.sql,
    savedAt: data.savedAt.toDate().toISOString(),
  };
}

/** Reemplaza la sentencia de una consulta guardada (edición del rol técnico). */
export async function updateSavedQuerySql(uid: string, id: string, sql: string): Promise<SavedQuery | null> {
  const ref = userCollection(uid, 'saved').doc(id);
  if (!(await ref.get()).exists) return null;
  await ref.update({ sql, updatedAt: new Date() });
  return getSavedQuery(uid, id);
}

/** Devuelve `false` si la consulta no existe (para responder 404). */
export async function deleteSavedQuery(uid: string, id: string): Promise<boolean> {
  const ref = userCollection(uid, 'saved').doc(id);
  if (!(await ref.get()).exists) return false;
  await ref.delete();
  return true;
}
