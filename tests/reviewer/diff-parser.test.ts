// ============================================================
// Tests: Diff Parser
// ============================================================

import { describe, it } from 'node:test';
import { expect } from '../helpers/expect.js';
import { parseDiff } from '../../src/reviewer/diff-parser.js';

describe('parseDiff', () => {
  it('should parse empty diff', () => {
    expect(parseDiff('')).toEqual([]);
  });

  it('should parse a simple file modification', () => {
    const diff = `diff --git a/src/service.ts b/src/service.ts
index abc1234..def5678 100644
--- a/src/service.ts
+++ b/src/service.ts
@@ -1,3 +1,4 @@
 import { db } from './db';
+import { logger } from './utils/logger';
 
 export function getUser() {`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/service.ts');
    expect(result[0].status).toBe('modified');
    expect(result[0].addedImports).toHaveLength(1);
    expect(result[0].addedImports[0]).toContain('logger');
  });

  it('should detect new files', () => {
    const diff = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return 'world';
+}`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('added');
    expect(result[0].addedSymbols).toContain('hello');
  });

  it('should detect deleted files', () => {
    const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export function old() {}
-`;

    const result = parseDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('deleted');
  });
});
