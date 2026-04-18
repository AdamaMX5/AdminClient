import type { Session } from '../types';

const KEY = 'freischule_admin_session';

export function loadSession(): Session {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Session;
  } catch {}
  return {};
}

export function saveSession(s: Session): void {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}
