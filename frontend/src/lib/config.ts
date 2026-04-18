import type { Config, ServerGroup } from '../types';

const KEY = 'freischule_admin_config';

export function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Config;
  } catch {}
  return { activeGroup: '', groups: [] };
}

export function saveConfig(cfg: Config): void {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function getActiveGroup(cfg: Config): ServerGroup {
  return cfg.groups.find(g => g.name === cfg.activeGroup) ?? cfg.groups[0] ?? ({} as ServerGroup);
}
