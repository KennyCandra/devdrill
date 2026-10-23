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
