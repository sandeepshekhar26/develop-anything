// ============================================================
// Tiny expect() built on node:assert — keeps tests zero-dependency.
// Implements the matcher subset auk's tests use.
// ============================================================

import * as assert from 'node:assert/strict';

class Expectation {
  private actual: unknown;
  private negated: boolean;

  constructor(actual: unknown, negated = false) {
    this.actual = actual;
    this.negated = negated;
  }

  get not(): Expectation {
    return new Expectation(this.actual, !this.negated);
  }

  private check(condition: boolean, message: string): void {
    if (this.negated ? condition : !condition) {
      assert.fail(this.negated ? `not: ${message}` : message);
    }
  }

  toBe(expected: unknown): void {
    this.check(Object.is(this.actual, expected), `expected ${format(this.actual)} to be ${format(expected)}`);
  }

  toEqual(expected: unknown): void {
    let equal = true;
    try {
      assert.deepEqual(this.actual, expected);
    } catch {
      equal = false;
    }
    this.check(equal, `expected ${format(this.actual)} to deeply equal ${format(expected)}`);
  }

  toContain(item: unknown): void {
    const a = this.actual;
    let contains = false;
    if (typeof a === 'string') contains = a.includes(String(item));
    else if (Array.isArray(a)) contains = a.some(x => x === item || deepEq(x, item));
    this.check(contains, `expected ${format(a)} to contain ${format(item)}`);
  }

  toHaveLength(len: number): void {
    const a = this.actual as { length?: number };
    this.check(a != null && a.length === len, `expected length ${a?.length} to be ${len}`);
  }

  toBeGreaterThan(n: number): void {
    this.check((this.actual as number) > n, `expected ${format(this.actual)} > ${n}`);
  }

  toBeGreaterThanOrEqual(n: number): void {
    this.check((this.actual as number) >= n, `expected ${format(this.actual)} >= ${n}`);
  }

  toBeLessThan(n: number): void {
    this.check((this.actual as number) < n, `expected ${format(this.actual)} < ${n}`);
  }

  toBeTruthy(): void {
    this.check(Boolean(this.actual), `expected ${format(this.actual)} to be truthy`);
  }

  toBeFalsy(): void {
    this.check(!this.actual, `expected ${format(this.actual)} to be falsy`);
  }

  toBeNull(): void {
    this.check(this.actual === null, `expected ${format(this.actual)} to be null`);
  }

  toBeUndefined(): void {
    this.check(this.actual === undefined, `expected ${format(this.actual)} to be undefined`);
  }

  toBeDefined(): void {
    this.check(this.actual !== undefined, `expected value to be defined`);
  }
}

function deepEq(a: unknown, b: unknown): boolean {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

function format(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s && s.length > 120 ? s.slice(0, 120) + '…' : s ?? String(v);
  } catch {
    return String(v);
  }
}

export function expect(actual: unknown): Expectation {
  return new Expectation(actual);
}
