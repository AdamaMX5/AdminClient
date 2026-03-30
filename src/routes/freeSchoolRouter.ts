import { Router, Request, Response } from 'express';
import { requireSession, proxyToService } from '../lib/tokenUtils';
import { getActiveGroup } from '../lib/configStore';

const router = Router();
router.use(requireSession);

function fsUrl(path: string): string {
  return `${getActiveGroup().freeSchoolUrl}${path}`;
}

function getFreeSchoolToken(req: Request, res: Response): string | null {
  if (!req.session.freeSchoolToken) {
    res.status(401).json({ error: 'Not logged in to FreeSchool' });
    return null;
  }
  return req.session.freeSchoolToken;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** GET /api/freeschool/admin/users */
router.get('/admin/users', async (req: Request, res: Response): Promise<void> => {
  const token = getFreeSchoolToken(req, res);
  if (!token) return;
  await proxyToService(req, res, fsUrl('/admin/users'), token);
});

/** PUT /api/freeschool/admin/user/:id/roles */
router.put('/admin/user/:id/roles', async (req: Request, res: Response): Promise<void> => {
  const token = getFreeSchoolToken(req, res);
  if (!token) return;
  await proxyToService(req, res, fsUrl(`/admin/user/${req.params.id}/roles`), token);
});

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

/** GET /api/freeschool/admin/export/users
 *  Returns full user list with hashed_password + roles for migration.
 */
router.get('/admin/export/users', async (req: Request, res: Response): Promise<void> => {
  const token = getFreeSchoolToken(req, res);
  if (!token) return;
  await proxyToService(req, res, fsUrl('/admin/export/users'), token);
});

/** GET /api/freeschool/admin/backup — SQL dump */
router.get('/admin/backup', async (req: Request, res: Response): Promise<void> => {
  const token = getFreeSchoolToken(req, res);
  if (!token) return;
  await proxyToService(req, res, fsUrl('/admin/backup'), token);
});

/** GET /api/freeschool/admin/backup/json — JSON dump */
router.get('/admin/backup/json', async (req: Request, res: Response): Promise<void> => {
  const token = getFreeSchoolToken(req, res);
  if (!token) return;
  await proxyToService(req, res, fsUrl('/admin/backup/json'), token);
});

/** POST /api/freeschool/admin/import/json */
router.post('/admin/import/json', async (req: Request, res: Response): Promise<void> => {
  const token = getFreeSchoolToken(req, res);
  if (!token) return;
  await proxyToService(req, res, fsUrl('/admin/import/json'), token);
});

/** POST /api/freeschool/admin/import — SQL import */
router.post('/admin/import', async (req: Request, res: Response): Promise<void> => {
  const token = getFreeSchoolToken(req, res);
  if (!token) return;
  await proxyToService(req, res, fsUrl('/admin/import'), token);
});

/** GET /api/freeschool/admin/reset-sequences */
router.get('/admin/reset-sequences', async (req: Request, res: Response): Promise<void> => {
  const token = getFreeSchoolToken(req, res);
  if (!token) return;
  await proxyToService(req, res, fsUrl('/admin/reset-sequences'), token);
});

export default router;
