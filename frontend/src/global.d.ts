// Injected by Vite at build time (see vite.config.ts) — short git hash of the build.
declare const __GIT_HASH__: string;

interface ImportMetaEnv {
  readonly VITE_AUTH_SERVICE_URL?: string;
  readonly VITE_FREESCHOOL_URL?: string;
  readonly VITE_VIRTUALOFFICE_URL?: string;
  readonly VITE_LIVEKIT_URL?: string;
  readonly VITE_RECORDING_SERVICE_URL?: string;
  readonly VITE_PROFILE_SERVICE_URL?: string;
  readonly VITE_GIT_SERVICE_URL?: string;
  readonly VITE_MEDIA_SERVICE_URL?: string;
  readonly VITE_LANDING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
