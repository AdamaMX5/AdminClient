import { useEffect, useRef, useState } from 'react';
import type { Session } from './types';
import { services } from './lib/services';
import { loadSession, saveSession, clearSession } from './lib/session';
import { refreshAccessToken } from './lib/api';
import Sidebar from './components/Sidebar';
import ServicesSection from './sections/Services';
import AuthServiceSection from './sections/AuthService';
import GitServiceSection from './sections/GitService';
import MediaServiceSection from './sections/MediaService';
import FreeSchoolSection from './sections/FreeSchool';
import MigrationSection from './sections/Migration';

export type SectionId = 'services' | 'auth-service' | 'git-service' | 'media-service' | 'freeschool' | 'migration';

// AuthService JWTs live 15 minutes; refresh 5 minutes early so no service
// ever sees an expired token.
const REFRESH_INTERVAL_MS = 10 * 60_000;

export default function App() {
  const [section, setSection] = useState<SectionId>('services');
  const [session, setSession] = useState<Session>(loadSession);
  // Guards against a refresh in flight resolving *after* the user hit
  // "Abmelden" and re-logging them in behind their back.
  const loggedOutRef = useRef(false);

  function handleLogin(s: Session) {
    loggedOutRef.current = false;
    saveSession(s);
    setSession(s);
  }

  function handleLogout() {
    loggedOutRef.current = true;
    clearSession();
    setSession({});
    setSection('services');
    // Best-effort server-side revoke so the refresh_token cookie can't be
    // used to silently resume the session (it otherwise stays valid for
    // up to 14 days regardless of this local state clear).
    if (services.authServiceUrl) {
      fetch(`${services.authServiceUrl}/user/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
  }

  // On mount: sessionStorage is empty after a browser restart, but the
  // refresh_token cookie survives up to 14 days — try to silently resume.
  useEffect(() => {
    let cancelled = false;
    const hadStaleToken = !!loadSession().authToken;
    refreshAccessToken(services.authServiceUrl).then(result => {
      if (cancelled || loggedOutRef.current) return;
      if (result) handleLogin(result);
      // A token already sat in sessionStorage (e.g. reload in the same tab)
      // but the refresh cookie is gone/invalid — drop the now-unrenewable
      // stale token instead of letting authFetch keep sending it.
      else if (hadStaleToken) handleLogout();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While logged in: proactively renew the access token before it expires.
  useEffect(() => {
    if (!session.authToken) return;
    const interval = setInterval(async () => {
      const result = await refreshAccessToken(services.authServiceUrl);
      if (loggedOutRef.current) return;
      if (result) handleLogin(result);
      else handleLogout();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.authToken]);

  return (
    <>
      <Sidebar
        section={section}
        onSection={setSection}
        session={session}
        services={services}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <main className="content">
        {section === 'services' && (
          <ServicesSection services={services} onSection={setSection} />
        )}
        {section === 'auth-service' && (
          <AuthServiceSection session={session} services={services} />
        )}
        {section === 'git-service' && (
          <GitServiceSection session={session} services={services} />
        )}
        {section === 'media-service' && (
          <MediaServiceSection session={session} services={services} />
        )}
        {section === 'freeschool' && (
          <FreeSchoolSection session={session} services={services} />
        )}
        {section === 'migration' && (
          <MigrationSection session={session} services={services} />
        )}
      </main>
    </>
  );
}
