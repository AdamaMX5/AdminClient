import { Router, Request, Response } from 'express';
import { watchdog } from '../lib/watchdog';

const router = Router();

/** GET /api/monitor/status — aktueller Snapshot aller Services */
router.get('/status', (_req: Request, res: Response): void => {
  res.json(watchdog.getStatuses());
});

/** GET /api/monitor/events — SSE-Stream, sendet bei jedem Poll-Zyklus ein Update */
router.get('/events', (req: Request, res: Response): void => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (data: unknown): void => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Sofortiger Snapshot beim Verbinden
  send(watchdog.getStatuses());

  watchdog.on('update', send);

  req.on('close', () => {
    watchdog.removeListener('update', send);
  });
});

export default router;
