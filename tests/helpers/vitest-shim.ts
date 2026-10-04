/** Bộ chuyển đổi nhỏ: chạy các bài kiểm thử viết theo cú pháp Vitest bằng node:test. */
import { describe as nodeDescribe, it as nodeIt } from 'node:test';
import assert from 'node:assert/strict';

export const describe = (name: string, fn: () => unknown) => nodeDescribe(name, fn as () => void);
export const it = (name: string, fn: () => unknown) => nodeIt(name, fn as () => void);

function matchers(actual: any, negate: boolean, msg?: string) {
  const check = (ok: boolean, text: string) => {
    if (ok === negate) assert.fail(`${msg ? msg + ': ' : ''}${negate ? 'not ' : ''}${text}`);
  };
  const show = (v: unknown) => { try { return JSON.stringify(v)?.slice(0, 300); } catch { return String(v); } };
  return {
    toBe: (v: unknown) => check(Object.is(actual, v), `expected ${show(actual)} to be ${show(v)}`),
    toEqual: (v: unknown) => {
      let ok = true; try { assert.deepEqual(actual, v); } catch { ok = false; }
      check(ok, `expected ${show(actual)} to equal ${show(v)}`);
    },
    toHaveLength: (n: number) => check(actual?.length === n, `expected length ${actual?.length} to be ${n}`),
    toContain: (v: unknown) => check(
      typeof actual === 'string' ? actual.includes(String(v)) : Array.isArray(actual) && actual.includes(v),
      `expected ${show(actual)} to contain ${show(v)}`),
    toMatch: (re: RegExp | string) => check(typeof re === 'string' ? String(actual).includes(re) : re.test(String(actual)),
      `expected ${show(actual)} to match ${re}`),
    toBeNull: () => check(actual === null, `expected ${show(actual)} to be null`),
    toBeUndefined: () => check(actual === undefined, `expected ${show(actual)} to be undefined`),
    toBeTruthy: () => check(!!actual, `expected ${show(actual)} to be truthy`),
    toBeGreaterThanOrEqual: (n: number) => check(actual >= n, `expected ${actual} >= ${n}`),
    toBeLessThanOrEqual: (n: number) => check(actual <= n, `expected ${actual} <= ${n}`),
    toThrow: (m?: RegExp | string) => {
      let threw = false; let err: unknown;
      try { actual(); } catch (e) { threw = true; err = e; }
      const text = err instanceof Error ? err.message : String(err);
      check(threw && (!m || (typeof m === 'string' ? text.includes(m) : m.test(text))), `expected function to throw ${m ?? ''}`);
    },
  };
}

export function expect(actual: any, msg?: string) {
  return { ...matchers(actual, false, msg), not: matchers(actual, true, msg) };
}
