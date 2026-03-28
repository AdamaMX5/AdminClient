import { Router, Request, Response } from 'express';
import { requireSession, isTokenExpiring, refreshAuthToken } from '../lib/tokenUtils';

const router = Router();
router.use(requireSession);

// ---------------------------------------------------------------------------
// Service configuration
// ---------------------------------------------------------------------------

interface ServiceConfig {
  urlEnvVar: string;
  tokenType: 'auth' | 'freeschool';
}

const SERVICE_CONFIG: Record<string, ServiceConfig> = {
  auth:             { urlEnvVar: 'AUTH_SERVICE_URL',      tokenType: 'auth' },
  freeschool:       { urlEnvVar: 'FREESCHOOL_URL',        tokenType: 'freeschool' },
  presence:         { urlEnvVar: 'PRESENCE_SERVICE_URL',  tokenType: 'auth' },
  'virtual-office': { urlEnvVar: 'VIRTUAL_OFFICE_URL',   tokenType: 'auth' },
  profil:           { urlEnvVar: 'PROFIL_SERVICE_URL',    tokenType: 'auth' },
  email:            { urlEnvVar: 'EMAIL_SERVICE_URL',     tokenType: 'auth' },
};

const ALL_SERVICES = Object.keys(SERVICE_CONFIG);

interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  request_id?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// GET /api/logs
// ---------------------------------------------------------------------------

router.get('/', async (req: Request, res: Response): Promise<void> => {
  // Resolve auth token, refreshing if needed
  let authToken: string | null = null;
  if (!isTokenExpiring(req.session.authToken)) {
    authToken = req.session.authToken!;
  } else {
    const ok = await refreshAuthToken(req);
    if (ok) authToken = req.session.authToken ?? null;
  }
  const freeSchoolToken: string | null = req.session.freeSchoolToken ?? null;

  const { minutes = '5', level = '', limit = '200', offset = '0' } =
    req.query as Record<string, string>;

  const requestedServices = req.query.services
    ? String(req.query.services)
        .split(',')
        .map(s => s.trim())
        .filter(s => s in SERVICE_CONFIG)
    : ALL_SERVICES;

  const upstreamParams = new URLSearchParams({ minutes, limit, offset });
  if (level) upstreamParams.set('level', level);
  const qs = `?${upstreamParams}`;

  // Fetch all services in parallel
  const results = await Promise.all(
    requestedServices.map(async (service) => {
      const config = SERVICE_CONFIG[service];
      const baseUrl = process.env[config.urlEnvVar];
      if (!baseUrl) {
        return { service, error: `URL nicht konfiguriert (${config.urlEnvVar})` };
      }

      const token = config.tokenType === 'auth' ? authToken : freeSchoolToken;
      if (!token) {
        return { service, error: `Kein Token verfügbar (${config.tokenType})` };
      }

      try {
        const upstream = await fetch(`${baseUrl}/admin/logs${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        });

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => '');
          return { service, error: `HTTP ${upstream.status}: ${text.slice(0, 200)}` };
        }

        const raw: unknown = await upstream.json();
        const entries: LogEntry[] = (
          Array.isArray(raw) ? raw : ((raw as { logs?: LogEntry[] }).logs ?? [])
        ).map((e: LogEntry) => ({ ...e, service }));

        return { service, logs: entries };
      } catch (err: unknown) {
        return { service, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  // Merge logs and collect per-service errors
  const logs: LogEntry[] = [];
  const errors: Record<string, string> = {};

  for (const r of results) {
    if ('error' in r && r.error) {
      errors[r.service] = r.error as string;
    } else if ('logs' in r && r.logs) {
      logs.push(...(r.logs as LogEntry[]));
    }
  }

  // Sort merged results newest-first
  logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  res.json({ logs, errors, total: logs.length });
});

export default router;
