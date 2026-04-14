import { useState, useEffect, useRef } from 'react';

interface ServiceStatus {
  key: string;
  label: string;
  url: string | null;
  status: 'ok' | 'error' | 'unconfigured';
  code?: number;
  latency: number;
  lastChecked: string;
  lastChanged: string | null;
}

const ICONS: Record<string, string> = {
  auth:       '🔐',
  profile:    '👤',
  email:      '📧',
  exception:  '🚨',
  object:     '📦',
  message:    '💬',
  recording:  '🎙️',
  media:      '🖼️',
  freeschool: '🏫',
};

function fmt(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('de-DE');
}

function ago(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return `vor ${diff} s`;
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`;
  return `vor ${Math.floor(diff / 3600)} h`;
}

export default function MonitorSection() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource('/api/monitor/events');
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as ServiceStatus[];
          setServices(data);
          setLastUpdate(new Date().toISOString());
        } catch {}
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Reconnect nach 5 Sekunden
        setTimeout(connect, 5_000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
    };
  }, []);

  const upCount   = services.filter(s => s.status === 'ok').length;
  const downCount = services.filter(s => s.status === 'error').length;

  return (
    <>
      <div className="section-header">
        <h1>Monitor</h1>
        <span className={`badge ${connected ? 'ok' : 'error'}`}>
          {connected ? 'Live' : 'Verbindung unterbrochen'}
        </span>
        {lastUpdate && (
          <span className="muted" style={{ marginLeft: '0.75rem', fontSize: '0.8rem' }}>
            Letztes Update: {fmt(lastUpdate)}
          </span>
        )}
      </div>

      {services.length === 0 ? (
        <p className="loading-text">Warte auf ersten Check…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <span className="badge ok">{upCount} erreichbar</span>
            {downCount > 0 && <span className="badge error">{downCount} ausgefallen</span>}
            <span className="muted" style={{ fontSize: '0.8rem', alignSelf: 'center' }}>
              Automatische Prüfung alle 10 s · E-Mail-Alert bei Ausfall
            </span>
          </div>

          <div className="services-grid">
            {services.map(s => {
              const dim = s.status === 'unconfigured';
              let badgeClass = '';
              let badgeText  = '';
              if      (s.status === 'unconfigured') { badgeText = 'nicht konfiguriert'; }
              else if (s.status === 'ok')           { badgeClass = 'ok';    badgeText = 'erreichbar'; }
              else                                  { badgeClass = 'error'; badgeText = 'ausgefallen'; }

              return (
                <div key={s.key} className={`service-card${dim ? ' service-card--dim' : ''}`}>
                  <div className="service-card-header">
                    <span className="service-icon">{ICONS[s.key] ?? '🔧'}</span>
                    <span className="service-name">{s.label}</span>
                    {s.status !== 'unconfigured' && s.latency > 0 && (
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

                  {s.status !== 'unconfigured' && (
                    <div className="muted" style={{ fontSize: '0.72rem', marginTop: '0.4rem' }}>
                      Zuletzt geprüft: {fmt(s.lastChecked)}
                      {s.lastChanged && (
                        <> · Status geändert: {fmt(s.lastChanged)} ({ago(s.lastChanged)})</>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
