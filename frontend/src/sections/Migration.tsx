import { useState } from 'react';
import type { Session, ServiceConfig } from '../types';
import { authFetch, fsFetch } from '../lib/api';

interface Props { session: Session; services: ServiceConfig; }

interface FsExportUser {
  id: string;
  email: string;
  hashed_password?: string;
  roles?: Array<{ name: string } | string>;
  profile?: { full_name?: string };
}

interface ImportItem {
  email: string;
  hashed_password?: string;
  roles?: string[];
  comment?: string;
}

function mapUser(u: FsExportUser): ImportItem {
  const roles = (u.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
  return {
    email: u.email,
    hashed_password: u.hashed_password,
    roles,
    comment: u.profile?.full_name
      ? `Migrated from FreeSchool — ${u.profile.full_name}`
      : 'Migrated from FreeSchool',
  };
}

function RolePills({ roles }: { roles?: string[] }) {
  if (!roles?.length) return <span className="muted">–</span>;
  return <>{roles.map(r => <span key={r} className="role-pill">{r}</span>)}</>;
}

export default function MigrationSection({ session, services }: Props) {
  const [preview, setPreview]   = useState<ImportItem[] | null>(null);
  const [result, setResult]     = useState<React.ReactNode>(null);
  const [loading, setLoading]   = useState(false);
  const [runEnabled, setRunEnabled] = useState(false);

  const canUse = !!(session.authToken && session.freeSchoolToken);

  async function fetchExport(): Promise<FsExportUser[]> {
    const res = await fsFetch(`${services.freeSchoolUrl}/admin/export/users`);
    if (!res.ok) throw new Error(`FreeSchool Export fehlgeschlagen: ${res.status}`);
    return res.json() as Promise<FsExportUser[]>;
  }

  async function loadPreview() {
    setLoading(true);
    setRunEnabled(false);
    setResult(null);
    try {
      const users  = await fetchExport();
      const mapped = users.map(mapUser);
      setPreview(mapped);
      setRunEnabled(true);
    } catch (e: unknown) {
      setPreview(null);
      setResult(<p className="error-text">Fehler: {String(e)}</p>);
    }
    setLoading(false);
  }

  async function runMigration() {
    if (!confirm('Migration jetzt ausführen? Dies kann nicht rückgängig gemacht werden.')) return;
    setLoading(true);
    setRunEnabled(false);
    try {
      const users  = await fetchExport();
      const mapped = users.map(mapUser);
      const blob   = new Blob([JSON.stringify(mapped)], { type: 'application/json' });
      const form   = new FormData();
      form.append('file', blob, 'migration.json');

      const res = await authFetch(`${services.authServiceUrl}/admin/users/import`, { method: 'POST', body: form });
      const d   = await res.json() as { created?: number; updated?: number; skipped?: number; skipped_reasons?: unknown[]; error?: string; detail?: string };

      if (res.ok) {
        setResult(
          <div className="migration-info">
            <p>✓ Migration abgeschlossen</p>
            <p>Erstellt: <strong>{d.created ?? '?'}</strong> &nbsp; Aktualisiert: <strong>{d.updated ?? '?'}</strong> &nbsp; Übersprungen: <strong>{d.skipped ?? '?'}</strong></p>
            {d.skipped_reasons?.length ? <pre className="code-block">{JSON.stringify(d.skipped_reasons, null, 2)}</pre> : null}
          </div>
        );
      } else {
        setResult(<p className="error-text">{d.error ?? d.detail ?? 'Migration fehlgeschlagen'}</p>);
        setRunEnabled(true);
      }
    } catch (e: unknown) {
      setResult(<p className="error-text">Fehler: {String(e)}</p>);
      setRunEnabled(true);
    }
    setLoading(false);
  }

  if (!canUse) {
    return (
      <>
        <div className="section-header">
          <h1>Migration</h1>
          <span className="badge warn">FreeSchool → AuthService</span>
        </div>
        <div className="auth-notice"><p>Bitte mit AuthService und FreeSchool anmelden, um die Migration zu nutzen.</p></div>
      </>
    );
  }

  return (
    <>
      <div className="section-header">
        <h1>Migration</h1>
        <span className="badge warn">FreeSchool → AuthService</span>
      </div>
      <div className="migration-info">
        <p>Exportiert alle Benutzer aus <strong>FreeSchool</strong> und importiert sie in den <strong>AuthService</strong>.</p>
        <p className="warn-text">⚠ Passwort-Hashes sind inkompatibel (argon2 vs. bcrypt). Migrierte Benutzer müssen ihr Passwort zurücksetzen.</p>
      </div>
      <div className="toolbar">
        <button className="btn" onClick={loadPreview} disabled={loading}>Vorschau laden</button>
        <button className="btn btn-danger" onClick={runMigration} disabled={!runEnabled || loading}>Migration ausführen</button>
      </div>

      {preview && (
        <table style={{ marginBottom: '1rem' }}>
          <thead><tr><th>E-Mail</th><th>Rollen</th><th>Kommentar</th></tr></thead>
          <tbody>
            {preview.slice(0, 50).map((u, i) => (
              <tr key={i}>
                <td>{u.email}</td>
                <td><RolePills roles={u.roles} /></td>
                <td><small>{u.comment}</small></td>
              </tr>
            ))}
            {preview.length > 50 && (
              <tr><td colSpan={3} className="muted">… und {preview.length - 50} weitere</td></tr>
            )}
          </tbody>
        </table>
      )}

      {result}
    </>
  );
}
