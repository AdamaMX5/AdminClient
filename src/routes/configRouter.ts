import { Router, Request, Response } from 'express';
import { requireSession } from '../lib/tokenUtils';
import * as configStore from '../lib/configStore';

const router = Router();
router.use(requireSession);

/** GET /api/config */
router.get('/', (_req: Request, res: Response): void => {
  res.json({
    activeGroup: configStore.getActiveGroupName(),
    groups: configStore.getAllGroups(),
  });
});

/** POST /api/config/active — { name: string } */
router.post('/active', (req: Request, res: Response): void => {
  const { name } = req.body as { name?: string };
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  const ok = configStore.setActiveGroup(name);
  if (!ok) { res.status(404).json({ error: 'Gruppe nicht gefunden' }); return; }
  res.json({ ok: true, activeGroup: name });
});

/** POST /api/config/groups — create or update */
router.post('/groups', (req: Request, res: Response): void => {
  const { name, authServiceUrl, freeSchoolUrl, officeUrl, presenceUrl, liveUrl, recordingUrl, profileUrl, matrixUrl } =
    req.body as Record<string, string>;
  if (!name || !authServiceUrl || !freeSchoolUrl) {
    res.status(400).json({ error: 'name, authServiceUrl und freeSchoolUrl sind erforderlich' });
    return;
  }
  configStore.upsertGroup({ name, authServiceUrl, freeSchoolUrl, officeUrl, presenceUrl, liveUrl, recordingUrl, profileUrl, matrixUrl });
  res.json({ ok: true });
});

/** DELETE /api/config/groups/:name */
router.delete('/groups/:name', (req: Request, res: Response): void => {
  const result = configStore.deleteGroup(req.params.name);
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.json({ ok: true });
});

export default router;
