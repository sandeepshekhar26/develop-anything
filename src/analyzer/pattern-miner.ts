// ============================================================
// auk — AI Context Engineering Platform
// Pattern miner — discovers implicit conventions
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { ParsedFile, DetectedPattern } from '../types/analysis.js';
import { logger } from '../utils/logger.js';

/** Mine patterns from parsed files */
export function minePatterns(parsedFiles: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  if (parsedFiles.length === 0) return patterns;

  // 1. Naming conventions
  patterns.push(...detectNamingConventions(parsedFiles));

  // 2. Error handling patterns
  patterns.push(...detectErrorHandling(parsedFiles));

  // 3. Import patterns
  patterns.push(...detectImportPatterns(parsedFiles));

  // 4. File organization patterns
  patterns.push(...detectFileOrganization(parsedFiles));

  // 5. Testing patterns
  patterns.push(...detectTestingPatterns(parsedFiles));

  // 6. Type safety patterns
  patterns.push(...detectTypeSafetyPatterns(parsedFiles));

  // 7. Export patterns
  patterns.push(...detectExportPatterns(parsedFiles));

  logger.debug(`Mined ${patterns.length} patterns from ${parsedFiles.length} files`);
  return patterns.filter(p => p.prevalence >= 0.3); // Only keep patterns in 30%+ of files
}

/** Detect naming conventions (camelCase, PascalCase, snake_case) */
function detectNamingConventions(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Function naming
  const funcNames = files.flatMap(f =>
    f.symbols.filter(s => s.type === 'function').map(s => ({ name: s.name, file: f.entry.path, line: s.line }))
  );

  if (funcNames.length > 3) {
    const camelCase = funcNames.filter(f => /^[a-z][a-zA-Z0-9]*$/.test(f.name));
    const snakeCase = funcNames.filter(f => /^[a-z][a-z0-9_]*$/.test(f.name) && f.name.includes('_'));
    const total = funcNames.length;

    if (camelCase.length / total >= 0.7) {
      patterns.push({
        id: 'naming-functions-camelcase',
        name: 'Functions use camelCase',
        category: 'naming',
        description: 'All function names use camelCase naming convention.',
        prevalence: camelCase.length / total,
        examples: camelCase.slice(0, 3).map(f => ({ file: f.file, line: f.line })),
        counterExamples: funcNames.filter(f => !camelCase.includes(f)).slice(0, 3).map(f => ({
          file: f.file, line: f.line, note: `"${f.name}" does not follow camelCase`,
        })),
      });
    }

    if (snakeCase.length / total >= 0.7) {
      patterns.push({
        id: 'naming-functions-snake-case',
        name: 'Functions use snake_case',
        category: 'naming',
        description: 'All function names use snake_case naming convention.',
        prevalence: snakeCase.length / total,
        examples: snakeCase.slice(0, 3).map(f => ({ file: f.file, line: f.line })),
        counterExamples: funcNames.filter(f => !snakeCase.includes(f)).slice(0, 3).map(f => ({
          file: f.file, line: f.line, note: `"${f.name}" does not follow snake_case`,
        })),
      });
    }
  }

  // Class naming (PascalCase)
  const classNames = files.flatMap(f =>
    f.symbols.filter(s => s.type === 'class' || s.type === 'interface').map(s => ({ name: s.name, file: f.entry.path, line: s.line }))
  );

  if (classNames.length > 2) {
    const pascalCase = classNames.filter(c => /^[A-Z][a-zA-Z0-9]*$/.test(c.name));
    const prevalence = pascalCase.length / classNames.length;
    if (prevalence >= 0.7) {
      patterns.push({
        id: 'naming-classes-pascalcase',
        name: 'Classes use PascalCase',
        category: 'naming',
        description: 'All class and interface names use PascalCase naming convention.',
        prevalence,
        examples: pascalCase.slice(0, 3).map(c => ({ file: c.file, line: c.line })),
        counterExamples: classNames.filter(c => !pascalCase.includes(c)).slice(0, 2).map(c => ({
          file: c.file, line: c.line, note: `"${c.name}" does not follow PascalCase`,
        })),
      });
    }
  }

  return patterns;
}

