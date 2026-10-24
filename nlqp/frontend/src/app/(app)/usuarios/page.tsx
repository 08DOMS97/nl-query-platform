'use client';

import { Fragment, useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, apiRequest } from '@/lib/api';
import type { ManagedUser, UserRole } from '@/lib/types';
import { Badge, Button, EmptyState, FieldLabel, Notice, PageHeader, Panel, formatDateTime } from '@/components/ui';

const ROLE_LABELS: Record<UserRole, string> = { no_tecnico: 'Usuario', tecnico: 'Técnico' };
const ROLES: UserRole[] = ['no_tecnico', 'tecnico'];
const MIN_PASSWORD = 8;

const INPUT =
  'block h-8 w-full rounded border border-line-strong bg-canvas px-2.5 text-[13px] placeholder:text-ink-3 focus:border-accent-500 focus:outline-none';
const TH = 'border-b border-line px-4 py-2 text-left text-[12px] font-medium text-ink-3';
const TD = 'border-b border-line px-4 py-3';

function RoleSwitch({
  value,
  onChange,
  disabled,
  label,
}: {
  value: UserRole | null;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded border border-line-strong bg-canvas p-0.5">
      {ROLES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(r)}
            className={`h-6 rounded-sm px-2.5 text-[12.5px] transition-colors disabled:cursor-not-allowed ${
              active ? 'bg-accent-100 font-medium text-accent-800' : 'text-ink-2 hover:text-ink disabled:opacity-55'
            }`}
          >
            {ROLE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}

/** Alta de un usuario: correo, contraseña temporal y rol. */
function NewUserForm({ user, onSaved, onCancel }: { user: User; onSaved: (u: ManagedUser) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('no_tecnico');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= MIN_PASSWORD;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    try {
      const { ok, status, data } = await apiRequest<ManagedUser>('/users', user, {
        method: 'POST',
        body: { email: email.trim(), password, role },
      });
      if (!ok) throw new Error(data.error ?? `Error ${status} al crear el usuario.`);
      onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Nuevo usuario">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4">
          <div>
            <FieldLabel htmlFor="user-email">Correo</FieldLabel>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              autoComplete="off"
              className={INPUT}
              autoFocus
            />
          </div>
          <div>
            <FieldLabel htmlFor="user-password" hint={`Mínimo ${MIN_PASSWORD} caracteres`}>
              Contraseña temporal
            </FieldLabel>
            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={128}
              autoComplete="new-password"
              className={INPUT}
            />
          </div>
          <div className="col-span-2">
            <FieldLabel>Rol</FieldLabel>
            <RoleSwitch value={role} onChange={setRole} label="Rol del usuario nuevo" />
          </div>
        </div>
        {error && (
          <div className="px-4 pb-4">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 border-t border-line bg-surface px-4 py-2.5">
          <p className="text-[12px] text-ink-3">Entregue la contraseña temporal al usuario por un medio seguro.</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={!valid || busy}>
              {busy ? 'Creando…' : 'Crear usuario'}
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  );
}

/** Contraseña nueva para una cuenta, con confirmación. Se abre debajo de la fila. */
function PasswordForm({
  user,
  target,
  onSaved,
  onCancel,
}: {
  user: User;
  target: ManagedUser;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= MIN_PASSWORD && confirm === password;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    try {
      const { ok, status, data } = await apiRequest<ManagedUser>(`/users?uid=${encodeURIComponent(target.uid)}`, user, {
        method: 'PUT',
        body: { password },
      });
      if (!ok) throw new Error(data.error ?? `Error ${status} al cambiar la contraseña.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={`Cambiar la contraseña de ${target.email}`} className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <FieldLabel htmlFor={`pw-${target.uid}`} hint={`Mínimo ${MIN_PASSWORD} caracteres`}>
            Contraseña nueva
          </FieldLabel>
          <input
            id={`pw-${target.uid}`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={128}
            autoComplete="new-password"
            className={INPUT}
            autoFocus
          />
        </div>
        <div>
          <FieldLabel htmlFor={`pw2-${target.uid}`}>Repita la contraseña</FieldLabel>
          <input
            id={`pw2-${target.uid}`}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            maxLength={128}
            autoComplete="new-password"
            className={INPUT}
          />
          {mismatch && <p className="mt-1 text-[12px] text-warn">Las contraseñas no coinciden.</p>}
        </div>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] text-ink-3">
          Se cierran las sesiones de la cuenta en los demás dispositivos. Entregue la contraseña por un medio seguro.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!valid || busy}>
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Gestión de usuarios (solo superadministrador; el backend lo exige en `/users`):
 * alta con rol, cambio de rol, contraseña nueva y activar/desactivar. Las cuentas no se borran, se
 * desactivan, para conservar su historial. Los cambios rigen en la siguiente acción
 * del usuario, sin que tenga que volver a iniciar sesión.
 */
export default function UsuariosPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch<{ users: ManagedUser[] }>('/users', user)
      .then((data) => {
        if (!cancelled) setUsers(data.users);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [user, runCount]);

  if (!user) return null;

  const reload = () => setRunCount((n) => n + 1);

  async function update(target: ManagedUser, body: { role?: UserRole; disabled?: boolean }, message: string) {
    if (!user) return;
    setError(null);
    setNotice(null);
    setPending(target.uid);
    try {
      const updated = await apiFetch<ManagedUser>(`/users?uid=${encodeURIComponent(target.uid)}`, user, { method: 'PUT', body });
      // La fila se actualiza con la respuesta, junto con el aviso (sin esperar a recargar la lista).
      setUsers((current) => current?.map((u) => (u.uid === updated.uid ? updated : u)) ?? null);
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  const list = users ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Cuentas con acceso al sistema y su rol."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setNotice(null);
              setCreating(true);
            }}
            disabled={creating}
          >
            Nuevo usuario
          </Button>
        }
      />

      {error && <Notice tone="bad">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {creating && (
        <NewUserForm
          user={user}
          onSaved={(created) => {
            setCreating(false);
            setNotice(`Usuario ${created.email} creado.`);
            reload();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <Panel title="Cuentas" meta={users && `${list.filter((u) => !u.disabled).length} activas de ${list.length}`}>
        {users && list.length === 0 ? (
          <EmptyState title="No hay usuarios" />
        ) : (
          <table className="tabular w-full text-[13px]">
            <thead className="bg-surface">
              <tr>
                <th className={TH}>Usuario</th>
                <th className={TH}>Rol</th>
                <th className={TH}>Estado</th>
                <th className={TH}>Último acceso</th>
                <th className={TH}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const self = u.uid === user.uid;
                const busy = pending === u.uid;
                return (
                  <Fragment key={u.uid}>
                    <tr className="last:[&>td]:border-b-0">
                      <td className={TD}>
                        <p className="font-medium">{u.email}</p>
                        <p className="text-[12px] text-ink-3">
                          {u.superadmin ? 'Superadministrador' : `Creado el ${formatDateTime(u.createdAt)}`}
                          {self && ' · su cuenta'}
                        </p>
                      </td>
                      <td className={TD}>
                        <div className="space-y-1">
                          <RoleSwitch
                            value={u.role}
                            label={`Rol de ${u.email}`}
                            disabled={self || u.superadmin || u.disabled || busy}
                            onChange={(role) => update(u, { role }, `${u.email}: rol ${ROLE_LABELS[role].toLowerCase()}.`)}
                          />
                          {u.role === null && <p className="text-[12px] text-warn">Sin rol: no tiene acceso</p>}
                        </div>
                      </td>
                      <td className={TD}>{u.disabled ? <Badge tone="bad">Desactivado</Badge> : <Badge tone="ok">Activo</Badge>}</td>
                      <td className={`${TD} text-[12px] text-ink-2`}>{u.lastSignInAt ? formatDateTime(u.lastSignInAt) : 'Nunca'}</td>
                      <td className={`${TD} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || changingPassword === u.uid}
                            onClick={() => {
                              setNotice(null);
                              setChangingPassword(u.uid);
                            }}
                          >
                            Cambiar contraseña
                          </Button>
                          {!self && (
                            <Button
                              size="sm"
                              variant={u.disabled ? 'ghost' : 'danger'}
                              disabled={busy}
                              onClick={() => {
                                if (!u.disabled && !window.confirm(`¿Desactivar la cuenta ${u.email}? No podrá iniciar sesión hasta que se reactive.`)) return;
                                update(u, { disabled: !u.disabled }, `${u.email}: cuenta ${u.disabled ? 'reactivada' : 'desactivada'}.`);
                              }}
                            >
                              {u.disabled ? 'Reactivar' : 'Desactivar'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {changingPassword === u.uid && (
                      <tr>
                        <td colSpan={5} className={`${TD} bg-surface`}>
                          <PasswordForm
                            user={user}
                            target={u}
                            onSaved={() => {
                              setChangingPassword(null);
                              setNotice(`${u.email}: contraseña cambiada.`);
                            }}
                            onCancel={() => setChangingPassword(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
