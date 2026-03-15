import { Request, Response, NextFunction } from 'express';

/**
 * Decodes a JWT payload without verifying signature.
 * Returns null if the token is malformed.
 */
function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    return JSON.parse(Buffer.from(part, 'base64url').toString());
  } catch {
    return null;
  }
}

/**
 * Returns true if the token is missing or expires within `bufferSeconds`.
 */
export function isTokenExpiring(token: string | undefined, bufferSeconds = 60): boolean {
  if (!token) return true;
  const payload = decodePayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return Date.now() / 1000 > payload.exp - bufferSeconds;
}

/**
 * Refreshes the AuthService access token using the stored refresh token.
 * Updates req.session.authToken on success.
 * Returns false if refresh fails.
 */
export async function refreshAuthToken(req: Request): Promise<boolean> {
  const refreshToken = req.session.authRefreshToken;
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${process.env.AUTH_SERVICE_URL}/user/refresh`, {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });
    if (!res.ok) return false;
    const data = await res.json() as { access_token: string };
    req.session.authToken = data.access_token;
    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware: ensures the request has a valid session.
 * Returns 401 JSON if not authenticated.
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userEmail) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

/**
 * Generic proxy helper — forwards the request to `targetUrl` with a Bearer token.
 * Handles JSON bodies and auto-refreshes the AuthService token if needed.
 */
export async function proxyToService(
  req: Request,
  res: Response,
  targetUrl: string,
  token: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method);

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? JSON.stringify(req.body) : undefined,
  });

  const contentType = upstream.headers.get('content-type') ?? '';
  const disposition = upstream.headers.get('content-disposition');

  if (disposition) res.setHeader('Content-Disposition', disposition);

  if (contentType.includes('application/json')) {
    const data: unknown = await upstream.json();
    res.status(upstream.status).json(data);
  } else {
    const text = await upstream.text();
    res.status(upstream.status).send(text);
  }
}
