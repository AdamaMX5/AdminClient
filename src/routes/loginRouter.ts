import { Router, Request, Response } from 'express';
import { getActiveGroup } from '../lib/configStore';

const router = Router();

/**
 * POST /api/login
 * Body: { email, password }
 *
 * Attempts login against AuthService and FreeSchool in parallel.
 * Stores tokens in session. Returns which services succeeded.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const { authServiceUrl, freeSchoolUrl } = getActiveGroup();

  // Simple device fingerprint derived from the incoming request (server-side proxy)
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
    ?? req.socket.remoteAddress
    ?? 'unknown';
  const ua = req.headers['user-agent'] ?? 'unknown';
  const device_fingerprint = Buffer.from(`${ip}|${ua}`).toString('base64').slice(0, 32);
  const device_name = 'AdminClient';

  let authOk = false;
  let freeSchoolOk = false;

  // --- AuthService login ---
  if (authServiceUrl) {
    try {
      const r = await fetch(`${authServiceUrl}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, device_fingerprint, device_name }),
      });

      if (r.ok) {
        const data = await r.json() as {
          access_token?: string;
          status?: string;
        };

        if (data.access_token) {
          req.session.authToken = data.access_token;

          // Capture the HttpOnly refresh token from Set-Cookie
          const setCookie = r.headers.get('set-cookie') ?? '';
          const match = setCookie.match(/refresh_token=([^;]+)/);
          if (match) req.session.authRefreshToken = match[1];

          req.session.userEmail = email;
          authOk = true;
        }
      }
    } catch {
      // AuthService unreachable — continue
    }
  }

  // --- FreeSchool login ---
  if (freeSchoolUrl) {
    try {
      const r = await fetch(`${freeSchoolUrl}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (r.ok) {
        const data = await r.json() as { jwt?: string; status?: string };

        if (data.jwt) {
          req.session.freeSchoolToken = data.jwt;
          req.session.userEmail ??= email;
          freeSchoolOk = true;
        }
      }
    } catch {
      // FreeSchool unreachable — continue
    }
  }

  if (!authOk && !freeSchoolOk) {
    res.status(401).json({ error: 'Login failed on all services' });
    return;
  }

  res.json({
    email,
    services: {
      authService: authOk,
      freeSchool: freeSchoolOk,
    },
  });
});

/**
 * POST /api/logout
 */
router.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy(() => {
    res.json({ status: 'logged_out' });
  });
});

/**
 * GET /api/me
 */
router.get('/me', (req: Request, res: Response): void => {
  if (!req.session.userEmail) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({
    email: req.session.userEmail,
    services: {
      authService: !!req.session.authToken,
      freeSchool: !!req.session.freeSchoolToken,
    },
  });
});

export default router;
