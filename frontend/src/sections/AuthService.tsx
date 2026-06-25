import { useState, useEffect } from 'react';
import type { Session, ServerGroup } from '../types';
import { authFetch } from '../lib/api';

interface Props { session: Session; activeGroup: ServerGroup; }

interface AuthUser {
  id: string;
  email: string;
  roles?: string[];
  permissions?: Record<string, unknown>;
  is_email_verify?: boolean;
  last_login?: string;
}

function RolePills({ roles }: { roles?: string[] }) {
  if (!roles?.length) return <span className="muted">–</span>;
  return <>{roles.map(r => <span key={r} className="role-pill">{r}</span>)}</>;
}

function PermissionPills({ permissions }: { permissions?: Record<string, unknown> }) {
  const entries = Object.entries(permissions ?? {});
  if (!entries.length) return <span className="muted">–</span>;
  return <>{entries.map(([k, v]) => (
    <span key={k} className="perm-pill">{k}: {JSON.stringify(v)}</span>
  ))}</>;
}

function PermissionsPanel({ user, baseUrl, onClose, onChanged }: {
  user: AuthUser;
  baseUrl: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [keyInput, setKeyInput]     = useState('');
  const [valueInput, setValueInput] = useState('');
  const [saving, setSaving] = useState(false);

  const entries = Object.entries(user.permissions ?? {});

  // Parse the value as JSON so booleans/numbers/objects work; fall back to raw string.
  function parseValue(raw: string): unknown {
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async function post(path: string, body: object): Promise<boolean> {
    setSaving(true);
    try {
      const res = await authFetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { onChanged(); return true; }
      const d = await res.json() as { detail?: string };
      alert('Fehler: ' + (d.detail ?? 'Unbekannt'));
    } catch (e: unknown) { alert(String(e)); }
    finally { setSaving(false); }
    return false;
  }

  async function upsert() {
    const key = keyInput.trim();
    if (!key) return;
    const ok = await post('/admin/upsert_permission', { user_id: user.id, key, value: parseValue(valueInput) });
    if (ok) { setKeyInput(''); setValueInput(''); }
  }

  return (
    <div className="panel">
      <h3>Berechtigungen bearbeiten — {user.email}</h3>
      {entries.length === 0 ? (
        <p className="muted">Keine Berechtigungen gesetzt.</p>
      ) : (
        <ul className="perm-list">
          {entries.map(([k, v]) => (
            <li key={k}>
              <span className="perm-pill">{k}: {JSON.stringify(v)}</span>
              <button className="btn-ghost" disabled={saving}
                onClick={() => post('/admin/remove_permission', { user_id: user.id, key: k })}>
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
      <input type="text" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="Schlüssel, z.B. canEdit" />
      <input type="text" value={valueInput} onChange={e => setValueInput(e.target.value)} placeholder="Wert (JSON), z.B. true, 5, &quot;text&quot;" />
      <div className="panel-actions">
        <button className="btn" onClick={upsert} disabled={saving || !keyInput.trim()}>Hinzufügen / Aktualisieren</button>
        <button className="btn-ghost" onClick={onClose}>Abbrechen</button>
      </div>
    </div>
  );
}

function UsersTab({ activeGroup }: { activeGroup: ServerGroup }) {
  const [users, setUsers]   = useState<AuthUser[] | null>(null);
  const [error, setError]   = useState('');
  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [permUser, setPermUser] = useState<AuthUser | null>(null);
  const [rolesInput, setRolesInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setError('');
    try {
      const res = await authFetch(`${activeGroup.authServiceUrl}/admin/users`);
      if (!res.ok) { setError(`Fehler ${res.status}`); return; }
      const data = await res.json() as { users?: AuthUser[] } | AuthUser[];
      const list = Array.isArray(data) ? data : data.users ?? [];
      setUsers(list);
      // Keep an open permissions panel in sync with reloaded data.
      setPermUser(prev => prev ? list.find(u => u.id === prev.id) ?? null : null);
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  async function saveRoles() {
    if (!editUser) return;
    setSaving(true);
    const roles = rolesInput.split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
    try {
      const res = await authFetch(`${activeGroup.authServiceUrl}/admin/set_roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: editUser.id, roles }),
      });
      if (res.ok) { setEditUser(null); load(); }
      else { const d = await res.json() as { detail?: string }; alert('Fehler: ' + (d.detail ?? 'Unbekannt')); }
    } catch (e: unknown) { alert(String(e)); }
    setSaving(false);
  }

  async function importUsers(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await authFetch(`${activeGroup.authServiceUrl}/admin/users/import`, { method: 'POST', body: form });
      const d = await res.json() as { created?: number; updated?: number; skipped?: number };
      alert(`Import: ${d.created ?? 0} erstellt, ${d.updated ?? 0} aktualisiert, ${d.skipped ?? 0} übersprungen`);
      load();
    } catch (e: unknown) { alert(String(e)); }
    e.target.value = '';
  }

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={load}>Aktualisieren</button>
        <label className="btn btn-secondary">
          JSON importieren
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={importUsers} />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      {users === null ? (
        <p className="loading-text">Lade Benutzer…</p>
      ) : users.length === 0 ? (
        <p className="loading-text">Keine Benutzer gefunden.</p>
      ) : (
        <table>
          <thead>
            <tr><th>ID</th><th>E-Mail</th><th>Rollen</th><th>Berechtigungen</th><th>E-Mail bestätigt</th><th>Letzter Login</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><code>{u.id}</code></td>
                <td>{u.email}</td>
                <td><RolePills roles={u.roles} /></td>
                <td><PermissionPills permissions={u.permissions} /></td>
                <td><span className={`badge ${u.is_email_verify ? 'ok' : 'warn'}`}>{u.is_email_verify ? 'ja' : 'nein'}</span></td>
                <td>{u.last_login ? new Date(u.last_login).toLocaleString('de-DE') : '–'}</td>
                <td>
                  <button className="btn-ghost" onClick={() => { setEditUser(u); setRolesInput((u.roles ?? []).join(', ')); }}>
                    Rollen
                  </button>
                  <button className="btn-ghost" onClick={() => setPermUser(u)}>
                    Berechtigungen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editUser && (
        <div className="panel">
          <h3>Rollen bearbeiten — {editUser.email}</h3>
          <input
            type="text"
            value={rolesInput}
            onChange={e => setRolesInput(e.target.value)}
            placeholder="z.B. ADMIN, USER"
          />
          <div className="panel-actions">
            <button className="btn" onClick={saveRoles} disabled={saving}>Speichern</button>
            <button className="btn-ghost" onClick={() => setEditUser(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      {permUser && (
        <PermissionsPanel
          user={permUser}
          baseUrl={activeGroup.authServiceUrl}
          onClose={() => setPermUser(null)}
          onChanged={load}
        />
      )}
    </>
  );
}

function JwtTab({ activeGroup }: { activeGroup: ServerGroup }) {
  const [info, setInfo] = useState('–');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch(`${activeGroup.authServiceUrl}/admin/jwt/key-storage`);
      const d = await res.json();
      setInfo(JSON.stringify(d, null, 2));
    } catch (e: unknown) {
      setInfo('Fehler: ' + String(e));
    }
    setLoading(false);
  }

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={load} disabled={loading}>Schlüssel-Info laden</button>
      </div>
      <pre className="code-block">{info}</pre>
    </>
  );
}

export default function AuthServiceSection({ session, activeGroup }: Props) {
  const [tab, setTab] = useState<'users' | 'jwt'>('users');

  if (!session.authToken) {
    return (
      <>
        <div className="section-header">
          <h1>AuthService</h1>
          <span className="badge warn">nicht verbunden</span>
        </div>
        <div className="auth-notice"><p>Bitte anmelden, um AuthService-Funktionen zu nutzen.</p></div>
      </>
    );
  }

  return (
    <>
      <div className="section-header">
        <h1>AuthService</h1>
        <span className="badge ok">verbunden</span>
      </div>
      <div className="tabs">
        <button className={`tab-btn${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>Benutzer</button>
        <button className={`tab-btn${tab === 'jwt'   ? ' active' : ''}`} onClick={() => setTab('jwt')}>JWT-Schlüssel</button>
      </div>
      {tab === 'users' && <UsersTab activeGroup={activeGroup} />}
      {tab === 'jwt'   && <JwtTab   activeGroup={activeGroup} />}
    </>
  );
}
