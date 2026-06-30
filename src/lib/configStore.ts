import fs from 'fs';
import path from 'path';

export interface ServerGroup {
  name: string;
  authServiceUrl: string;
  freeSchoolUrl: string;
  profileUrl?: string;
  emailServiceUrl?: string;
  exceptionServiceUrl?: string;
  objectServiceUrl?: string;
  messageServiceUrl?: string;
  mediaServiceUrl?: string;
  officeUrl?: string;
  presenceUrl?: string;
  liveUrl?: string;
  recordingUrl?: string;
  matrixUrl?: string;
  gitServiceUrl?: string;
  landingUrl?: string;
}

interface ConfigData {
  activeGroup: string;
  groups: ServerGroup[];
}

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');

function persist(data: ConfigData): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

function loadConfig(): ConfigData {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as ConfigData;
  } catch {
    // First run: seed from ALL .env variables
    const initial: ConfigData = {
      activeGroup: 'Standard',
      groups: [{
        name: 'Standard',
        // Core Services
        authServiceUrl: process.env.AUTH_SERVICE_URL ?? '',
        freeSchoolUrl: process.env.FREESCHOOL_URL ?? '',
        // Profile & Communication
        profileUrl: process.env.PROFILE_SERVICE_URL ?? '',
        emailServiceUrl: process.env.EMAIL_SERVICE_URL ?? '',
        exceptionServiceUrl: process.env.EXCEPTION_SERVICE_URL ?? '',
        objectServiceUrl: process.env.OBJECT_SERVICE_URL ?? '',
        messageServiceUrl: process.env.MESSAGE_SERVICE_URL ?? '',
        mediaServiceUrl: process.env.MEDIA_SERVICE_URL ?? '',
        // VirtualOffice Services
        officeUrl: process.env.VIRTUALOFFICE_PRODUCTION_URL ?? '',
        presenceUrl: process.env.PRESENCE_SERVICE_URL ?? '',
        liveUrl: process.env.LIVEKIT_URL ?? '',
        recordingUrl: process.env.RECORDING_SERVICE_URL ?? '',
        // Git abstraction
        gitServiceUrl: process.env.GIT_SERVICE_URL ?? '',
        // FreeSchool public landing page (bare domain, e.g. https://freischule.info)
        landingUrl: process.env.LANDING_URL ?? '',
        // Matrix (optional)
        matrixUrl: '',
      }],
    };
    persist(initial);
    return initial;
  }
}

let cfg = loadConfig();

export function getActiveGroup(): ServerGroup {
  return cfg.groups.find(g => g.name === cfg.activeGroup) ?? cfg.groups[0];
}

export function getAllGroups(): ServerGroup[] {
  return cfg.groups;
}

export function getActiveGroupName(): string {
  return cfg.activeGroup;
}

export function setActiveGroup(name: string): boolean {
  if (!cfg.groups.find(g => g.name === name)) return false;
  cfg.activeGroup = name;
  persist(cfg);
  return true;
}

export function upsertGroup(group: ServerGroup): void {
  const idx = cfg.groups.findIndex(g => g.name === group.name);
  if (idx >= 0) {
    cfg.groups[idx] = group;
  } else {
    cfg.groups.push(group);
  }
  persist(cfg);
}

export function deleteGroup(name: string): { ok: boolean; error?: string } {
  if (cfg.groups.length <= 1) return { ok: false, error: 'Letzte Gruppe kann nicht gelöscht werden' };
  if (cfg.activeGroup === name) return { ok: false, error: 'Aktive Gruppe kann nicht gelöscht werden' };
  cfg.groups = cfg.groups.filter(g => g.name !== name);
  persist(cfg);
  return { ok: true };
}
