import { useState } from 'react';
import type { Session, ServerGroup } from '../types';
import { authFetch } from '../lib/api';

interface Props { session: Session; activeGroup: ServerGroup; }

interface MediaFile {
  id?: string;
  _id?: string;
  url: string;
  name?: string;
  description?: string;
  folder?: string;
  app_name?: string;
  uploadedBy?: string;
  uploaded_by?: string;
  contentType?: string;
  mimetype?: string;
  size?: number;
  createdAt?: string;
  created_at?: string;
}

interface BrowseResult {
  path: string;
  folders: string[];
  files: MediaFile[];
}

const KNOWN_APPS = ['FreeSchool', 'VirtualOffice', 'MessangerClient', 'AdminClient'];
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function fileId(f: MediaFile): string | undefined {
  return f.id ?? f._id;
}

function fileName(f: MediaFile): string {
  return f.name || f.url.split('/').pop() || 'Datei';
}

function isImage(f: MediaFile): boolean {
  if (f.contentType?.startsWith('image/') || f.mimetype?.startsWith('image/')) return true;
  return IMAGE_EXT.test(f.url);
}

function fmtSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(value?: string): string {
  return value ? new Date(value).toLocaleString('de-DE') : '–';
}

function UploadModal({ baseUrl, appName, folder, onClose, onUploaded }: {
  baseUrl: string;
  appName: string;
  folder: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile]               = useState<File | null>(null);
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('app_name', appName);
      if (folder) form.append('folder', folder);
      if (name.trim()) form.append('name', name.trim());
      if (description.trim()) form.append('description', description.trim());

      const res = await authFetch(`${baseUrl}/upload`, { method: 'POST', body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? `Fehler ${res.status}`);
        return;
      }
      onUploaded();
      onClose();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <form onSubmit={submit}>
          <h3>Datei hochladen</h3>
          <p className="hint">
            Zielordner: <code>{appName}{folder ? `/${folder}` : ''}</code>
          </p>
          <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} required />
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Anzeigename (optional)"
          />
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Beschreibung (optional)"
          />
          {error && <p className="error-text">{error}</p>}
          <div className="panel-actions">
            <button className="btn" type="submit" disabled={uploading || !file}>
              {uploading ? '…' : 'Hochladen'}
            </button>
            <button className="btn-ghost" type="button" onClick={onClose}>Abbrechen</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MediaServiceSection({ session, activeGroup }: Props) {
  const [appInput, setAppInput]     = useState('');
  const [appName, setAppName]       = useState('');
  const [path, setPath]             = useState<string[]>([]);
  const [listing, setListing]       = useState<BrowseResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const baseUrl = activeGroup.mediaServiceUrl;

  async function load(app: string, segments: string[]) {
    setLoading(true);
    setError('');
    try {
      const suffix = segments.length ? '/' + segments.map(encodeURIComponent).join('/') : '';
      const res = await authFetch(`${baseUrl}/browse/${encodeURIComponent(app)}${suffix}`);
      if (!res.ok) {
        setListing(null);
        setError(`Fehler ${res.status}`);
        return;
      }
      setListing(await res.json() as BrowseResult);
    } catch (e: unknown) {
      setListing(null);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function openApp(app: string) {
    const trimmed = app.trim();
    if (!trimmed) return;
    setAppName(trimmed);
    setPath([]);
    load(trimmed, []);
  }

  function enterFolder(folder: string) {
    const next = [...path, folder];
    setPath(next);
    load(appName, next);
  }

  function goToBreadcrumb(index: number) {
    const next = index < 0 ? [] : path.slice(0, index + 1);
    setPath(next);
    load(appName, next);
  }

  async function deleteFile(f: MediaFile) {
    const id = fileId(f);
    if (!id) return;
    if (!confirm(`"${fileName(f)}" wirklich löschen?`)) return;
    try {
      const res = await authFetch(`${baseUrl}/admin/media/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        alert('Fehler: ' + (d.error ?? res.status));
        return;
      }
      load(appName, path);
    } catch (e: unknown) {
      alert(String(e));
    }
  }

  if (!session.authToken) {
    return (
      <>
        <div className="section-header">
          <h1>MediaService</h1>
          <span className="badge warn">nicht verbunden</span>
        </div>
        <div className="auth-notice"><p>Bitte anmelden, um MediaService-Funktionen zu nutzen.</p></div>
      </>
    );
  }

  if (!baseUrl) {
    return (
      <>
        <div className="section-header">
          <h1>MediaService</h1>
          <span className="badge warn">nicht konfiguriert</span>
        </div>
        <div className="auth-notice"><p>Keine MediaService-URL in der aktiven Servergruppe. Bitte unter „Einstellungen" hinterlegen.</p></div>
      </>
    );
  }

  return (
    <>
      <div className="section-header">
        <h1>MediaService</h1>
        <span className="badge ok">verbunden</span>
      </div>

      <div className="toolbar">
        <input
          type="text"
          list="media-known-apps"
          value={appInput}
          onChange={e => setAppInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && openApp(appInput)}
          placeholder="App-Name, z.B. VirtualOffice"
          style={{ maxWidth: '260px' }}
        />
        <datalist id="media-known-apps">
          {KNOWN_APPS.map(a => <option key={a} value={a} />)}
        </datalist>
        <button className="btn btn-secondary" onClick={() => openApp(appInput)}>Öffnen</button>
        {appName && (
          <>
            <button className="btn" onClick={() => setShowUpload(true)}>Datei hochladen</button>
            <button className="btn btn-secondary" onClick={() => load(appName, path)} disabled={loading}>
              {loading ? '…' : 'Aktualisieren'}
            </button>
          </>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {!appName ? (
        <p className="loading-text">Bitte einen App-Namen eingeben, um dessen Dateien zu durchsuchen.</p>
      ) : (
        <>
          <div className="breadcrumbs">
            <button className="breadcrumb-btn" onClick={() => goToBreadcrumb(-1)}>{appName}</button>
            {path.map((seg, i) => (
              <span key={i}>
                <span className="breadcrumb-sep">/</span>
                <button className="breadcrumb-btn" onClick={() => goToBreadcrumb(i)}>{seg}</button>
              </span>
            ))}
          </div>

          {loading && !listing ? (
            <p className="loading-text">Lade…</p>
          ) : listing ? (
            listing.folders.length === 0 && listing.files.length === 0 ? (
              <p className="loading-text">Dieser Ordner ist leer.</p>
            ) : (
              <div className="file-grid">
                {listing.folders.map(folder => (
                  <button key={folder} className="file-card folder-card" onClick={() => enterFolder(folder)}>
                    <span className="file-card-icon">📁</span>
                    <span className="file-card-name">{folder}</span>
                  </button>
                ))}
                {listing.files.map(f => (
                  <div key={fileId(f) ?? f.url} className="file-card">
                    {isImage(f) ? (
                      <img className="file-card-thumb" src={f.url} alt={fileName(f)} loading="lazy" />
                    ) : (
                      <span className="file-card-icon">📄</span>
                    )}
                    <span className="file-card-name" title={fileName(f)}>{fileName(f)}</span>
                    {f.size != null && <span className="file-card-meta">{fmtSize(f.size)}</span>}
                    <span className="file-card-meta">{fmtDate(f.createdAt ?? f.created_at)}</span>
                    <div className="file-card-actions">
                      <a className="btn-ghost" href={f.url} target="_blank" rel="noopener">Öffnen</a>
                      {fileId(f) && (
                        <button className="btn-ghost danger-ghost" onClick={() => deleteFile(f)}>Löschen</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </>
      )}

      {showUpload && (
        <UploadModal
          baseUrl={baseUrl}
          appName={appName}
          folder={path.join('/')}
          onClose={() => setShowUpload(false)}
          onUploaded={() => load(appName, path)}
        />
      )}
    </>
  );
}
