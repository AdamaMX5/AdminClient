import { useState } from 'react';
import type { Session } from './types';
import { services } from './lib/services';
import { loadSession, saveSession, clearSession } from './lib/session';
import Sidebar from './components/Sidebar';
import ServicesSection from './sections/Services';
import AuthServiceSection from './sections/AuthService';
import GitServiceSection from './sections/GitService';
import MediaServiceSection from './sections/MediaService';
import FreeSchoolSection from './sections/FreeSchool';
import MigrationSection from './sections/Migration';

export type SectionId = 'services' | 'auth-service' | 'git-service' | 'media-service' | 'freeschool' | 'migration';

export default function App() {
  const [section, setSection] = useState<SectionId>('services');
  const [session, setSession] = useState<Session>(loadSession);

  function handleLogin(s: Session) {
    saveSession(s);
    setSession(s);
  }

  function handleLogout() {
    clearSession();
    setSession({});
    setSection('services');
  }

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
