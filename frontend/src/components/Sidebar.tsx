import { useState, useRef } from 'react';
import type { Session, ServiceConfig } from '../types';
import type { SectionId } from '../App';

interface Props {
  section: SectionId;
  onSection: (s: SectionId) => void;
  session: Session;
  services: ServiceConfig;
  onLogin: (s: Session) => void;
  onLogout: () => void;
}

const NAV_ITEMS: { id: SectionId; label: string }[] = [
  { id: 'services',     label: 'Services' },
  { id: 'auth-service', label: 'AuthService' },
  { id: 'git-service',  label: 'GitService' },
  { id: 'media-service', label: 'MediaService' },
  { id: 'freeschool',   label: 'FreeSchool' },
  { id: 'migration',    label: 'Migration' },
];

export default function Sidebar({ section, onSection, session, services, onLogin, onLogout }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const isLoggedIn = !!(session.authToken || session.freeSchoolToken);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!services.authServiceUrl && !services.freeSchoolUrl) {
      setError('Keine Service-URLs konfiguriert (VITE_AUTH_SERVICE_URL / VITE_FREESCHOOL_URL fehlen).');
      setLoading(false);
      return;
    }

    const newSession: Session = { userEmail: email };
    let authOk = false;
    let fsOk   = false;

    if (services.authServiceUrl) {
      try {
        const r = await fetch(`${services.authServiceUrl}/user/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (r.ok) {
          const data = await r.json() as { access_token?: string };
          if (data.access_token) { newSession.authToken = data.access_token; authOk = true; }
        }
      } catch {}
    }

    if (services.freeSchoolUrl) {
      try {
        const r = await fetch(`${services.freeSchoolUrl}/user/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (r.ok) {
          const data = await r.json() as { jwt?: string };
          if (data.jwt) { newSession.freeSchoolToken = data.jwt; fsOk = true; }
        }
      } catch {}
    }

    if (!authOk && !fsOk) {
      setError('Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
      setLoading(false);
      return;
    }

    onLogin(newSession);
    setEmail('');
    setPassword('');
    setLoading(false);
  }

  return (
    <aside className="sidebar">
      <div className="logo">Freischule <span>Admin</span></div>
      <div className="app-version" title="Git-Hash des aktuellen Builds">Version {__GIT_HASH__}</div>

      <nav>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-btn${section === item.id ? ' active' : ''}`}
            onClick={() => onSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {isLoggedIn ? (
          <>
            <span className="user-email">{session.userEmail}</span>
            <div className="service-status">
              <span className={`badge ${session.authToken ? 'ok' : 'warn'}`}>
                AuthService {session.authToken ? '✓' : '✗'}
              </span>
              <span className={`badge ${session.freeSchoolToken ? 'ok' : 'warn'}`}>
                FreeSchool {session.freeSchoolToken ? '✓' : '✗'}
              </span>
            </div>
            <button className="btn-ghost" onClick={onLogout}>Abmelden</button>
          </>
        ) : (
          <>
            <p className="sidebar-login-title">Anmelden</p>
            <form className="sidebar-login" onSubmit={handleLogin}>
              <label>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="admin@freischule.info"
              />
              <label>Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
              <button className="btn" type="submit" disabled={loading} style={{ marginTop: '0.25rem' }}>
                {loading ? '…' : 'Anmelden'}
              </button>
              {error && <p className="error-text">{error}</p>}
            </form>
          </>
        )}
      </div>
    </aside>
  );
}
