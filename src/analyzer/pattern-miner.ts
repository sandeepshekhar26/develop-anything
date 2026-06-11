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

  patterns.push(...detectNamingConventions(parsedFiles));
  patterns.push(...detectErrorHandling(parsedFiles));
  patterns.push(...detectImportPatterns(parsedFiles));
  patterns.push(...detectFileOrganization(parsedFiles));
  patterns.push(...detectTestingPatterns(parsedFiles));
  patterns.push(...detectTypeSafetyPatterns(parsedFiles));
  patterns.push(...detectExportPatterns(parsedFiles));
  patterns.push(...detectGoPatterns(parsedFiles));
  patterns.push(...detectArchitectureBoundaries(parsedFiles));
  patterns.push(...detectApiPatterns(parsedFiles));
  patterns.push(...detectStateManagement(parsedFiles));
  patterns.push(...detectAsyncPatterns(parsedFiles));

  logger.debug(`Mined ${patterns.length} patterns from ${parsedFiles.length} files`);
  // Lower threshold: 20% prevalence is enough for a useful rule
  return patterns.filter(p => p.prevalence >= 0.2);
}

/** Convert semantic file clusters into structural-shape patterns. */
export function detectStructuralClusters(
  parsedFiles: ParsedFile[],
  clusters: Array<{ id: string; label: string; files: string[]; topTerms: string[]; cohesion: number }>
): DetectedPattern[] {
  const byPath = new Map(parsedFiles.map(pf => [pf.entry.path, pf]));
  const patterns: DetectedPattern[] = [];

  for (const cluster of clusters) {
    if (cluster.files.length < 4) continue;
    const members = cluster.files.map(f => byPath.get(f)).filter((p): p is ParsedFile => !!p);
    if (members.length < 4) continue;

    const importCounts = new Map<string, number>();
    for (const m of members) {
      for (const src of new Set(m.imports.map(i => i.source))) {
        importCounts.set(src, (importCounts.get(src) ?? 0) + 1);
      }
    }
    const sharedImports = [...importCounts.entries()]
      .filter(([, c]) => c >= members.length * 0.5)
      .map(([src]) => src)
      .sort();

    if (sharedImports.length === 0 && cluster.cohesion < 0.5) continue;

    const sharedNote = sharedImports.length > 0
      ? ` They share imports: ${sharedImports.slice(0, 3).join(', ')}.`
      : '';
    patterns.push({
      id: `cluster-${cluster.label}`,
      name: `Structural cluster: ${cluster.label}`,
      category: 'patterns',
      description: `${members.length} files share the '${cluster.label}' shape (key terms: ${cluster.topTerms.join(', ')}).${sharedNote} New files of this kind should follow the same structure.`,
      prevalence: Math.round((members.length / parsedFiles.length) * 100) / 100,
      examples: members.slice(0, 3).map(m => ({ file: m.entry.path })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── Naming ────────────────────────────────────────────────────────────────────

function detectNamingConventions(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

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
        counterExamples: [],
      });
    }
  }

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

  // Detect file naming convention
  const fileNames = files.map(f => path.basename(f.entry.path, path.extname(f.entry.path)));
  const kebabFiles = fileNames.filter(n => /^[a-z][a-z0-9-]*$/.test(n) && n.includes('-'));
  const camelFiles = fileNames.filter(n => /^[a-z][a-zA-Z0-9]*$/.test(n) && /[A-Z]/.test(n));
  const pascalFiles = fileNames.filter(n => /^[A-Z][a-zA-Z0-9]*$/.test(n));

  const total = fileNames.length;
  if (kebabFiles.length / total >= 0.4) {
    patterns.push({
      id: 'naming-files-kebab-case',
      name: 'Files use kebab-case',
      category: 'naming',
      description: 'Source files are named using kebab-case (e.g., user-service.ts, payment-handler.go). Use this convention for all new files.',
      prevalence: kebabFiles.length / total,
      examples: files.filter(f => kebabFiles.includes(path.basename(f.entry.path, path.extname(f.entry.path)))).slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  } else if (camelFiles.length / total >= 0.4) {
    patterns.push({
      id: 'naming-files-camelcase',
      name: 'Files use camelCase',
      category: 'naming',
      description: 'Source files are named using camelCase (e.g., userService.ts). Use this convention for all new files.',
      prevalence: camelFiles.length / total,
      examples: files.filter(f => camelFiles.includes(path.basename(f.entry.path, path.extname(f.entry.path)))).slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  } else if (pascalFiles.length / total >= 0.4) {
    patterns.push({
      id: 'naming-files-pascalcase',
      name: 'Files use PascalCase',
      category: 'naming',
      description: 'Source files are named using PascalCase (e.g., UserService.ts). Use this convention for all new files.',
      prevalence: pascalFiles.length / total,
      examples: files.filter(f => pascalFiles.includes(path.basename(f.entry.path, path.extname(f.entry.path)))).slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── Error handling ─────────────────────────────────────────────────────────────

function detectErrorHandling(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');

  if (tsJsFiles.length < 3) return patterns;

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

  let tryCatchCount = 0;
  const tryCatchFiles: string[] = [];
  let promiseChainCount = 0;
  const promiseChainFilesList: string[] = [];

  for (const f of tsJsFiles) {
    const content = readFileSafe(f.entry.absolutePath);
    if (!content) continue;
    if (/try\s*\{/.test(content)) { tryCatchCount++; tryCatchFiles.push(f.entry.path); }
    if (/\.catch\s*\(/.test(content)) { promiseChainCount++; promiseChainFilesList.push(f.entry.path); }
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

  if (promiseChainFilesList.length / tsJsFiles.length >= 0.3 && tryCatchFiles.length / tsJsFiles.length < 0.4) {
    patterns.push({
      id: 'error-handling-promise-chain',
      name: 'Promise chain error handling',
      category: 'error-handling',
      description: 'Error handling uses .catch() on promise chains rather than try/catch with async/await.',
      prevalence: promiseChainFilesList.length / tsJsFiles.length,
      examples: promiseChainFilesList.slice(0, 3).map(f => ({ file: f })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── Go-specific patterns ───────────────────────────────────────────────────────

function detectGoPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const goFiles = files.filter(f => f.entry.language === 'go');
  if (goFiles.length < 3) return patterns;

  let errNilCount = 0;
  let panicCount = 0;
  let contextFirstCount = 0;
  let interfaceReceiverCount = 0;
  const errNilFiles: string[] = [];
  const panicFiles: string[] = [];
  const contextFiles: string[] = [];

  for (const f of goFiles) {
    const content = readFileSafe(f.entry.absolutePath);
    if (!content) continue;

    if (/if err != nil/.test(content)) { errNilCount++; errNilFiles.push(f.entry.path); }
    if (/\bpanic\s*\(/.test(content)) { panicCount++; panicFiles.push(f.entry.path); }
    if (/func\s+\w+\s*\(\s*ctx\s+context\.Context/.test(content)) {
      contextFirstCount++; contextFiles.push(f.entry.path);
    }
    if (/func\s*\(\s*\w+\s+\*?\w+\)/.test(content)) interfaceReceiverCount++;
  }

  if (errNilFiles.length / goFiles.length >= 0.4) {
    patterns.push({
      id: 'go-error-handling-err-nil',
      name: 'Go error handling: if err != nil',
      category: 'error-handling',
      description: 'Go error handling follows the idiomatic `if err != nil { return ..., err }` pattern. Never ignore errors; always check and propagate.',
      prevalence: errNilFiles.length / goFiles.length,
      examples: errNilFiles.slice(0, 3).map(f => ({ file: f })),
      counterExamples: [],
    });
  }

  if (panicFiles.length > 0 && panicFiles.length / goFiles.length <= 0.15) {
    patterns.push({
      id: 'go-no-panic-in-handlers',
      name: 'No panic in handlers',
      category: 'error-handling',
      description: `panic() is used in only ${panicFiles.length} Go files — it should be reserved for unrecoverable programmer errors, never for normal error flow in handlers or services.`,
      prevalence: 1 - panicFiles.length / goFiles.length,
      examples: goFiles.filter(f => !panicFiles.includes(f.entry.path)).slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: panicFiles.slice(0, 2).map(f => ({ file: f, note: 'Uses panic()' })),
    });
  }

  if (contextFiles.length / goFiles.length >= 0.3) {
    patterns.push({
      id: 'go-context-first-param',
      name: 'Go context.Context as first param',
      category: 'patterns',
      description: 'Functions that perform I/O or cross boundaries accept `ctx context.Context` as their first parameter. Always thread context through — never store it in a struct.',
      prevalence: contextFiles.length / goFiles.length,
      examples: contextFiles.slice(0, 3).map(f => ({ file: f })),
      counterExamples: [],
    });
  }

  // Package structure conventions
  const packages = new Set(goFiles.map(f => f.entry.path.split('/').slice(0, -1).join('/')));
  const handlerPkgs = [...packages].filter(p => p.includes('handler') || p.includes('Handler'));
  const servicePkgs = [...packages].filter(p => p.includes('service') || p.includes('Service'));
  const repoPkgs = [...packages].filter(p => p.includes('repository') || p.includes('repo') || p.includes('store'));
  const modelPkgs = [...packages].filter(p => p.includes('model') || p.includes('entity') || p.includes('domain'));

  if (handlerPkgs.length > 0 && servicePkgs.length > 0) {
    patterns.push({
      id: 'go-layered-architecture',
      name: 'Go layered architecture',
      category: 'architecture',
      description: `Go code follows a layered architecture: handlers (${handlerPkgs.slice(0,2).join(', ')}) → services (${servicePkgs.slice(0,2).join(', ')})${repoPkgs.length ? ` → repositories (${repoPkgs.slice(0,1).join(', ')})` : ''}. Handlers must not contain business logic; services must not directly handle HTTP.`,
      prevalence: 0.85,
      examples: [
        ...handlerPkgs.slice(0, 1).map(p => ({ file: p + '/', note: 'Handler layer' })),
        ...servicePkgs.slice(0, 1).map(p => ({ file: p + '/', note: 'Service layer' })),
        ...repoPkgs.slice(0, 1).map(p => ({ file: p + '/', note: 'Repository layer' })),
      ],
      counterExamples: [],
    });
  }

  // Go struct patterns
  const structSymbols = goFiles.flatMap(f => f.symbols.filter(s => s.type === 'class')); // tree-sitter maps structs to 'class'
  if (structSymbols.length >= 3) {
    const pointerReceivers = goFiles.flatMap(f => {
      const content = readFileSafe(f.entry.absolutePath) ?? '';
      const matches = [...content.matchAll(/func\s*\(\s*\w+\s+\*(\w+)\)/g)];
      return matches.map(m => m[1]);
    });
    if (pointerReceivers.length > structSymbols.length * 0.5) {
      patterns.push({
        id: 'go-pointer-receivers',
        name: 'Go pointer receivers for methods',
        category: 'patterns',
        description: 'Methods on structs use pointer receivers (`*TypeName`) rather than value receivers. This is consistent across the codebase — follow the same pattern for new methods.',
        prevalence: 0.75,
        examples: goFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
        counterExamples: [],
      });
    }
  }

  return patterns;
}

// ── Architecture boundary detection ───────────────────────────────────────────

function detectArchitectureBoundaries(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Detect monorepo structure (frontend/backend split)
  const rootDirs = new Set(files.map(f => f.entry.path.split('/')[0]).filter(Boolean));
  const frontendDirs = [...rootDirs].filter(d => /^(frontend|web|client|ui|app)$/i.test(d));
  const backendDirs = [...rootDirs].filter(d => /^(backend|server|api|cmd|internal|service|services)$/i.test(d));

  if (frontendDirs.length > 0 && backendDirs.length > 0) {
    patterns.push({
      id: 'architecture-monorepo-frontend-backend',
      name: 'Monorepo: frontend/backend split',
      category: 'architecture',
      description: `This is a monorepo with a clear frontend/backend separation: \`${frontendDirs.join('/')}\` (UI) and \`${backendDirs.join('/')}\` (server). Frontend code must never import backend packages directly — communication happens only through the defined API contract.`,
      prevalence: 0.95,
      examples: [
        ...frontendDirs.slice(0, 1).map(d => ({ file: d + '/', note: 'Frontend root' })),
        ...backendDirs.slice(0, 1).map(d => ({ file: d + '/', note: 'Backend root' })),
      ],
      counterExamples: [],
    });
  }

  // Detect layer violations from import patterns in TS/JS
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');
  const layerViolations: Array<{ from: string; to: string; file: string }> = [];

  for (const f of tsJsFiles) {
    const pathParts = f.entry.path.toLowerCase().split('/');
    const isService = pathParts.some(p => p === 'services' || p === 'service');
    const isUtil = pathParts.some(p => p === 'utils' || p === 'helpers' || p === 'lib');

    for (const imp of f.imports) {
      const target = imp.source.toLowerCase();
      if (isUtil && (target.includes('/service') || target.includes('/controller') || target.includes('/handler'))) {
        layerViolations.push({ from: 'utility', to: 'service', file: f.entry.path });
      }
      if (isService && (target.includes('/controller') || target.includes('/handler') || target.includes('/route'))) {
        layerViolations.push({ from: 'service', to: 'controller', file: f.entry.path });
      }
    }
  }

  if (layerViolations.length > 0) {
    const uniqueFiles = [...new Set(layerViolations.map(v => v.file))];
    patterns.push({
      id: 'architecture-layer-violation-detected',
      name: 'Layer violation detected',
      category: 'architecture',
      description: `${uniqueFiles.length} file(s) violate layer boundaries (e.g., utility importing from service/controller). These are known tech debt — do not add more cross-layer imports.`,
      prevalence: 0.8,
      examples: uniqueFiles.slice(0, 3).map(f => ({ file: f, note: 'Layer boundary violation' })),
      counterExamples: [],
    });
  }

  // Detect shared types / contracts between frontend and backend
  const sharedDirs = [...rootDirs].filter(d => /^(shared|common|types|contracts|proto|schema)$/i.test(d));
  if (sharedDirs.length > 0) {
    patterns.push({
      id: 'architecture-shared-types',
      name: 'Shared types directory',
      category: 'architecture',
      description: `Shared types and contracts live in \`${sharedDirs.join('/')}\`. When adding new API interfaces or DTOs, put them here — not in the frontend or backend directories.`,
      prevalence: 0.9,
      examples: sharedDirs.map(d => ({ file: d + '/', note: 'Shared types root' })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── API patterns ───────────────────────────────────────────────────────────────

function detectApiPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');
  const goFiles = files.filter(f => f.entry.language === 'go');

  // Next.js API routes or app router
  const nextApiFiles = tsJsFiles.filter(f =>
    f.entry.path.includes('/api/') || f.entry.path.includes('/app/') || f.entry.path.includes('route.ts') || f.entry.path.includes('route.tsx')
  );
  const appRouterFiles = tsJsFiles.filter(f =>
    f.entry.path.includes('/app/') && (f.entry.path.endsWith('page.tsx') || f.entry.path.endsWith('page.ts') || f.entry.path.endsWith('layout.tsx'))
  );
  const pagesRouterFiles = tsJsFiles.filter(f => f.entry.path.includes('/pages/') && !f.entry.path.includes('/_'));

  if (appRouterFiles.length > pagesRouterFiles.length && appRouterFiles.length >= 2) {
    patterns.push({
      id: 'nextjs-app-router',
      name: 'Next.js App Router',
      category: 'file-organization',
      description: `This project uses the Next.js App Router (not Pages Router). Routes are files named \`page.tsx\` inside \`app/\` directories. Use \`layout.tsx\` for shared layouts, \`loading.tsx\` for suspense, \`error.tsx\` for boundaries. Server Components by default — add \`"use client"\` only when needed.`,
      prevalence: appRouterFiles.length / Math.max(1, tsJsFiles.length),
      examples: appRouterFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });

    // Detect "use client" usage
    let useClientCount = 0;
    const useClientFiles: string[] = [];
    for (const f of appRouterFiles) {
      const content = readFileSafe(f.entry.absolutePath);
      if (content?.includes('"use client"') || content?.includes("'use client'")) {
        useClientCount++;
        useClientFiles.push(f.entry.path);
      }
    }
    if (useClientCount > 0) {
      patterns.push({
        id: 'nextjs-use-client-directive',
        name: 'Selective "use client" directive',
        category: 'patterns',
        description: `${useClientCount} of ${appRouterFiles.length} route files use \`"use client"\`. The pattern is to keep components as Server Components by default and only add \`"use client"\` for components needing browser APIs, event handlers, or client state.`,
        prevalence: useClientCount / appRouterFiles.length,
        examples: useClientFiles.slice(0, 3).map(f => ({ file: f })),
        counterExamples: appRouterFiles.filter(f => !useClientFiles.includes(f.entry.path)).slice(0, 2).map(f => ({ file: f.entry.path, note: 'Server Component (no "use client")' })),
      });
    }
  }

  // Go HTTP handler patterns
  if (goFiles.length >= 3) {
    const handlerFiles = goFiles.filter(f =>
      f.entry.path.toLowerCase().includes('handler') || f.entry.path.toLowerCase().includes('route')
    );
    const ginHandlers = handlerFiles.filter(f => {
      const content = readFileSafe(f.entry.absolutePath) ?? '';
      return content.includes('gin.Context') || content.includes('*gin.Context');
    });
    const netHttpHandlers = handlerFiles.filter(f => {
      const content = readFileSafe(f.entry.absolutePath) ?? '';
      return content.includes('http.ResponseWriter') && content.includes('*http.Request');
    });

    if (ginHandlers.length > 0) {
      patterns.push({
        id: 'go-gin-framework',
        name: 'Go uses Gin HTTP framework',
        category: 'patterns',
        description: `HTTP handlers use Gin (\`*gin.Context\`). Handler functions must accept \`c *gin.Context\`, use \`c.JSON()\` for responses, and \`c.ShouldBindJSON()\` for request parsing. Do not mix with net/http handlers.`,
        prevalence: ginHandlers.length / Math.max(1, handlerFiles.length),
        examples: ginHandlers.slice(0, 3).map(f => ({ file: f.entry.path })),
        counterExamples: [],
      });
    } else if (netHttpHandlers.length > 0) {
      patterns.push({
        id: 'go-net-http-handlers',
        name: 'Go uses net/http handlers',
        category: 'patterns',
        description: `HTTP handlers use the standard \`net/http\` signature: \`func(w http.ResponseWriter, r *http.Request)\`. Keep handlers thin — parse input, call service, write response.`,
        prevalence: netHttpHandlers.length / Math.max(1, handlerFiles.length),
        examples: netHttpHandlers.slice(0, 3).map(f => ({ file: f.entry.path })),
        counterExamples: [],
      });
    }
  }

  return patterns;
}

// ── State management ───────────────────────────────────────────────────────────

function detectStateManagement(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');
  if (tsJsFiles.length < 3) return patterns;

  const zustandFiles = tsJsFiles.filter(f => f.imports.some(i => i.source === 'zustand' || i.source.startsWith('zustand/')));
  const reduxFiles = tsJsFiles.filter(f => f.imports.some(i => i.source === 'redux' || i.source === '@reduxjs/toolkit' || i.source.startsWith('react-redux')));
  const jotaiFiles = tsJsFiles.filter(f => f.imports.some(i => i.source === 'jotai' || i.source.startsWith('jotai/')));
  const reactQueryFiles = tsJsFiles.filter(f => f.imports.some(i => i.source === '@tanstack/react-query' || i.source === 'react-query'));

  if (zustandFiles.length >= 2) {
    patterns.push({
      id: 'state-management-zustand',
      name: 'Zustand for state management',
      category: 'patterns',
      description: `Global state uses Zustand (${zustandFiles.length} files). Define stores in dedicated store files, use \`create()\` with the devtools middleware pattern. Don't use Redux or Context for global state.`,
      prevalence: zustandFiles.length / tsJsFiles.length,
      examples: zustandFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  }

  if (reduxFiles.length >= 2) {
    patterns.push({
      id: 'state-management-redux',
      name: 'Redux/RTK for state management',
      category: 'patterns',
      description: `Global state uses Redux Toolkit (${reduxFiles.length} files). Use \`createSlice()\` for reducers, \`createAsyncThunk()\` for async operations. Do not use plain \`createReducer\` or mutating state outside Immer.`,
      prevalence: reduxFiles.length / tsJsFiles.length,
      examples: reduxFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  }

  if (reactQueryFiles.length >= 2) {
    patterns.push({
      id: 'state-management-react-query',
      name: 'React Query for server state',
      category: 'patterns',
      description: `Server state uses TanStack Query (${reactQueryFiles.length} files). Use \`useQuery()\` for reads and \`useMutation()\` for writes. Don't replicate server state in Zustand/Redux — keep client and server state separate.`,
      prevalence: reactQueryFiles.length / tsJsFiles.length,
      examples: reactQueryFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── Async patterns ─────────────────────────────────────────────────────────────

function detectAsyncPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');
  if (tsJsFiles.length < 3) return patterns;

  let asyncAwaitCount = 0;
  let promiseCount = 0;
  const asyncFiles: string[] = [];

  for (const f of tsJsFiles) {
    const content = readFileSafe(f.entry.absolutePath);
    if (!content) continue;
    const hasAsync = /\basync\s+function|\basync\s+\(/.test(content);
    const hasPromise = /new Promise\s*\(/.test(content);
    if (hasAsync) { asyncAwaitCount++; asyncFiles.push(f.entry.path); }
    if (hasPromise) promiseCount++;
  }

  if (asyncAwaitCount / tsJsFiles.length >= 0.4 && asyncAwaitCount > promiseCount) {
    patterns.push({
      id: 'async-await-pattern',
      name: 'async/await preferred over raw Promises',
      category: 'patterns',
      description: `Async operations use async/await (${asyncAwaitCount} files) rather than raw Promise chains. Avoid \`new Promise()\` wrappers unless wrapping a callback-based API.`,
      prevalence: asyncAwaitCount / tsJsFiles.length,
      examples: asyncFiles.slice(0, 3).map(f => ({ file: f })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── Import patterns ────────────────────────────────────────────────────────────

function detectImportPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsJsFiles = files.filter(f => f.entry.language === 'typescript' || f.entry.language === 'javascript');

  if (tsJsFiles.length < 3) return patterns;

  const indexFiles = tsJsFiles.filter(f => {
    const basename = path.basename(f.entry.path);
    return (basename === 'index.ts' || basename === 'index.js') && f.exports.length > 0;
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

  const relativeImports = tsJsFiles.flatMap(f => f.imports.filter(i => i.source.startsWith('.')));
  const aliasImports = tsJsFiles.flatMap(f => f.imports.filter(i => i.source.startsWith('@/') || i.source.startsWith('~/') || i.source.startsWith('#')));
  const absoluteImports = tsJsFiles.flatMap(f =>
    f.imports.filter(i => !i.source.startsWith('.') && !i.source.startsWith('/') && !i.source.includes('node_modules') && !i.source.startsWith('@'))
  );

  if (aliasImports.length > relativeImports.length && aliasImports.length >= 5) {
    patterns.push({
      id: 'imports-path-alias',
      name: 'Path aliases preferred',
      category: 'imports',
      description: `The codebase uses path aliases (e.g., \`@/\`, \`~/\`) for imports rather than long relative paths. Check tsconfig.json / vite.config for the alias mappings.`,
      prevalence: aliasImports.length / (aliasImports.length + relativeImports.length),
      examples: tsJsFiles.filter(f => f.imports.some(i => i.source.startsWith('@/') || i.source.startsWith('~/'))).slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  } else if (relativeImports.length > absoluteImports.length && relativeImports.length > 5) {
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

// ── File organization ──────────────────────────────────────────────────────────

function detectFileOrganization(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const dirs = new Set(files.map(f => {
    const parts = f.entry.path.split('/');
    return parts.length > 1 ? parts[0] : '';
  }).filter(Boolean));

  const layerDirs = ['controllers', 'services', 'models', 'views', 'routes', 'middleware', 'utils', 'helpers', 'repositories', 'handlers', 'stores', 'entities'];
  const featureDirs = ['auth', 'users', 'products', 'orders', 'payments', 'notifications', 'dashboard', 'inventory', 'devices'];

  const foundLayers = layerDirs.filter(d => [...dirs].some(dir => dir === d || dir.endsWith('/' + d)));
  const foundFeatures = featureDirs.filter(d => [...dirs].some(dir => dir === d || dir.endsWith('/' + d)));

  if (foundLayers.length >= 2) {
    patterns.push({
      id: 'organization-layer-folders',
      name: 'Layer-based folder structure',
      category: 'file-organization',
      description: `Code is organized by architectural layer: ${foundLayers.join(', ')}. Place new code in the appropriate layer — do not create feature-named directories at this level.`,
      prevalence: foundLayers.length / layerDirs.length,
      examples: foundLayers.slice(0, 3).map(d => ({ file: d + '/' })),
      counterExamples: [],
    });
  }

  if (foundFeatures.length >= 2) {
    patterns.push({
      id: 'organization-feature-folders',
      name: 'Feature-based folder structure',
      category: 'file-organization',
      description: `Code is organized by feature/domain: ${foundFeatures.join(', ')}. Each feature owns its own layers. New features get their own directory rather than spreading across shared layer directories.`,
      prevalence: foundFeatures.length / featureDirs.length,
      examples: foundFeatures.slice(0, 3).map(d => ({ file: d + '/' })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── Testing ────────────────────────────────────────────────────────────────────

function detectTestingPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const testFiles = files.filter(f => {
    const name = path.basename(f.entry.path);
    return name.includes('.test.') || name.includes('.spec.') || name.includes('_test.') ||
           f.entry.path.includes('__tests__/') || f.entry.path.includes('/tests/');
  });

  const sourceFiles = files.filter(f => !testFiles.includes(f));

  if (testFiles.length >= 2 && sourceFiles.length >= 2) {
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

    const dotTest = testFiles.filter(t => path.basename(t.entry.path).includes('.test.'));
    const dotSpec = testFiles.filter(t => path.basename(t.entry.path).includes('.spec.'));
    const goTest = testFiles.filter(t => path.basename(t.entry.path).includes('_test.go'));

    if (dotTest.length > dotSpec.length && dotTest.length / testFiles.length >= 0.7) {
      patterns.push({
        id: 'testing-naming-test',
        name: 'Test files use .test. naming',
        category: 'testing',
        description: 'Test files follow the *.test.ts / *.test.js naming convention.',
        prevalence: dotTest.length / testFiles.length,
        examples: dotTest.slice(0, 3).map(t => ({ file: t.entry.path })),
        counterExamples: dotSpec.slice(0, 2).map(t => ({ file: t.entry.path, line: 1, note: 'Uses .spec. instead of .test.' })),
      });
    }

    if (goTest.length >= 2) {
      patterns.push({
        id: 'testing-go-test-files',
        name: 'Go tests in _test.go files',
        category: 'testing',
        description: `Go tests use the \`_test.go\` suffix convention (${goTest.length} test files). Use table-driven tests (\`[]struct{ ... }\`) for multiple cases. Test files can use the \`_test\` package suffix to enforce black-box testing.`,
        prevalence: goTest.length / Math.max(1, files.filter(f => f.entry.language === 'go').length),
        examples: goTest.slice(0, 3).map(t => ({ file: t.entry.path })),
        counterExamples: [],
      });
    }
  }

  return patterns;
}

// ── Type safety ────────────────────────────────────────────────────────────────

function detectTypeSafetyPatterns(files: ParsedFile[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const tsFiles = files.filter(f => f.entry.language === 'typescript');

  if (tsFiles.length < 3) return patterns;

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

  // Detect Zod or yup schema validation
  const zodFiles = tsFiles.filter(f => f.imports.some(i => i.source === 'zod' || i.source.startsWith('zod/')));
  const yupFiles = tsFiles.filter(f => f.imports.some(i => i.source === 'yup'));
  if (zodFiles.length >= 2) {
    patterns.push({
      id: 'types-zod-validation',
      name: 'Zod schema validation',
      category: 'types',
      description: `Runtime validation uses Zod (${zodFiles.length} files). Define schemas near their types, infer the TypeScript type with \`z.infer<typeof Schema>\`. Validate all external data at system boundaries.`,
      prevalence: zodFiles.length / tsFiles.length,
      examples: zodFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── Export patterns ────────────────────────────────────────────────────────────

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
  } else if (defaultExportFiles.length > namedExportFiles.length && defaultExportFiles.length >= 5) {
    patterns.push({
      id: 'exports-default-preferred',
      name: 'Default exports preferred',
      category: 'imports',
      description: 'The codebase uses default exports for components/modules. Use named exports only for utilities with multiple exports.',
      prevalence: defaultExportFiles.length / tsJsFiles.length,
      examples: defaultExportFiles.slice(0, 3).map(f => ({ file: f.entry.path })),
      counterExamples: [],
    });
  }

  return patterns;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function readFileSafe(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return null; }
}
