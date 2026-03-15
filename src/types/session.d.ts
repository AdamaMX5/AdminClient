import 'express-session';

declare module 'express-session' {
  interface SessionData {
    // AuthService (auth.freischule.info) — JWT RS256, 15min access + refresh cookie
    authToken?: string;
    authRefreshToken?: string;
    // FreeSchool (freischule.info) — JWT HS256, 24h
    freeSchoolToken?: string;
    // Shared
    userEmail?: string;
  }
}
