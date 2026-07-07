import type { HealthResult, ServiceConfig } from '../types';
import { loadSession } from './session';

export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = loadSession().authToken;
  if (!token) throw new Error('Nicht angemeldet (AuthService)');
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

export async function fsFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = loadSession().freeSchoolToken;
  if (!token) throw new Error('Nicht angemeldet (FreeSchool)');
  return fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

export async function checkUrl(url: string): Promise<{ ok: boolean; code?: number; latency: number; helloMessage?: string; version?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    // GET (not HEAD) so we can read the "Hello World" body and confirm nginx routed
    // to the right service.
    const r = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);

    let helloMessage: string | undefined;
    let version: string | undefined;
    try {
      const text = await r.text();
      try {
        const json = JSON.parse(text);
        helloMessage = typeof json === 'string' ? json : (json.message ?? JSON.stringify(json));
        if (json && typeof json === 'object' && typeof json.version === 'string') version = json.version;
      } catch {
        helloMessage = text.trim().slice(0, 200);
      }
    } catch { /* body unreadable (e.g. CORS) — leave undefined */ }

    return { ok: r.status < 500, code: r.status, latency: Date.now() - start, helloMessage, version };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

const SERVICE_DEFS: { key: keyof ServiceConfig; label: string; icon: string }[] = [
  { key: 'authServiceUrl', label: 'AuthService',   icon: '🔐' },
  { key: 'gitServiceUrl',  label: 'GitService',    icon: '🔧' },
  { key: 'mediaServiceUrl', label: 'MediaService', icon: '🖼️' },
  { key: 'officeUrl',      label: 'VirtualOffice', icon: '🏢' },
  { key: 'landingUrl',     label: 'FreeSchule',    icon: '🏫' },
  { key: 'liveUrl',        label: 'LiveKit',       icon: '🎥' },
  { key: 'recordingUrl',   label: 'Recording',     icon: '🎙️' },
  { key: 'profileUrl',     label: 'Profile',       icon: '👤' },
];

export async function checkAllServices(services: ServiceConfig): Promise<HealthResult[]> {
  return Promise.all(
    SERVICE_DEFS.map(async svc => {
      const url = services[svc.key] as string | undefined;
      if (!url) return { key: svc.key, label: svc.label, icon: svc.icon, url: null, status: 'unconfigured' as const };
      const check = await checkUrl(url);
      return {
        key: svc.key,
        label: svc.label,
        icon: svc.icon,
        url,
        status: check.ok ? 'ok' as const : 'error' as const,
        code: check.code,
        latency: check.latency,
        helloMessage: check.helloMessage,
        version: check.version,
      };
    })
  );
}
