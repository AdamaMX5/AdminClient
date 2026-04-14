import { EventEmitter } from 'events';

export interface ServiceStatus {
  key: string;
  label: string;
  url: string | null;
  status: 'ok' | 'error' | 'unconfigured';
  code?: number;
  latency: number;
  lastChecked: string;
  lastChanged: string | null;
}

interface ServiceDef {
  key: string;
  label: string;
  env: string;
  /** Endpoint to check — defaults to "/" */
  path?: string;
}

const SERVICE_DEFS: ServiceDef[] = [
  { key: 'auth',       label: 'AuthService',      env: 'AUTH_SERVICE_URL' },
  { key: 'profile',    label: 'ProfileService',    env: 'PROFILE_SERVICE_URL' },
  { key: 'email',      label: 'EmailService',      env: 'EMAIL_SERVICE_URL' },
  { key: 'exception',  label: 'ExceptionService',  env: 'EXCEPTION_SERVICE_URL' },
  { key: 'object',     label: 'ObjectService',     env: 'OBJECT_SERVICE_URL' },
  { key: 'message',    label: 'MessageService',    env: 'MESSAGE_SERVICE_URL' },
  { key: 'recording',  label: 'RecordingService',  env: 'RECORDING_SERVICE_URL', path: '/health' },
  { key: 'media',      label: 'MediaService',      env: 'MEDIA_SERVICE_URL',      path: '/health' },
  { key: 'freeschool', label: 'FreeSchool API',    env: 'FREESCHOOL_URL' },
];

async function probeUrl(baseUrl: string, path = '/'): Promise<{ ok: boolean; code?: number; latency: number }> {
  const url = baseUrl.replace(/\/$/, '') + path;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const r = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return { ok: r.status < 500, code: r.status, latency: Date.now() - start };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

class Watchdog extends EventEmitter {
  private prevState = new Map<string, 'ok' | 'error'>();
  private statuses  = new Map<string, ServiceStatus>();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(intervalMs = 10_000): void {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  getStatuses(): ServiceStatus[] {
    return SERVICE_DEFS.map(def => {
      return this.statuses.get(def.key) ?? {
        key:         def.key,
        label:       def.label,
        url:         process.env[def.env] ?? null,
        status:      'unconfigured',
        latency:     0,
        lastChecked: '',
        lastChanged: null,
      };
    });
  }

  private async poll(): Promise<void> {
    await Promise.all(SERVICE_DEFS.map(def => this.checkService(def)));
    this.emit('update', this.getStatuses());
  }

  private async checkService(def: ServiceDef): Promise<void> {
    const baseUrl = process.env[def.env];
    const now     = new Date().toISOString();
    const prev    = this.statuses.get(def.key);

    if (!baseUrl) {
      this.statuses.set(def.key, {
        key:         def.key,
        label:       def.label,
        url:         null,
        status:      'unconfigured',
        latency:     0,
        lastChecked: now,
        lastChanged: prev?.lastChanged ?? null,
      });
      return;
    }

    const { ok, code, latency } = await probeUrl(baseUrl, def.path ?? '/');
    const newStatus: 'ok' | 'error' = ok ? 'ok' : 'error';
    const prevRaw = this.prevState.get(def.key);
    const changed = prevRaw !== undefined && prevRaw !== newStatus;

    this.prevState.set(def.key, newStatus);
    this.statuses.set(def.key, {
      key:         def.key,
      label:       def.label,
      url:         baseUrl,
      status:      newStatus,
      code,
      latency,
      lastChecked: now,
      lastChanged: changed ? now : (prev?.lastChanged ?? null),
    });

    if (changed) {
      if (newStatus === 'error') {
        console.warn(`[Watchdog] ${def.label} ist DOWN`);
        this.emit('down', { key: def.key, label: def.label, url: baseUrl });
        await this.sendAlert(def.label, baseUrl);
      } else {
        console.info(`[Watchdog] ${def.label} ist wieder UP`);
        this.emit('up', { key: def.key, label: def.label, url: baseUrl });
      }
    }
  }

  private async sendAlert(label: string, serviceUrl: string): Promise<void> {
    const emailUrl = process.env.EMAIL_SERVICE_URL;
    const apiKey   = process.env.EMAIL_API_KEY;
    const to       = process.env.ALERT_EMAIL_TO;
    const from     = process.env.ALERT_EMAIL_FROM ?? 'monitor@freischule.info';

    if (!emailUrl || !apiKey || !to) {
      console.warn(
        `[Watchdog] ${label} ist DOWN — E-Mail-Alert übersprungen` +
        ` (EMAIL_SERVICE_URL, EMAIL_API_KEY oder ALERT_EMAIL_TO fehlt in .env)`
      );
      return;
    }

    try {
      const res = await fetch(`${emailUrl.replace(/\/$/, '')}/emails`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key':    apiKey,
        },
        body: JSON.stringify({
          to,
          from,
          subject: `[Alert] ${label} ist nicht erreichbar`,
          body:    [
            `Der Service ${label} antwortet nicht mehr.`,
            ``,
            `URL:  ${serviceUrl}`,
            `Zeit: ${new Date().toISOString()}`,
          ].join('\n'),
          type:     'alert',
          metadata: { service: label, url: serviceUrl },
        }),
      });

      if (res.ok) {
        console.info(`[Watchdog] Alert-E-Mail für ${label} versendet`);
      } else {
        console.error(`[Watchdog] E-Mail-Versand fehlgeschlagen: HTTP ${res.status}`);
      }
    } catch (err) {
      console.error(`[Watchdog] Fehler beim E-Mail-Versand:`, err);
    }
  }
}

export const watchdog = new Watchdog();
