import { Router, Request, Response } from 'express';
import { getActiveGroup, getActiveGroupName, ServerGroup } from '../lib/configStore';

const SERVICE_DEFS: { key: keyof ServerGroup; label: string }[] = [
  { key: 'authServiceUrl',     label: 'AuthService' },
  { key: 'freeSchoolUrl',      label: 'FreeSchool' },
  { key: 'profileUrl',         label: 'ProfileService' },
  { key: 'emailServiceUrl',    label: 'EmailService' },
  { key: 'exceptionServiceUrl',label: 'ExceptionService' },
  { key: 'objectServiceUrl',   label: 'ObjectService' },
  { key: 'messageServiceUrl',  label: 'MessageService' },
  { key: 'mediaServiceUrl',    label: 'MediaService' },
  { key: 'officeUrl',          label: 'VirtualOffice' },
  { key: 'presenceUrl',        label: 'PresenceService' },
  { key: 'liveUrl',            label: 'LiveKit' },
  { key: 'recordingUrl',       label: 'RecordingService' },
  { key: 'matrixUrl',          label: 'Matrix' },
];

async function checkUrl(url: string): Promise<{ ok: boolean; code?: number; latency: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let r = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (r.status === 405) {
      // Service doesn't support HEAD — retry with GET
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

/** Shared health-check logic — used by both the internal and public endpoints. */
export async function performHealthCheck() {
  const group = getActiveGroup() as Record<string, string | undefined>;
  const activeGroup = getActiveGroupName();

  const services = await Promise.all(
    SERVICE_DEFS.map(async (svc) => {
      const url = group[svc.key as string];
      if (!url) return { key: svc.key, label: svc.label, url: null, status: 'unconfigured' };
      const check = await checkUrl(url);
      return {
        key: svc.key,
        label: svc.label,
        url,
        status: check.ok ? 'ok' : 'error',
        code: check.code,
        latency: check.latency,
      };
    }),
  );

  return { activeGroup, services };
}

const router = Router();

/** GET /api/services/health  — used by the Admin UI frontend */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  res.json(await performHealthCheck());
});

export default router;