/** Detect error handling patterns */
function detectErrorHandling(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');

  if (tsJsFiles.length < 3) return patterns;

  // Result<T,E> pattern
  const resultFiles = tsJsFiles.filter(f =>
    f.symbols.some(s => s.name === 'Result' || s.name.includes('Result')) ||
    f.imports.some(i => i.symbols.some(s => s === 'Result' || s.includes('Result')))
  );

  if (resultFiles.length / tsJsFiles.length >= 0.3) {
    patterns.push({
      id: 'error-handling-result-pattern',
      name: 'Result<T,E> error handling',
      category: 'error-handling',
      description: 'Error handling uses the Result<T,E> pattern instead of try/catch. Never throw exceptions in the service layer — always return Result.',
      prevalence: resultFiles.length / tsJsFiles.length,
      examples: resultFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  }

  // Check for try/catch patterns vs error-first callbacks
  let tryCatchCount = 0;
  const tryCatchFiles: string[] = [];

  for (const f of tsJsFiles) {
    const content = fs.readFileSync(f.entry.absolutePath, 'utf-8');
    const matches = content.match(/try\s*\{/g);
    if (matches && matches.length > 0) {
      tryCatchCount += matches.length;
      tryCatchFiles.push(f.entry.path);
    }
  }

  if (tryCatchFiles.length / tsJsFiles.length >= 0.4) {
    patterns.push({
      id: 'error-handling-try-catch',
      name: 'Try/catch error handling',
      category: 'error-handling',
      description: 'Error handling primarily uses try/catch blocks.',
      prevalence: tryCatchFiles.length / tsJsFiles.length,
      examples: tryCatchFiles.slice(0, 3).map(f => ({ file: f })),
      counterExamples: [],
    });
  }

  return patterns;
}

/** Detect import patterns */
function detectImportPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');

  if (tsJsFiles.length < 3) return patterns;

  // Barrel file pattern (index.ts re-exports)
  const indexFiles = tsJsFiles.filter(f => {
    const basename = path.basename(f.entry.path);
    return (basename === 'index.ts' || basename === 'index.js') &&
           f.exports.length > 0;
  });

  if (indexFiles.length >= 2) {
    patterns.push({
      id: 'imports-barrel-files',
      name: 'Barrel file pattern',
      category: 'imports',
      description: 'Directories use index.ts barrel files to re-export their public API. Import from the directory, not individual files.',
      prevalence: indexFiles.length / Math.max(1, tsJsFiles.filter(f => f.entry.path.includes('/')).length),
      examples: indexFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  }

  // Absolute vs relative imports
  const relativeImports = tsJsFiles.flatMap(f => f.imports.filter(i => i.source.startsWith('.')));
  const absoluteImports = tsJsFiles.flatMap(f =>
    f.imports.filter(i => !i.source.startsWith('.') && !i.source.startsWith('/') && !i.source.includes('node_modules'))
  );

  if (relativeImports.length > absoluteImports.length && relativeImports.length > 5) {
    patterns.push({
      id: 'imports-relative',
      name: 'Relative imports preferred',
      category: 'imports',
      description: 'The codebase uses relative imports (e.g., ../services/user) rather than absolute/alias paths.',
      prevalence: relativeImports.length / Math.max(1, relativeImports.length + absoluteImports.length),
      examples: relativeImports.slice(0, 3).map(i => ({ file: 'various' })),
      counterExamples: [],
    });
  }

  return patterns;
}

/** Detect file organization patterns */
function detectFileOrganization(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Feature folders vs layer folders
  const dirs = new Set(files.map(f => {
    const parts = f.entry.path.split('/');
    return parts.length > 1 ? parts[0] : '';
  }).filter(Boolean));

  const layerDirs = ['controllers', 'services', 'models', 'views', 'routes', 'middleware', 'utils', 'helpers', 'repositories'];
  const featureDirs = ['auth', 'users', 'products', 'orders', 'payments', 'notifications', 'dashboard'];

  const layerCount = layerDirs.filter(d => dirs.has(d) || dirs.has(`src/${d}`)).length;
  const featureCount = featureDirs.filter(d => dirs.has(d) || dirs.has(`src/${d}`)).length;

  if (layerCount >= 2) {
    patterns.push({
      id: 'organization-layer-folders',
      name: 'Layer-based folder structure',
      category: 'file-organization',
      description: 'Code is organized by architectural layer (controllers/, services/, models/) rather than by feature.',
      prevalence: layerCount / layerDirs.length,
      examples: layerDirs.filter(d => dirs.has(d) || dirs.has(`src/${d}`)).slice(0, 3).map(d => ({ file: d + '/' })),
      counterExamples: [],
    });
  }

  if (featureCount >= 2) {
    patterns.push({
      id: 'organization-feature-folders',
      name: 'Feature-based folder structure',
      category: 'file-organization',
      description: 'Code is organized by feature/domain (auth/, users/, orders/) with each feature containing its own layers.',
      prevalence: featureCount / featureDirs.length,
      examples: featureDirs.filter(d => dirs.has(d) || dirs.has(`src/${d}`)).slice(0, 3).map(d => ({ file: d + '/' })),
      counterExamples: [],
    });
  }

  return patterns;
}

/** Detect testing patterns */
function detectTestingPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const testFiles = files.filter(f => {
    const name = path.basename(f.entry.path);
    return name.includes('.test.') || name.includes('.spec.') || name.includes('_test.') ||
           f.entry.path.includes('__tests__/') || f.entry.path.includes('tests/');
  });

  const sourceFiles = files.filter(f => !testFiles.includes(f));

  if (testFiles.length >= 2 && sourceFiles.length >= 2) {
    // Co-located tests (test file next to source file)
    const colocated = testFiles.filter(t => {
      const testDir = path.dirname(t.entry.path);
      return sourceFiles.some(s => path.dirname(s.entry.path) === testDir);
    });

    if (colocated.length / testFiles.length >= 0.5) {
      patterns.push({
        id: 'testing-colocated',
        name: 'Co-located test files',
        category: 'testing',
        description: 'Test files are placed next to the source files they test (e.g., user.ts and user.test.ts in the same directory).',
        prevalence: colocated.length / testFiles.length,
        examples: colocated.slice(0, 3).map(t => ({ file: t.entry.path })),
        counterExamples: [],
      });
    }

    // Test naming convention
    const dotTest = testFiles.filter(t => path.basename(t.entry.path).includes('.test.'));
    const dotSpec = testFiles.filter(t => path.basename(t.entry.path).includes('.spec.'));

    if (dotTest.length > dotSpec.length && dotTest.length / testFiles.length >= 0.7) {
      patterns.push({
        id: 'testing-naming-test',
        name: 'Test files use .test. naming',
        category: 'testing',
        description: 'Test files follow the *.test.ts / *.test.js naming convention.',
        prevalence: dotTest.length / testFiles.length,
        examples: dotTest.slice(0, 3).map(t => ({ file: t.entry.path })),
        counterExamples: dotSpec.slice(0, 2).map(t => ({
          file: t.entry.path, line: 1, note: 'Uses .spec. instead of .test.',
        })),
      });
    }
  }

  return patterns;
}

/** Detect TypeScript type safety patterns */
function detectTypeSafetyPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsFiles = files.filter(f => f.entry.language === 'typescript');

  if (tsFiles.length < 3) return patterns;

  // Interface vs type alias preference
  const interfaces = tsFiles.flatMap(f => f.symbols.filter(s => s.type === 'interface'));
  const typeAliases = tsFiles.flatMap(f => f.symbols.filter(s => s.type === 'type'));

  if (interfaces.length > typeAliases.length && interfaces.length >= 5) {
    patterns.push({
      id: 'types-prefer-interface',
      name: 'Prefer interface over type',
      category: 'types',
      description: 'The codebase prefers interface declarations over type aliases for object shapes.',
      prevalence: interfaces.length / (interfaces.length + typeAliases.length),
      examples: interfaces.slice(0, 3).map(i => ({ file: 'various' })),
      counterExamples: [],
    });
  }

  if (typeAliases.length > interfaces.length && typeAliases.length >= 5) {
    patterns.push({
      id: 'types-prefer-type-alias',
      name: 'Prefer type alias over interface',
      category: 'types',
      description: 'The codebase prefers type aliases over interface declarations.',
      prevalence: typeAliases.length / (interfaces.length + typeAliases.length),
      examples: typeAliases.slice(0, 3).map(t => ({ file: 'various' })),
      counterExamples: [],
    });
  }

  return patterns;
}

/** Detect export patterns */
function detectExportPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');

  if (tsJsFiles.length < 3) return patterns;

  const namedExportFiles = tsJsFiles.filter(f => f.exports.some(e => e.type === 'named'));
  const defaultExportFiles = tsJsFiles.filter(f => f.exports.some(e => e.type === 'default'));

  if (namedExportFiles.length > defaultExportFiles.length && namedExportFiles.length >= 5) {
    patterns.push({
      id: 'exports-named-only',
      name: 'Named exports preferred',
      category: 'imports',
      description: 'The codebase uses named exports exclusively. Avoid default exports.',
      prevalence: namedExportFiles.length / tsJsFiles.length,
      examples: namedExportFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: defaultExportFiles.slice(0, 2).map(f => ({
        file: f.entry.path, line: f.exports.find(e => e.type === 'default')?.line,
        note: 'Uses default export',
      })),
    });
  }

  return patterns;
}
