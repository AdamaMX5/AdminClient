import { Router, Request, Response } from 'express';
import {
  requireSession,
  isTokenExpiring,
  refreshAuthToken,
  proxyToService,
} from '../lib/tokenUtils';
import { getActiveGroup } from '../lib/configStore';

const router = Router();
router.use(requireSession);

/** Ensures we have a fresh AuthService token, refreshing if needed. */
async function getAuthToken(req: Request, res: Response): Promise<string | null> {
  if (isTokenExpiring(req.session.authToken)) {
    const ok = await refreshAuthToken(req);
    if (!ok) {
      res.status(401).json({ error: 'AuthService session expired — please log in again' });
      return null;
    }
  }
  return req.session.authToken!;
}

function authUrl(path: string): string {
  return `${getActiveGroup().authServiceUrl}${path}`;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** GET /api/auth-service/admin/users */
router.get('/admin/users', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl('/admin/users'), token);
});

/** GET /api/auth-service/admin/users/:id */
router.get('/admin/users/:id', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl(`/admin/users/${req.params.id}`), token);
});

/** PATCH /api/auth-service/admin/users/:id */
router.patch('/admin/users/:id', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl(`/admin/users/${req.params.id}`), token);
});

// ---------------------------------------------------------------------------
// Roles & Permissions
// ---------------------------------------------------------------------------

/** POST /api/auth-service/admin/set_roles */
router.post('/admin/set_roles', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl('/admin/set_roles'), token);
});

/** POST /api/auth-service/admin/set_permissions */
router.post('/admin/set_permissions', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl('/admin/set_permissions'), token);
});

/** POST /api/auth-service/admin/upsert_permission */
router.post('/admin/upsert_permission', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl('/admin/upsert_permission'), token);
});

/** POST /api/auth-service/admin/remove_permission */
router.post('/admin/remove_permission', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl('/admin/remove_permission'), token);
});

// ---------------------------------------------------------------------------
// User Import (JSON file upload)
// ---------------------------------------------------------------------------

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

/** POST /api/auth-service/admin/users/import */
router.post(
  '/admin/users/import',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const token = await getAuthToken(req, res);
    if (!token) return;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const FormData = (await import('node:buffer')).Blob;
    // Use native FormData (Node 18+)
    const form = new (globalThis as any).FormData();
    form.append(
      'file',
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname,
    );

    const upstream = await fetch(authUrl('/admin/users/import'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const data: unknown = await upstream.json();
    res.status(upstream.status).json(data);
  },
);

// ---------------------------------------------------------------------------
// JWT Key Management
// ---------------------------------------------------------------------------

/** POST /api/auth-service/admin/jwt/keys */
router.post('/admin/jwt/keys', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl('/admin/jwt/keys'), token);
});

/** GET /api/auth-service/admin/jwt/key-storage */
router.get('/admin/jwt/key-storage', async (req: Request, res: Response): Promise<void> => {
  const token = await getAuthToken(req, res);
  if (!token) return;
  await proxyToService(req, res, authUrl('/admin/jwt/key-storage'), token);
});

// ---------------------------------------------------------------------------
// Public JWT key (no auth needed)
// ---------------------------------------------------------------------------

/** GET /api/auth-service/jwt/public-key */
router.get('/jwt/public-key', async (_req: Request, res: Response): Promise<void> => {
  const upstream = await fetch(authUrl('/jwt/public-key'));
  const data: unknown = await upstream.json();
  res.status(upstream.status).json(data);
});

export default router;
