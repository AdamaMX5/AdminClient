export interface ServiceConfig {
  authServiceUrl: string;
  freeSchoolUrl: string;
  officeUrl?: string;
  liveUrl?: string;
  recordingUrl?: string;
  profileUrl?: string;
  gitServiceUrl?: string;
  mediaServiceUrl?: string;
  landingUrl?: string;
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
  helloMessage?: string;
  version?: string;
}
