import { Router, Request, Response } from 'express';
import { requireSession, isTokenExpiring, refreshAuthToken } from '../lib/tokenUtils';

const router = Router();
router.use(requireSession);

/**
 * GET /api/migration/preview
 *
 * Fetches users from FreeSchool export and returns a preview of how they
 * would be mapped to AuthService UserImportItem format.
 *
 * FreeSchool UserExportResponse  →  AuthService UserImportItem
 * ─────────────────────────────────────────────────────────────
 * id                             →  (ignored — new IDs assigned)
 * email                          →  email
 * hashed_password (argon2)       →  hashed_password
 * roles[].name                   →  roles: string[]
 * profile.full_name              →  comment (best-effort)
 *
 * NOTE: Password hashes are INCOMPATIBLE (argon2 vs bcrypt).
 * Migrated users will have their hashed_password set but AuthService
 * uses bcrypt. They will need to reset passwords unless AuthService
 * is updated to support argon2 verification.
 */
router.get('/preview', async (req: Request, res: Response): Promise<void> => {
  const token = req.session.freeSchoolToken;
  if (!token) {
    res.status(401).json({ error: 'Not logged in to FreeSchool' });
    return;
  }

  const r = await fetch(`${process.env.FREESCHOOL_URL}/admin/export/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) {
    res.status(r.status).json({ error: 'FreeSchool export failed' });
    return;
  }

  const users = await r.json() as FreeSchoolExportUser[];
  const mapped = users.map(mapUser);

  res.json({
    count: mapped.length,
    warning:
      'Password hashes are argon2 (FreeSchool) but AuthService expects bcrypt. ' +
      'Imported users must reset their passwords.',
    users: mapped,
  });
});

/**
 * POST /api/migration/run
 *
 * Exports users from FreeSchool, maps them, and imports them into AuthService.
 * Returns a summary of created / updated / skipped counts.
 */
router.post('/run', async (req: Request, res: Response): Promise<void> => {
  const fsToken = req.session.freeSchoolToken;
  if (!fsToken) {
    res.status(401).json({ error: 'Not logged in to FreeSchool' });
    return;
  }

  if (isTokenExpiring(req.session.authToken)) {
    const ok = await refreshAuthToken(req);
    if (!ok) {
      res.status(401).json({ error: 'AuthService session expired — please log in again' });
      return;
    }
  }
  const authToken = req.session.authToken!;

  // 1. Export from FreeSchool
  const exportRes = await fetch(`${process.env.FREESCHOOL_URL}/admin/export/users`, {
    headers: { Authorization: `Bearer ${fsToken}` },
  });

  if (!exportRes.ok) {
    res.status(exportRes.status).json({ error: 'FreeSchool export failed' });
    return;
  }

  const users = await exportRes.json() as FreeSchoolExportUser[];
  const importItems = users.map(mapUser);

  // 2. Write to a temp JSON and POST to AuthService /admin/users/import
  const jsonBlob = new Blob([JSON.stringify(importItems)], { type: 'application/json' });
  const form = new (globalThis as any).FormData();
  form.append('file', jsonBlob, 'migration.json');

  const importRes = await fetch(`${process.env.AUTH_SERVICE_URL}/admin/users/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: form,
  });

  const result: unknown = await importRes.json();
  res.status(importRes.status).json(result);
});

// ---------------------------------------------------------------------------
// Types & mapping
// ---------------------------------------------------------------------------

interface FreeSchoolExportUser {
  id: string;
  email: string;
  hashed_password?: string;
  roles?: Array<{ name: string } | string>;
  profile?: {
    full_name?: string;
    bio?: string;
    avatar_url?: string;
  };
}

interface AuthServiceImportItem {
  email: string;
  hashed_password?: string;
  roles?: string[];
  comment?: string;
}

function mapUser(u: FreeSchoolExportUser): AuthServiceImportItem {
  const roles = (u.roles ?? []).map((r) =>
    typeof r === 'string' ? r : r.name,
  );

  return {
    email: u.email,
    hashed_password: u.hashed_password,
    roles,
    comment: u.profile?.full_name
      ? `Migrated from FreeSchool — ${u.profile.full_name}`
      : 'Migrated from FreeSchool',
  };
}

export default router;
