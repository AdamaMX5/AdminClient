import type { ServiceConfig } from '../types';

/**
 * Service base URLs, baked in at build time from VITE_*_URL env vars.
 * Each deployment (Produktion, Staging, …) builds the client with its own
 * .env — there is no runtime switching between environments.
 */
export const services: ServiceConfig = {
  authServiceUrl: import.meta.env.VITE_AUTH_SERVICE_URL ?? '',
  freeSchoolUrl: import.meta.env.VITE_FREESCHOOL_URL ?? '',
  officeUrl: import.meta.env.VITE_VIRTUALOFFICE_URL || undefined,
  liveUrl: import.meta.env.VITE_LIVEKIT_URL || undefined,
  recordingUrl: import.meta.env.VITE_RECORDING_SERVICE_URL || undefined,
  profileUrl: import.meta.env.VITE_PROFILE_SERVICE_URL || undefined,
  gitServiceUrl: import.meta.env.VITE_GIT_SERVICE_URL || undefined,
  mediaServiceUrl: import.meta.env.VITE_MEDIA_SERVICE_URL || undefined,
  landingUrl: import.meta.env.VITE_LANDING_URL || undefined,
};
