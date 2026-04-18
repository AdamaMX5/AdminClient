import { useState, useEffect } from 'react';
import type { ServerGroup, HealthResult } from '../types';
import { checkAllServices } from '../lib/api';

interface Props {
  activeGroup: ServerGroup;
  groupName: string;
}

export default function ServicesSection({ activeGroup, groupName }: Props) {
  const [results, setResults] = useState<(HealthResult & { icon: string })[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runCheck();
  }, [groupName]);

  async function runCheck() {
    setLoading(true);
    const data = await checkAllServices(activeGroup) as (HealthResult & { icon: string })[];
    setResults(data);
    setLoading(false);
  }

  return (
    <>
      <div className="section-header">
        <h1>Services</h1>
        {groupName && <span className="badge ok">{groupName}</span>}
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={runCheck} disabled={loading}>
          {loading ? 'Prüfe…' : 'Alle prüfen'}
        </button>
      </div>

      {!groupName ? (
        <p className="loading-text">Keine Servergruppe konfiguriert. Bitte in den Einstellungen eine Gruppe anlegen.</p>
      ) : loading && !results ? (
        <p className="loading-text">Prüfe Services…</p>
      ) : results ? (
        <div className="services-grid">
          {results.map(s => {
            let badgeClass = '', badgeText = '';
            if (s.status === 'unconfigured') { badgeText = 'nicht konfiguriert'; }
            else if (s.status === 'ok')      { badgeClass = 'ok';    badgeText = 'erreichbar'; }
            else                             { badgeClass = 'error'; badgeText = 'nicht erreichbar'; }
            return (
              <div key={s.key} className={`service-card${s.status === 'unconfigured' ? ' service-card--dim' : ''}`}>
                <div className="service-card-header">
                  <span className="service-icon">{s.icon}</span>
                  <span className="service-name">{s.label}</span>
                  {s.latency != null && s.status !== 'unconfigured' && (
                    <span className="service-latency">{s.latency} ms</span>
                  )}
                </div>
                <div className="service-card-url">
                  {s.url
                    ? <a className="service-url" href={s.url} target="_blank" rel="noopener">{s.url}</a>
                    : <span className="muted">–</span>}
                </div>
                <span className={`badge ${badgeClass}`}>
                  {badgeText}{s.code ? ` · ${s.code}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
