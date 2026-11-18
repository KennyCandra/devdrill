import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './httpError.js';

/** Header the web UI sends the session token in. A custom header also forces a CORS preflight. */
export const TOKEN_HEADER = 'x-devdrill-token';

export function createSessionToken(): string {
  return randomBytes(24).toString('base64url');
}

export interface SecurityOptions {
  /**
   * Hosted mode only: the token every API request must send. Undefined locally, where
   * there is no token (see the comment on apiSecurity).
   */
  token?: string;
  /** Extra origins allowed to call the API, e.g. the Vite dev server. */
  extraOrigins?: string[];
  /** Hosted mode: the public URL the app is served at (e.g. https://x.up.railway.app). */
  publicUrl?: string;
}

/**
 * Any website the user visits can send requests to localhost, and /run executes code,
 * so every /api request must pass these checks (docs/V1_PLAN.md, section 8):
 * 1. Host is this server (blocks DNS rebinding).
 * 2. Origin, if sent, is this server or an allowed dev origin (blocks CSRF).
 * 3. Requests with a body send JSON (a cross-site form can't, without a preflight).
 * 4. Hosted only: the session token from the link the server printed. Browsers can't add
 *    this header cross-site without a preflight, which this server never approves.
 *
 * Locally there is no token, so checks 1 to 3 are the whole protection. They stop a
 * web page in the user's browser: a page on another site can't send a request that
 * passes the Host check, and a browser always sends an Origin on a cross-site POST, and
 * a cross-site request can't send JSON without a preflight this server refuses. Checks
 * 1 to 3 don't stop other programs on this machine, which can send any request they like.
 * Hosted mode keeps check 4 because the server is reachable from the internet.
 */
export function apiSecurity({ token, extraOrigins = [], publicUrl }: SecurityOptions) {
  const expected = token === undefined ? null : Buffer.from(token);
  const publicOrigin = publicUrl ? [new URL(publicUrl).origin] : [];

  return (req: Request, res: Response, next: NextFunction): void => {
    res.set('X-Content-Type-Options', 'nosniff');
    const allowedHosts = hostsFor(req, publicUrl);
    if (!allowedHosts.includes(req.headers.host ?? '')) {
      throw new HttpError(403, 'Unexpected Host header.');
    }

    const origin = req.headers.origin;
    if (origin !== undefined) {
      const allowedOrigins = [
        ...hostsFor(req).map((h) => `http://${h}`),
        ...publicOrigin,
        ...extraOrigins,
      ];
      if (!allowedOrigins.includes(origin)) {
        throw new HttpError(403, 'Cross-origin requests are not allowed.');
      }
    }

    if (hasBody(req) && !isJson(req)) {
      throw new HttpError(415, 'Requests must be JSON.');
    }

    if (expected !== null) {
      const given = Buffer.from(req.get(TOKEN_HEADER) ?? '');
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw new HttpError(
          401,
          'Missing or wrong access token. Open the full link you were given.',
        );
      }
    }

    next();
  };
}

/**
 * For the web UI's static files: the Host check (so a rebinding site can't read the app),
 * plus headers that stop other sites from framing it and lock down what the page can load.
 * The token is never in these files; the page reads it from the URL fragment.
 */
export const uiSecurity =
  (publicUrl?: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!hostsFor(req, publicUrl).includes(req.headers.host ?? '')) {
      res.status(403).type('text/plain').send('Unexpected Host header.');
      return;
    }
    res.set({
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      'X-Content-Type-Options': 'nosniff',
      // For browsers too old for CSP frame-ancestors.
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    next();
  };

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Monaco sets inline styles for layout and syntax colors.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

/** This server's own addresses, plus the public host in hosted mode. */
function hostsFor(req: Request, publicUrl?: string): string[] {
  const port = req.socket.localPort;
  return [
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    ...(publicUrl ? [new URL(publicUrl).host] : []),
  ];
}

function hasBody(req: Request): boolean {
  const length = req.headers['content-length'];
  return req.headers['transfer-encoding'] !== undefined || (length !== undefined && length !== '0');
}

/** Checks the header itself: `req.is()` returns null when there is no body. */
function isJson(req: Request): boolean {
  const type = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
  return type === 'application/json';
}
