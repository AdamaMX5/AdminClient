const SERVICE_DEFS: { env: string; label: string }[] = [
  { env: 'AUTH_SERVICE_URL',      label: 'AuthService' },
  { env: 'FREESCHOOL_URL',        label: 'FreeSchool' },
  { env: 'PROFILE_SERVICE_URL',   label: 'ProfileService' },
  { env: 'EMAIL_SERVICE_URL',     label: 'EmailService' },
  { env: 'EXCEPTION_SERVICE_URL', label: 'ExceptionService' },
  { env: 'OBJECT_SERVICE_URL',    label: 'ObjectService' },
  { env: 'MESSAGE_SERVICE_URL',   label: 'MessageService' },
  { env: 'MEDIA_SERVICE_URL',     label: 'MediaService' },
  { env: 'GIT_SERVICE_URL',       label: 'GitService' },
  { env: 'VIRTUALOFFICE_URL',     label: 'VirtualOffice' },
  { env: 'PRESENCE_SERVICE_URL',  label: 'PresenceService' },
  { env: 'LIVEKIT_URL',           label: 'LiveKit' },
  { env: 'RECORDING_SERVICE_URL', label: 'RecordingService' },
];

async function checkUrl(url: string): Promise<{ ok: boolean; code?: number; latency: number; helloMessage?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    let helloMessage: string | undefined;
    try {
      const text = await r.text();
      try {
        const json = JSON.parse(text);
        helloMessage = typeof json === 'string' ? json : (json.message ?? JSON.stringify(json));
      } catch {
        helloMessage = text.trim().slice(0, 300);
      }
    } catch { /* ignore */ }
    return { ok: r.status < 500, code: r.status, latency: Date.now() - start, helloMessage };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

/** Aggregated health of all configured microservices, sourced directly from process.env. */
export async function performHealthCheck() {
  const services = await Promise.all(
    SERVICE_DEFS.map(async (svc) => {
      const url = process.env[svc.env];
      if (!url) return { key: svc.env, label: svc.label, url: null, status: 'unconfigured' as const };
      const check = await checkUrl(url);
      return {
        key: svc.env,
        label: svc.label,
        url,
        status: check.ok ? 'ok' as const : 'error' as const,
        code: check.code,
        latency: check.latency,
        helloMessage: check.helloMessage,
      };
    }),
  );

  return { services };
}
