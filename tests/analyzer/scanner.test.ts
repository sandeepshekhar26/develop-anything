// ============================================================
// Tests: Scanner
// ============================================================

import { describe, it } from 'node:test';
import { expect } from '../helpers/expect.js';
import { matchesGlob, detectLanguage, isSourceFile } from '../../src/utils/file-utils.js';

describe('detectLanguage', () => {
  it('should detect TypeScript', () => {
    expect(detectLanguage('src/index.ts')).toBe('typescript');
    expect(detectLanguage('src/App.tsx')).toBe('typescript');
  });

  it('should detect JavaScript', () => {
    expect(detectLanguage('src/index.js')).toBe('javascript');
    expect(detectLanguage('src/utils.mjs')).toBe('javascript');
  });

  it('should detect Python', () => {
    expect(detectLanguage('app.py')).toBe('python');
  });

  it('should detect Go', () => {
    expect(detectLanguage('main.go')).toBe('go');
  });

  it('should detect Rust', () => {
    expect(detectLanguage('lib.rs')).toBe('rust');
  });

  it('should return unknown for unrecognized', () => {
    expect(detectLanguage('data.csv')).toBe('unknown');
  });
});

describe('isSourceFile', () => {
  it('should identify source files', () => {
    expect(isSourceFile('index.ts')).toBe(true);
    expect(isSourceFile('app.py')).toBe(true);
    expect(isSourceFile('main.go')).toBe(true);
  });

  it('should reject non-source files', () => {
    expect(isSourceFile('readme.md')).toBe(false);
    expect(isSourceFile('data.json')).toBe(false);
    expect(isSourceFile('style.css')).toBe(false);
  });
});

describe('matchesGlob', () => {
  it('should match simple patterns', () => {
    expect(matchesGlob('node_modules/pkg/index.js', ['node_modules/**'])).toBe(true);
    expect(matchesGlob('src/index.ts', ['node_modules/**'])).toBe(false);
  });

  it('should match wildcard patterns', () => {
    expect(matchesGlob('dist/bundle.js', ['dist/**'])).toBe(true);
  });
});
