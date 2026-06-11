// ============================================================
// auk — AI Context Engineering Platform
// Project overview generator — builds the "lay of the land" map
// (stack, entrypoints, directory roles, build/run commands) from
// manifest files + the dependency graph. Deterministic.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { AnalysisResult } from '../types/analysis.js';
import type { ProjectOverview } from '../types/rules.js';

interface ManifestFacts {
  packageJson?: any;
  hasWails: boolean;
  wailsJson?: any;
  hasGoMod: boolean;
  goModule?: string;
  makeTargets: string[];
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
}

export function buildProjectOverview(
  analysis: AnalysisResult,
  projectName: string,
  projectRoot: string
): ProjectOverview {
  const facts = readManifests(projectRoot);
  const stack = detectStack(analysis, facts);
  const entrypoints = detectEntrypoints(analysis, facts, projectRoot);
  const directories = describeDirectories(analysis);
  const commands = detectCommands(facts);
  const summary = buildSummary(projectName, analysis, stack, facts);

  return { summary, stack, entrypoints, directories, commands };
}

// ── Manifests ──────────────────────────────────────────────────────────────────

function readManifests(root: string): ManifestFacts {
  const facts: ManifestFacts = {
    hasWails: false,
    hasGoMod: false,
    makeTargets: [],
    hasDockerfile: false,
    hasDockerCompose: false,
  };

  facts.packageJson = readJson(path.join(root, 'package.json'))
    ?? readJson(path.join(root, 'frontend', 'package.json'));

  const wailsPath = firstExisting(root, ['wails.json', 'build/wails.json']);
  if (wailsPath) { facts.hasWails = true; facts.wailsJson = readJson(wailsPath); }

  const goMod = firstExisting(root, ['go.mod', 'backend/go.mod']);
  if (goMod) {
    facts.hasGoMod = true;
    const content = readText(goMod);
    const m = content?.match(/^module\s+(\S+)/m);
    if (m) facts.goModule = m[1];
  }

  const makefile = firstExisting(root, ['Makefile', 'makefile']);
  if (makefile) facts.makeTargets = parseMakeTargets(readText(makefile) ?? '');

  facts.hasDockerfile = !!firstExisting(root, ['Dockerfile', 'backend/Dockerfile']);
  facts.hasDockerCompose = !!firstExisting(root, ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml']);

  return facts;
}

// ── Stack detection ─────────────────────────────────────────────────────────────

function detectStack(analysis: AnalysisResult, facts: ManifestFacts): string[] {
  const stack = new Set<string>();
  const deps: Record<string, string> = {
    ...(facts.packageJson?.dependencies ?? {}),
    ...(facts.packageJson?.devDependencies ?? {}),
  };
  const has = (name: string) => name in deps;
  const allImports = analysis.parsedFiles.flatMap(f => f.imports.map(i => i.source));
  const importsAny = (substr: string) => allImports.some(i => i.includes(substr));

  if (facts.hasWails) {
    const v = facts.wailsJson?.version ? ` (schema v${facts.wailsJson.version})` : '';
    stack.add(`Wails${v} — Go + web desktop app`);
  }

  // Frontend frameworks
  if (has('next')) {
    const appRouter = analysis.parsedFiles.some(f => /(^|\/)app\/.*\/page\.(tsx|ts|jsx|js)$/.test(f.entry.path) || /(^|\/)app\/page\.(tsx|ts|jsx|js)$/.test(f.entry.path));
    stack.add(`Next.js${appRouter ? ' (App Router)' : ' (Pages Router)'}`);
  } else if (has('react')) {
    stack.add('React');
  }
  if (has('vue')) stack.add('Vue.js');
  if (has('svelte')) stack.add('Svelte');
  if (has('@angular/core')) stack.add('Angular');

  // Styling
  if (has('tailwindcss')) stack.add('Tailwind CSS');
  if (has('@mui/material')) stack.add('Material UI');
  if (has('@chakra-ui/react')) stack.add('Chakra UI');

  // State / data
  if (has('zustand')) stack.add('Zustand (state)');
  if (has('@reduxjs/toolkit') || has('redux')) stack.add('Redux Toolkit (state)');
  if (has('@tanstack/react-query') || has('react-query')) stack.add('TanStack Query (server state)');
  if (has('zod')) stack.add('Zod (validation)');

  // Backend frameworks (Go)
  if (importsAny('gin-gonic/gin')) stack.add('Gin (Go HTTP)');
  if (importsAny('labstack/echo')) stack.add('Echo (Go HTTP)');
  if (importsAny('gofiber/fiber')) stack.add('Fiber (Go HTTP)');
  if (importsAny('gorm.io/gorm')) stack.add('GORM (Go ORM)');
  if (importsAny('jmoiron/sqlx')) stack.add('sqlx (Go DB)');

  // Backend frameworks (Node)
  if (has('express')) stack.add('Express');
  if (has('fastify')) stack.add('Fastify');
  if (has('@nestjs/core')) stack.add('NestJS');

  // Python
  if (importsAny('fastapi')) stack.add('FastAPI');
  if (importsAny('django')) stack.add('Django');
  if (importsAny('flask')) stack.add('Flask');

  // Languages present
  const langs = Object.entries(analysis.stats.languageBreakdown)
    .filter(([l]) => l !== 'unknown')
    .sort(([, a], [, b]) => b - a)
    .map(([l]) => l);
  if (facts.hasGoMod && !langs.includes('go')) langs.push('go');

  // Infra
  if (facts.hasDockerCompose) stack.add('Docker Compose');
  else if (facts.hasDockerfile) stack.add('Docker');

  return [...stack];
}

// ── Entrypoints ─────────────────────────────────────────────────────────────────

function detectEntrypoints(
  analysis: AnalysisResult,
  facts: ManifestFacts,
  root: string
): Array<{ path: string; note: string }> {
  const entries: Array<{ path: string; note: string }> = [];
  const files = analysis.parsedFiles.map(f => f.entry.path);

  // Go main packages
  for (const f of analysis.parsedFiles) {
    if (f.entry.language !== 'go') continue;
    if (path.basename(f.entry.path) !== 'main.go') continue;
    const hasMain = f.symbols.some(s => s.name === 'main' && s.type === 'function');
    if (hasMain || f.entry.path.includes('cmd/')) {
      const note = facts.hasWails && (f.entry.path.includes('cmd/') || f.symbols.some(s => s.name === 'main'))
        ? 'Application entrypoint (likely the Wails app bootstrap)'
        : 'Go application entrypoint (func main)';
      entries.push({ path: f.entry.path, note });
    }
  }

  // Next.js root layout / app entry
  const rootLayout = files.find(p => /(^|\/)app\/layout\.(tsx|ts|jsx|js)$/.test(p));
  if (rootLayout) entries.push({ path: rootLayout, note: 'Next.js App Router root layout (wraps every page)' });
  const pagesApp = files.find(p => /(^|\/)pages\/_app\.(tsx|ts|jsx|js)$/.test(p));
  if (pagesApp) entries.push({ path: pagesApp, note: 'Next.js Pages Router app shell' });

  // package.json main/bin
  if (facts.packageJson?.main && typeof facts.packageJson.main === 'string') {
    entries.push({ path: facts.packageJson.main, note: 'Package main entry (package.json "main")' });
  }
  const bin = facts.packageJson?.bin;
  if (bin && typeof bin === 'object') {
    for (const [name, p] of Object.entries(bin)) {
      if (typeof p === 'string') entries.push({ path: p, note: `CLI entrypoint "${name}" (package.json bin)` });
    }
  } else if (typeof bin === 'string') {
    entries.push({ path: bin, note: 'CLI entrypoint (package.json bin)' });
  }

  // Vite/index root
  const indexHtml = files.find(p => p === 'index.html' || p === 'frontend/index.html');
  if (indexHtml && entries.every(e => e.path !== indexHtml)) {
    entries.push({ path: indexHtml, note: 'Web app HTML entry' });
  }

  // de-dup, cap
  const seen = new Set<string>();
  return entries.filter(e => !seen.has(e.path) && seen.add(e.path)).slice(0, 8);
}

// ── Directory roles ─────────────────────────────────────────────────────────────

function describeDirectories(analysis: AnalysisResult): Array<{ path: string; role: string }> {
  // count files per second-level directory, then describe by name + dominant layer
  const dirFiles = new Map<string, number>();
  const dirLang = new Map<string, Map<string, number>>();

  for (const f of analysis.parsedFiles) {
    const parts = f.entry.path.split('/');
    if (parts.length < 2) continue;
    const dir = parts.slice(0, -1).join('/'); // the file's containing directory
    dirFiles.set(dir, (dirFiles.get(dir) ?? 0) + 1);
    if (!dirLang.has(dir)) dirLang.set(dir, new Map());
    const lm = dirLang.get(dir)!;
    lm.set(f.entry.language, (lm.get(f.entry.language) ?? 0) + 1);
  }

  const ranked = [...dirFiles.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return ranked.map(([dir, n]) => {
    const langs = dirLang.get(dir)!;
    const topLang = [...langs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    return { path: dir + '/', role: `${roleForDir(dir)} — ${n} files${topLang ? `, mostly ${topLang}` : ''}` };
  });
}

function roleForDir(dir: string): string {
  const base = dir.split('/').pop()!.toLowerCase();
  const map: Record<string, string> = {
    handlers: 'HTTP/RPC handlers', handler: 'HTTP/RPC handlers',
    services: 'business logic', service: 'business logic',
    repository: 'data access', repositories: 'data access', repo: 'data access', store: 'data access', stores: 'state stores',
    models: 'domain models', model: 'domain models', entities: 'domain entities', entity: 'domain entities', domain: 'domain layer',
    controllers: 'request controllers', controller: 'request controllers',
    middleware: 'middleware', config: 'configuration', configs: 'configuration',
    utils: 'shared utilities', helpers: 'shared helpers', lib: 'library code', pkg: 'reusable packages',
    cmd: 'command entrypoints', internal: 'private application packages',
    components: 'UI components', component: 'UI components', pages: 'page routes', app: 'app routes/layouts',
    hooks: 'React hooks', api: 'API layer', routes: 'route definitions',
    types: 'type definitions', schema: 'schemas', schemas: 'schemas',
    tests: 'tests', test: 'tests', __tests__: 'tests',
    migrations: 'DB migrations', frontend: 'frontend app', backend: 'backend app',
    assets: 'static assets', public: 'public static files', scripts: 'build/dev scripts',
  };
  return map[base] ?? 'source';
}

// ── Commands ────────────────────────────────────────────────────────────────────

function detectCommands(facts: ManifestFacts): Array<{ label: string; command: string }> {
  const cmds: Array<{ label: string; command: string }> = [];
  const seen = new Set<string>();
  const add = (label: string, command: string) => {
    if (seen.has(command)) return;
    seen.add(command);
    cmds.push({ label, command });
  };

  if (facts.hasWails) {
    add('Dev (live reload)', 'wails dev');
    add('Build desktop app', 'wails build');
  }

  const scripts = facts.packageJson?.scripts ?? {};
  const pm = 'npm run';
  for (const key of ['dev', 'start', 'build', 'test', 'lint', 'typecheck']) {
    if (scripts[key]) add(`${cap(key)} (frontend)`, `${pm} ${key}`);
  }

  if (facts.hasGoMod) {
    add('Run Go tests', 'go test ./...');
    add('Build Go', 'go build ./...');
  }

  for (const t of facts.makeTargets.slice(0, 4)) {
    add(`make ${t}`, `make ${t}`);
  }

  if (facts.hasDockerCompose) add('Start services', 'docker compose up');

  return cmds.slice(0, 10);
}

// ── Summary ─────────────────────────────────────────────────────────────────────

function buildSummary(
  projectName: string,
  analysis: AnalysisResult,
  stack: string[],
  facts: ManifestFacts
): string {
  const fileCount = analysis.parsedFiles.length;
  const langs = Object.entries(analysis.stats.languageBreakdown)
    .filter(([l]) => l !== 'unknown')
    .sort(([, a], [, b]) => b - a)
    .map(([l]) => l);

  let kind = 'codebase';
  if (facts.hasWails) kind = 'Wails desktop application (Go backend + web frontend)';
  else if (stack.some(s => s.startsWith('Next.js')) && facts.hasGoMod) kind = 'full-stack application (Go backend + Next.js frontend)';
  else if (stack.some(s => s.startsWith('Next.js'))) kind = 'Next.js web application';
  else if (facts.hasGoMod && langs[0] === 'go') kind = 'Go service';
  else if (stack.some(s => s.includes('Express') || s.includes('NestJS') || s.includes('Fastify'))) kind = 'Node.js backend service';

  const topStack = stack.slice(0, 5).join(', ');
  return `\`${projectName}\` is a ${kind} (${fileCount} source files, primarily ${langs.slice(0, 3).join('/')}).` +
    (topStack ? ` Key stack: ${topStack}.` : '');
}

// ── IO helpers ───────────────────────────────────────────────────────────────────

function readJson(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return undefined; }
}
function readText(p: string): string | undefined {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return undefined; }
}
function firstExisting(root: string, rels: string[]): string | undefined {
  for (const r of rels) { const p = path.join(root, r); if (fs.existsSync(p)) return p; }
  return undefined;
}
function parseMakeTargets(content: string): string[] {
  const targets: string[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^([a-zA-Z][\w-]*)\s*:(?!=)/);
    if (m && !targets.includes(m[1]) && m[1] !== 'PHONY') targets.push(m[1]);
  }
  return targets;
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
