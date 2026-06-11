// ============================================================
// Tests: Parser
// ============================================================

import { describe, it } from 'node:test';
import { expect } from '../helpers/expect.js';
import { parseFile } from '../../src/analyzer/parser.js';
import type { FileEntry } from '../../src/types/analysis.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempFile(content: string, ext: string = '.ts'): FileEntry {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `auk-test-${Date.now()}${ext}`);
  fs.writeFileSync(filePath, content);
  return {
    path: path.basename(filePath),
    absolutePath: filePath,
    language: ext === '.ts' ? 'typescript' : ext === '.py' ? 'python' : ext === '.go' ? 'go' : 'unknown',
    size: content.length,
    hash: 'test',
  };
}

describe('parseFile - TypeScript', () => {
  it('should extract imports', () => {
    const entry = createTempFile(`
import { UserService } from './services/user';
import * as fs from 'fs';
import express from 'express';
`);
    const result = parseFile(entry);
    expect(result.imports).toHaveLength(3);
    expect(result.imports[0].source).toBe('./services/user');
    expect(result.imports[0].symbols).toContain('UserService');
    expect(result.imports[1].isNamespace).toBe(true);
    expect(result.imports[2].isDefault).toBe(true);
    fs.unlinkSync(entry.absolutePath);
  });

  it('should extract exports', () => {
    const entry = createTempFile(`
export function createUser() {}
export class UserService {}
export const API_KEY = 'xxx';
export default class App {}
`);
    const result = parseFile(entry);
    expect(result.exports.length).toBeGreaterThanOrEqual(3);
    expect(result.symbols.some(s => s.name === 'createUser')).toBe(true);
    expect(result.symbols.some(s => s.name === 'UserService')).toBe(true);
    fs.unlinkSync(entry.absolutePath);
  });

  it('should extract function declarations', () => {
    const entry = createTempFile(`
function privateFunc() {}
export async function asyncFunc(a: string, b: number) {}
export const arrowFunc = (x: number) => x * 2;
`);
    const result = parseFile(entry);
    const funcs = result.symbols.filter(s => s.type === 'function');
    expect(funcs.length).toBeGreaterThanOrEqual(2);
    fs.unlinkSync(entry.absolutePath);
  });

  it('should extract interfaces and types', () => {
    const entry = createTempFile(`
export interface User {
  id: string;
  name: string;
}
export type UserRole = 'admin' | 'user';
export enum Status { Active, Inactive }
`);
    const result = parseFile(entry);
    expect(result.symbols.some(s => s.name === 'User' && s.type === 'interface')).toBe(true);
    expect(result.symbols.some(s => s.name === 'UserRole' && s.type === 'type')).toBe(true);
    expect(result.symbols.some(s => s.name === 'Status' && s.type === 'enum')).toBe(true);
    fs.unlinkSync(entry.absolutePath);
  });
});

describe('parseFile - Python', () => {
  it('should extract Python imports and functions', () => {
    const entry = createTempFile(`
import os
from pathlib import Path
from typing import List, Optional

def create_user(name: str, email: str) -> dict:
    pass

class UserService:
    def get_user(self, user_id: int):
        pass
`, '.py');
    const result = parseFile(entry);
    expect(result.imports.length).toBeGreaterThanOrEqual(2);
    expect(result.symbols.some(s => s.name === 'create_user')).toBe(true);
    expect(result.symbols.some(s => s.name === 'UserService')).toBe(true);
    fs.unlinkSync(entry.absolutePath);
  });
});
