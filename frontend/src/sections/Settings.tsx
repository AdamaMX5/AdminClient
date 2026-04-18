import { useState } from 'react';
import type { Config, ServerGroup } from '../types';

interface Props {
  config: Config;
  onUpdate: (cfg: Config) => void;
}

const EXTRA_KEYS: (keyof ServerGroup)[] = ['officeUrl', 'presenceUrl', 'liveUrl', 'recordingUrl', 'profileUrl', 'matrixUrl'];

const SUBDOMAIN_MAP: Partial<Record<keyof ServerGroup, string>> = {
  authServiceUrl: 'auth',
  freeSchoolUrl:  'api',
  officeUrl:      'office',
  presenceUrl:    'presence',
  liveUrl:        'live',
  recordingUrl:   'recording',
  profileUrl:     'profile',
  matrixUrl:      'matrix',
};

interface GroupFormState {
  domain: string;
  name: string;
  authServiceUrl: string;
  freeSchoolUrl: string;
  officeUrl: string;
  presenceUrl: string;
  liveUrl: string;
  recordingUrl: string;
  profileUrl: string;
  matrixUrl: string;
}

const EMPTY_FORM: GroupFormState = {
  domain: '', name: '', authServiceUrl: '', freeSchoolUrl: '',
  officeUrl: '', presenceUrl: '', liveUrl: '', recordingUrl: '', profileUrl: '', matrixUrl: '',
};

