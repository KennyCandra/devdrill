/**
 * Type declarations for the Vitest globals challenge tests use (describe, it, expect…).
 * TypeScript challenges need them so the editor and the type checker don't report
 * "Cannot find name 'describe'". Kept loose on purpose: tests aren't what players fix.
 *
 * This is a runtime string, so it lives outside the types-only index.ts. It's imported by
 * the web editor (packages/web) and the challenge type check (scripts/), never the server.
 */
export const TEST_GLOBALS_DTS = `
type TestFn = () => void | Promise<void>;
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: TestFn, timeout?: number): void;
declare function test(name: string, fn: TestFn, timeout?: number): void;
declare function beforeAll(fn: TestFn): void;
declare function afterAll(fn: TestFn): void;
declare function beforeEach(fn: TestFn): void;
declare function afterEach(fn: TestFn): void;
// Matchers are loosely typed: any expect(...).toSomething(...) call is accepted.
declare function expect(actual: unknown): any;
`;
