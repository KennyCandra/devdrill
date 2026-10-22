import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './httpError.js';

/** Header the web UI sends the session token in. A custom header also forces a CORS preflight. */
export const TOKEN_HEADER = 'x-bughunt-token';

export function createSessionToken(): string {
  return randomBytes(24).toString('base64url');
}

export interface SecurityOptions {
  token: string;
  /** Extra origins allowed to call the API, e.g. the Vite dev server. */
  extraOrigins?: string[];
}

/**
 * Any website the user visits can send requests to localhost, and /run executes code,
 * so every /api request must pass these checks (docs/V1_PLAN.md, section 8):
 * 1. Host is this server (blocks DNS rebinding).
 * 2. Origin, if sent, is this server or an allowed dev origin (blocks CSRF).
 * 3. Requests with a body send JSON (a cross-site form can't, without a preflight).
 * 4. The session token from the URL the browser was opened with. Browsers can't add
 *    this header cross-site without a preflight, which this server never approves.
 */
export function apiSecurity({ token, extraOrigins = [] }: SecurityOptions) {
  const expected = Buffer.from(token);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const port = req.socket.localPort;
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!allowedHosts.includes(req.headers.host ?? '')) {
      throw new HttpError(403, 'Unexpected Host header.');
    }

    const origin = req.headers.origin;
    if (origin !== undefined) {
      const allowedOrigins = [...allowedHosts.map((h) => `http://${h}`), ...extraOrigins];
      if (!allowedOrigins.includes(origin)) {
        throw new HttpError(403, 'Cross-origin requests are not allowed.');
      }
    }

    if (hasBody(req) && !isJson(req)) {
      throw new HttpError(415, 'Requests must be JSON.');
    }

    const given = Buffer.from(req.get(TOKEN_HEADER) ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new HttpError(
        401,
        'Missing or wrong session token. Reopen the link from the terminal.',
      );
    }

    next();
  };
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
