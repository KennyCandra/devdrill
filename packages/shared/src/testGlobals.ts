/**
 * Type declarations for the Vitest globals challenge tests use (describe, it, expect, vi…).
 * TypeScript challenges need them so the editor and the type checker don't report
 * "Cannot find name 'describe'". Kept loose on purpose: tests aren't what players fix,
 * so anything Vitest allows (it.each, expect.any, vi.fn…) must type-check too.
 *
 * This is a runtime string, so it lives outside the types-only index.ts. It's imported by
 * the web editor (packages/web) and the challenge type check (scripts/), never the server.
 */
export const TEST_GLOBALS_DTS = `
type TestFn = () => void | Promise<void>;
// Callable like Vitest's own, plus any member (.each, .concurrent…) left untyped.
type Loose<F> = F & { [member: string]: any };
declare const describe: Loose<(name: string, fn: () => void) => void>;
declare const it: Loose<(name: string, fn: TestFn, timeout?: number) => void>;
declare const test: Loose<(name: string, fn: TestFn, timeout?: number) => void>;
declare function beforeAll(fn: TestFn): void;
declare function afterAll(fn: TestFn): void;
declare function beforeEach(fn: TestFn): void;
declare function afterEach(fn: TestFn): void;
// Matchers are loosely typed: any expect(...).toSomething(...) call is accepted,
// and so are asymmetric matchers like expect.any(Number).
declare const expect: Loose<(actual: unknown) => any>;
declare const vi: { [member: string]: any };
`;

/**
 * Type declarations for Express and Node. Workspaces have no node_modules, so the editor and
 * the type checker can't read the real packages' types. The common parts are typed, and
 * anything else is allowed, so correct code is never underlined just for being unlisted.
 */
export const EXPRESS_DTS = `
declare const Buffer: any;
declare module 'node:*';
declare module 'express' {
  export interface Request {
    method: string;
    path: string;
    originalUrl: string;
    params: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
    body: any;
    headers: Record<string, string | string[] | undefined>;
    get(name: string): string | undefined;
    [member: string]: any;
  }
  export interface Response {
    locals: Record<string, any>;
    headersSent: boolean;
    status(code: number): Response;
    json(body?: unknown): Response;
    send(body?: unknown): Response;
    sendStatus(code: number): Response;
    set(name: string, value: string): Response;
    set(fields: Record<string, string>): Response;
    end(body?: unknown): Response;
    [member: string]: any;
  }
  export type NextFunction = (err?: unknown) => void;
  export type RequestHandler = (req: Request, res: Response, next: NextFunction) => unknown;
  export type ErrorRequestHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => unknown;
  type Middleware = RequestHandler | Router;
  export interface Router extends RequestHandler {
    use(...handlers: Middleware[]): this;
    use(path: string, ...handlers: Middleware[]): this;
    use(handler: ErrorRequestHandler): this;
    get(path: string, ...handlers: RequestHandler[]): this;
    post(path: string, ...handlers: RequestHandler[]): this;
    put(path: string, ...handlers: RequestHandler[]): this;
    patch(path: string, ...handlers: RequestHandler[]): this;
    delete(path: string, ...handlers: RequestHandler[]): this;
    [member: string]: any;
  }
  export interface Server {
    address(): { port: number };
    close(callback?: () => void): void;
  }
  export interface Express extends Router {
    listen(port: number, host: string, callback?: (err?: Error) => void): Server;
    listen(port: number, callback?: (err?: Error) => void): Server;
  }
  export type Application = Express;
  export interface RouterOptions {
    mergeParams?: boolean;
    strict?: boolean;
    caseSensitive?: boolean;
  }
  export function json(options?: { limit?: string | number }): RequestHandler;
  export function urlencoded(options?: { extended?: boolean }): RequestHandler;
  export function Router(options?: RouterOptions): Router;
  const express: {
    (): Express;
    json: typeof json;
    urlencoded: typeof urlencoded;
    Router: typeof Router;
    [member: string]: any;
  };
  export default express;
}
`;
