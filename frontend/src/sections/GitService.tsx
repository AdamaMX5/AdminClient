import { useState, useEffect } from 'react';
import type { Session, ServerGroup } from '../types';
import { authFetch } from '../lib/api';

interface Props { session: Session; activeGroup: ServerGroup; }

interface ApiKey {
  id: string;
  name: string;
  displayPrefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

// POST /admin/api-keys returns the plaintext key exactly once — never retrievable again.
interface CreatedApiKey extends ApiKey {
  key: string;
}

function fmtDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString('de-DE') : '–';
}

function CreateKeyModal({ baseUrl, onClose, onCreated }: {
  baseUrl: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      const res = await authFetch(`${baseUrl}/admin/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setCreated(await res.json() as CreatedApiKey);
        onCreated();
        return;
      }
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? `Fehler ${res.status}`);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function copyKey() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — user can still select the text */ }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {created ? (
          <>
            <h3>API-Key erstellt</h3>
            <p className="hint">
              Dieser Schlüssel wird <strong>nur jetzt</strong> angezeigt und kann später nicht erneut abgerufen werden.
              Bitte sofort sicher kopieren.
            </p>
            <code className="code-block key-reveal">{created.key}</code>
            <div className="panel-actions">
              <button className="btn" onClick={copyKey}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
              <button className="btn-ghost" onClick={onClose}>Schließen</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h3>Neuen API-Key erzeugen</h3>
            <p className="hint">Ein sprechender Name pro Client (1–100 Zeichen), z.B. „GitClient-Poller".</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name des Clients"
              maxLength={100}
              autoFocus
            />
            {error && <p className="error-text">{error}</p>}
            <div className="panel-actions">
              <button className="btn" type="submit" disabled={saving || !name.trim()}>
                {saving ? '…' : 'Erzeugen'}
              </button>
              <button className="btn-ghost" type="button" onClick={onClose}>Abbrechen</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function GitServiceSection({ session, activeGroup }: Props) {
  const [keys, setKeys]       = useState<ApiKey[] | null>(null);
  const [error, setError]     = useState('');
  const [showModal, setShowModal] = useState(false);

  const baseUrl = activeGroup.gitServiceUrl;

  useEffect(() => { if (session.authToken && baseUrl) load(); }, [baseUrl]);

  async function load() {
    setError('');
    try {
      const res = await authFetch(`${baseUrl}/admin/api-keys`);
      if (!res.ok) { setError(`Fehler ${res.status}`); return; }
      setKeys(await res.json() as ApiKey[]);
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  async function revoke(id: string) {
    if (!confirm('Diesen API-Key wirklich widerrufen? Clients, die ihn nutzen, verlieren sofort den Zugriff.')) return;
    try {
      const res = await authFetch(`${baseUrl}/admin/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; alert('Fehler: ' + (d.error ?? res.status)); return; }
      load();
    } catch (e: unknown) { alert(String(e)); }
  }

  if (!session.authToken) {
    return (
      <>
        <div className="section-header">
          <h1>GitService</h1>
          <span className="badge warn">nicht verbunden</span>
        </div>
        <div className="auth-notice"><p>Bitte anmelden, um GitService-Funktionen zu nutzen.</p></div>
      </>
    );
  }

  if (!baseUrl) {
    return (
      <>
        <div className="section-header">
          <h1>GitService</h1>
          <span className="badge warn">nicht konfiguriert</span>
        </div>
        <div className="auth-notice"><p>Keine GitService-URL in der aktiven Servergruppe. Bitte unter „Einstellungen" hinterlegen.</p></div>
      </>
    );
  }

  return (
    <>
      <div className="section-header">
        <h1>GitService</h1>
        <span className="badge ok">verbunden</span>
      </div>

      <div className="toolbar">
        <button className="btn" onClick={() => setShowModal(true)}>Neuen API-Key erzeugen</button>
        <button className="btn btn-secondary" onClick={load}>Aktualisieren</button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {keys === null ? (
        <p className="loading-text">Lade API-Keys…</p>
      ) : keys.length === 0 ? (
        <p className="loading-text">Keine API-Keys vorhanden.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Prefix</th><th>Erstellt</th><th>Zuletzt genutzt</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td><code>{k.displayPrefix}…</code></td>
                <td>{fmtDate(k.createdAt)}</td>
                <td>{fmtDate(k.lastUsedAt)}</td>
                <td>
                  {k.revokedAt
                    ? <span className="badge warn">widerrufen</span>
                    : <span className="badge ok">aktiv</span>}
                </td>
                <td>
                  {!k.revokedAt && (
                    <button className="btn-ghost danger-ghost" onClick={() => revoke(k.id)}>Widerrufen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <CreateKeyModal
          baseUrl={baseUrl}
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </>
  );
}
