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
  if (!payload) return true;
  if (typeof payload.exp !== 'number') return false; // kein exp → als gültig behandeln
  return Date.now() / 1000 > payload.exp - bufferSeconds;
}

/**
 * Middleware: requires a valid non-expired Bearer JWT in the Authorization header.
 */
export function requireJwt(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const token = auth.slice(7);
  if (isTokenExpiring(token, 0)) {
    res.status(401).json({ error: 'Token expired' });
    return;
  }
  next();
}
