import { useState, useEffect } from 'react';
import type { Session, ServiceConfig } from '../types';
import { fsFetch } from '../lib/api';

interface Props { session: Session; services: ServiceConfig; }

interface FsUser {
  id: string;
  email: string;
  roles?: string[];
  email_verify?: boolean;
  last_login?: string;
}

const FS_ROLES = ['STUDENT', 'TEACHER', 'TUTOR', 'PROJECTMANAGER', 'SCHOOLDIRECTOR', 'MODERATOR', 'ADMIN'];

function RolePills({ roles }: { roles?: string[] }) {
  if (!roles?.length) return <span className="muted">–</span>;
  return <>{roles.map(r => <span key={r} className="role-pill">{r}</span>)}</>;
}

function UsersTab({ services }: { services: ServiceConfig }) {
  const [users, setUsers]       = useState<FsUser[] | null>(null);
  const [error, setError]       = useState('');
  const [editUser, setEditUser] = useState<FsUser | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setError('');
    try {
      const res = await fsFetch(`${services.freeSchoolUrl}/admin/users`);
      if (!res.ok) { setError(`Fehler ${res.status}`); return; }
      setUsers(await res.json() as FsUser[]);
    } catch (e: unknown) { setError(String(e)); }
  }

  async function saveRoles() {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fsFetch(`${services.freeSchoolUrl}/admin/user/${editUser.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: editRoles }),
      });
      if (res.ok) { setEditUser(null); load(); }
      else { const d = await res.json() as { detail?: string }; alert('Fehler: ' + (d.detail ?? 'Unbekannt')); }
    } catch (e: unknown) { alert(String(e)); }
    setSaving(false);
  }

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={load}>Aktualisieren</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {users === null ? (
        <p className="loading-text">Lade Benutzer…</p>
      ) : users.length === 0 ? (
        <p className="loading-text">Keine Benutzer gefunden.</p>
      ) : (
        <table>
          <thead>
            <tr><th>ID</th><th>E-Mail</th><th>Rollen</th><th>E-Mail bestätigt</th><th>Letzter Login</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><code>{u.id}</code></td>
                <td>{u.email}</td>
                <td><RolePills roles={u.roles} /></td>
                <td><span className={`badge ${u.email_verify ? 'ok' : 'warn'}`}>{u.email_verify ? 'ja' : 'nein'}</span></td>
                <td>{u.last_login ? new Date(u.last_login).toLocaleString('de-DE') : '–'}</td>
                <td>
                  <button className="btn-ghost" onClick={() => { setEditUser(u); setEditRoles(u.roles ?? []); }}>
                    Rollen
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
          <div className="role-grid">
            {FS_ROLES.map(r => (
              <label key={r}>
                <input
                  type="checkbox"
                  checked={editRoles.includes(r)}
                  onChange={e => setEditRoles(prev => e.target.checked ? [...prev, r] : prev.filter(x => x !== r))}
                />
                {r}
              </label>
            ))}
          </div>
          <div className="panel-actions">
            <button className="btn" onClick={saveRoles} disabled={saving}>Speichern</button>
            <button className="btn-ghost" onClick={() => setEditUser(null)}>Abbrechen</button>
          </div>
        </div>
      )}
    </>
  );
}

function BackupTab({ services }: { services: ServiceConfig }) {
  async function download(type: 'json' | 'sql') {
    const path     = type === 'json' ? '/admin/backup/json' : '/admin/backup';
    const filename = type === 'json' ? 'backup.json' : 'backup.sql';
    try {
      const res = await fsFetch(`${services.freeSchoolUrl}${path}`);
      if (!res.ok) { alert(`Fehler ${res.status}`); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e: unknown) { alert(String(e)); }
  }

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={() => download('json')}>JSON-Backup herunterladen</button>
        <button className="btn" onClick={() => download('sql')}>SQL-Backup herunterladen</button>
      </div>
      <p className="hint">Die Backups werden direkt vom FreeSchool-Server gestreamt und als Datei gespeichert.</p>
    </>
  );
}

export default function FreeSchoolSection({ session, services }: Props) {
  const [tab, setTab] = useState<'users' | 'backup'>('users');

  if (!session.freeSchoolToken) {
    return (
      <>
        <div className="section-header">
          <h1>FreeSchool</h1>
          <span className="badge warn">nicht verbunden</span>
        </div>
        <div className="auth-notice"><p>Bitte anmelden, um FreeSchool-Funktionen zu nutzen.</p></div>
      </>
    );
  }

  return (
    <>
      <div className="section-header">
        <h1>FreeSchool</h1>
        <span className="badge ok">verbunden</span>
      </div>
      <div className="tabs">
        <button className={`tab-btn${tab === 'users'  ? ' active' : ''}`} onClick={() => setTab('users')}>Benutzer</button>
        <button className={`tab-btn${tab === 'backup' ? ' active' : ''}`} onClick={() => setTab('backup')}>Backup</button>
      </div>
      {tab === 'users'  && <UsersTab  services={services} />}
      {tab === 'backup' && <BackupTab services={services} />}
    </>
  );
}
