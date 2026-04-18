import type { HealthResult, ServerGroup } from '../types';
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

export async function checkUrl(url: string): Promise<{ ok: boolean; code?: number; latency: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let r = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (r.status === 405) {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), 5000);
      r = await fetch(url, { method: 'GET', signal: c2.signal });
      clearTimeout(t2);
    }
    return { ok: r.status < 500, code: r.status, latency: Date.now() - start };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

const SERVICE_DEFS: { key: keyof ServerGroup; label: string; icon: string }[] = [
  { key: 'authServiceUrl', label: 'AuthService',   icon: '🔐' },
  { key: 'freeSchoolUrl',  label: 'FreeSchool API', icon: '🏫' },
  { key: 'officeUrl',      label: 'Office',         icon: '📄' },
  { key: 'presenceUrl',    label: 'Presence',       icon: '📡' },
  { key: 'liveUrl',        label: 'LiveKit',        icon: '🎥' },
  { key: 'recordingUrl',   label: 'Recording',      icon: '🎙️' },
  { key: 'profileUrl',     label: 'Profile',        icon: '👤' },
  { key: 'matrixUrl',      label: 'Matrix',         icon: '💬' },
];

export async function checkAllServices(group: ServerGroup): Promise<HealthResult[]> {
  return Promise.all(
    SERVICE_DEFS.map(async svc => {
      const url = group[svc.key] as string | undefined;
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
      };
    })
  );
}
