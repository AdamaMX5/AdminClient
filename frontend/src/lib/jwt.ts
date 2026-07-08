interface JwtPayload {
  sub?: string;
  email?: string;
  roles?: string[];
}

// Client-side only — reads claims for display/session hydration, never used
// as a trust decision (every service still verifies the signature server-side).
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    // atob() yields a byte-per-char binary string, not UTF-8 text — re-decode
    // so multi-byte characters in the payload (e.g. accented names) survive.
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}
