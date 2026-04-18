import { useState, useEffect } from 'react';
import type { Config, Session } from './types';
import { loadConfig, saveConfig, getActiveGroup } from './lib/config';
import { loadSession, saveSession, clearSession } from './lib/session';
import Sidebar from './components/Sidebar';
import MonitorSection from './sections/Monitor';
import ServicesSection from './sections/Services';
import AuthServiceSection from './sections/AuthService';
import FreeSchoolSection from './sections/FreeSchool';
import MigrationSection from './sections/Migration';
import SettingsSection from './sections/Settings';

export type SectionId = 'monitor' | 'services' | 'auth-service' | 'freeschool' | 'migration' | 'settings';

export default function App() {
  const [section, setSection] = useState<SectionId>('monitor');
  const [config, setConfig] = useState<Config>(loadConfig);
  const [session, setSession] = useState<Session>(loadSession);

  const activeGroup = getActiveGroup(config);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.ok ? r.json() : null)
      .then((data: Config | null) => { if (data) handleConfigUpdate(data); })
      .catch(() => {});
  }, []);

  function handleConfigUpdate(cfg: Config) {
    saveConfig(cfg);
    setConfig(cfg);
  }

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
        activeGroup={activeGroup}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <main className="content">
        {section === 'monitor' && (
          <MonitorSection />
        )}
        {section === 'services' && (
          <ServicesSection activeGroup={activeGroup} groupName={config.activeGroup} />
        )}
        {section === 'auth-service' && (
          <AuthServiceSection session={session} activeGroup={activeGroup} />
        )}
        {section === 'freeschool' && (
          <FreeSchoolSection session={session} activeGroup={activeGroup} />
        )}
        {section === 'migration' && (
          <MigrationSection session={session} activeGroup={activeGroup} />
        )}
        {section === 'settings' && (
          <SettingsSection config={config} session={session} onUpdate={handleConfigUpdate} />
        )}
      </main>
    </>
  );
}
