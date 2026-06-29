export interface ServerGroup {
  name: string;
  authServiceUrl: string;
  freeSchoolUrl: string;
  officeUrl?: string;
  presenceUrl?: string;
  liveUrl?: string;
  recordingUrl?: string;
  profileUrl?: string;
  matrixUrl?: string;
  gitServiceUrl?: string;
}

export interface Config {
  activeGroup: string;
  groups: ServerGroup[];
}

export interface Session {
  userEmail?: string;
  authToken?: string;
  freeSchoolToken?: string;
}

export interface HealthResult {
  key: string;
  label: string;
  url: string | null;
  status: 'ok' | 'error' | 'unconfigured';
  code?: number;
  latency?: number;
}
