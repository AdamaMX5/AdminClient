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

async function checkUrl(url: string): Promise<{ ok: boolean; code?: number; latency: number; helloMessage?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    let helloMessage: string | undefined;
    try {
      const text = await r.text();
      try {
        const json = JSON.parse(text);
        helloMessage = typeof json === 'string' ? json : (json.message ?? JSON.stringify(json));
      } catch {
        helloMessage = text.trim().slice(0, 300);
      }
    } catch { /* ignore */ }
    return { ok: r.status < 500, code: r.status, latency: Date.now() - start, helloMessage };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

/** Shared health-check logic — used by both the internal and public endpoints. */
export async function performHealthCheck() {  const group = getActiveGroup() as unknown as Record<string, string | undefined>;  const activeGroup = getActiveGroupName();  const services = await Promise.all(
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
        helloMessage: check.helloMessage,
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