export default function SettingsSection({ config, onUpdate }: Props) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm]               = useState<GroupFormState>(EMPTY_FORM);
  const [formError, setFormError]     = useState('');

  function set(field: keyof GroupFormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function fillFromDomain(domain: string) {
    const base = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!base) return;
    setForm(prev => ({
      ...prev,
      authServiceUrl: `https://auth.${base}`,
      freeSchoolUrl:  `https://api.${base}`,
      officeUrl:      `https://office.${base}`,
      presenceUrl:    `https://presence.${base}`,
      liveUrl:        `https://live.${base}`,
      recordingUrl:   `https://recording.${base}`,
      profileUrl:     `https://profile.${base}`,
      matrixUrl:      `https://matrix.${base}`,
    }));
  }

  function startEdit(g: ServerGroup) {
    setEditingName(g.name);
    setForm({
      domain: '',
      name:           g.name,
      authServiceUrl: g.authServiceUrl ?? '',
      freeSchoolUrl:  g.freeSchoolUrl ?? '',
      officeUrl:      g.officeUrl ?? '',
      presenceUrl:    g.presenceUrl ?? '',
      liveUrl:        g.liveUrl ?? '',
      recordingUrl:   g.recordingUrl ?? '',
      profileUrl:     g.profileUrl ?? '',
      matrixUrl:      g.matrixUrl ?? '',
    });
    setFormError('');
    setTimeout(() => document.getElementById('gf-name')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function resetForm() {
    setEditingName(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  function saveGroup() {
    const { name, authServiceUrl, freeSchoolUrl } = form;
    if (!name || !authServiceUrl || !freeSchoolUrl) {
      setFormError('Name, AuthService URL und FreeSchool URL sind erforderlich.');
      return;
    }
    const group: ServerGroup = {
      name,
      authServiceUrl,
      freeSchoolUrl,
      officeUrl:    form.officeUrl    || undefined,
      presenceUrl:  form.presenceUrl  || undefined,
      liveUrl:      form.liveUrl      || undefined,
      recordingUrl: form.recordingUrl || undefined,
      profileUrl:   form.profileUrl   || undefined,
      matrixUrl:    form.matrixUrl    || undefined,
    };

    const groups = [...config.groups];
    const idx = groups.findIndex(g => g.name === (editingName ?? name));
    let activeGroup = config.activeGroup;
    if (idx >= 0) {
      groups[idx] = group;
      if (activeGroup === editingName) activeGroup = name;
    } else {
      groups.push(group);
      if (!activeGroup) activeGroup = name;
    }
    onUpdate({ activeGroup, groups });
    resetForm();
  }

  function activateGroup(name: string) {
    onUpdate({ ...config, activeGroup: name });
  }

  function deleteGroup(name: string) {
    if (!confirm(`Gruppe "${name}" wirklich löschen?`)) return;
    if (config.groups.length <= 1) { alert('Letzte Gruppe kann nicht gelöscht werden.'); return; }
    if (config.activeGroup === name) { alert('Aktive Gruppe kann nicht gelöscht werden.'); return; }
    onUpdate({ ...config, groups: config.groups.filter(g => g.name !== name) });
  }

  return (
    <>
      <div className="section-header"><h1>Einstellungen</h1></div>

      <h2 className="settings-heading">Servergruppen</h2>
      <p className="hint" style={{ marginBottom: '1rem' }}>
        Jede Gruppe enthält die URLs für AuthService und FreeSchool. Die aktive Gruppe wird für alle API-Anfragen verwendet.
      </p>

      {config.groups.length === 0 ? (
        <p className="loading-text">Keine Gruppen.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Aktiv</th><th>Name</th><th>AuthService URL</th><th>FreeSchool URL</th><th>Weitere</th><th></th></tr>
          </thead>
          <tbody>
            {config.groups.map(g => (
              <tr key={g.name} className={g.name === config.activeGroup ? 'row-active' : ''}>
                <td>
                  {g.name === config.activeGroup
                    ? <span className="badge ok">aktiv</span>
                    : <button className="btn-ghost" onClick={() => activateGroup(g.name)}>Aktivieren</button>}
                </td>
                <td><strong>{g.name}</strong></td>
                <td><code className="url-cell">{g.authServiceUrl || '–'}</code></td>
                <td><code className="url-cell">{g.freeSchoolUrl || '–'}</code></td>
                <td><span className="muted">{EXTRA_KEYS.filter(k => g[k]).length} / {EXTRA_KEYS.length}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-ghost" onClick={() => startEdit(g)}>Bearbeiten</button>
                  {g.name !== config.activeGroup && (
                    <button className="btn-ghost danger-ghost" onClick={() => deleteGroup(g.name)}>Löschen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Add / Edit form ── */}
      <div className="form-panel" id="gf-name">
        <h3>{editingName ? `Gruppe bearbeiten: ${editingName}` : 'Neue Gruppe'}</h3>

        <div className="form-row">
          <label>Name</label>
          <input id="gf-name" type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Produktion" />
        </div>
        <div className="form-row">
          <label>AuthService URL</label>
          <input type="url" value={form.authServiceUrl} onChange={e => set('authServiceUrl', e.target.value)} placeholder="https://auth.example.com" />
        </div>
        <div className="form-row">
          <label>FreeSchool URL</label>
          <input type="url" value={form.freeSchoolUrl} onChange={e => set('freeSchoolUrl', e.target.value)} placeholder="https://api.example.com" />
        </div>

        <p className="hint">Domain-Schnellausfüllung</p>
        <div className="form-row">
          <label>Basis-Domain</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={form.domain}
              onChange={e => set('domain', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fillFromDomain(form.domain)}
              placeholder="freischule.info"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => fillFromDomain(form.domain)}>Ausfüllen</button>
          </div>
        </div>

        <p className="hint">Optionale Services</p>
        {(
          [
            ['officeUrl',    'Office URL',    'https://office.example.com'],
            ['presenceUrl',  'Presence URL',  'https://presence.example.com'],
            ['liveUrl',      'LiveKit URL',   'https://live.example.com'],
            ['recordingUrl', 'Recording URL', 'https://recording.example.com'],
            ['profileUrl',   'Profile URL',   'https://profile.example.com'],
            ['matrixUrl',    'Matrix URL',    'https://matrix.example.com'],
          ] as [keyof GroupFormState, string, string][]
        ).map(([key, label, placeholder]) => (
          <div className="form-row" key={key}>
            <label>{label}</label>
            <input type="url" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
          </div>
        ))}

        <div className="panel-actions">
          <button className="btn" onClick={saveGroup}>Speichern</button>
          <button className="btn-ghost" onClick={resetForm}>Abbrechen</button>
        </div>
        {formError && <p className="error-text">{formError}</p>}
      </div>
    </>
  );
}
