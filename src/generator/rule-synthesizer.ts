// ============================================================
// auk — AI Context Engineering Platform
// Rule synthesizer — converts analysis into structured rules
// ============================================================

import type { AnalysisResult, DetectedPattern } from '../types/analysis.js';
import type { Rule, RuleCategory, RuleSeverity, RuleVerification, RulesFile } from '../types/rules.js';
import { rankRules } from './priority-ranker.js';
import { logger } from '../utils/logger.js';

/** Convert a detected pattern into a Rule */
function patternToRule(pattern: DetectedPattern): Rule {
  const categoryMap: Record<string, RuleCategory> = {
    'naming': 'naming',
    'error-handling': 'error-handling',
    'imports': 'imports',
    'file-organization': 'file-organization',
    'testing': 'testing',
    'types': 'types',
    'patterns': 'patterns',
  };

  const severityByPrevalence = (p: number): RuleSeverity => {
    if (p >= 0.9) return 'critical';
    if (p >= 0.7) return 'warning';
    return 'info';
  };

  // Map each known pattern to a concrete, machine-verifiable check.
  // Patterns without a reliable check use 'custom' (excluded from scoring).
  const verificationMap: Record<string, RuleVerification> = {
    'naming-functions-camelcase': { type: 'naming-convention', pattern: 'camelCase', subject: 'function' },
    'naming-functions-snake-case': { type: 'naming-convention', pattern: 'snake_case', subject: 'function' },
    'naming-classes-pascalcase': { type: 'naming-convention', pattern: 'PascalCase', subject: 'class' },
    'error-handling-result-pattern': { type: 'pattern-match', pattern: 'Result<' },
    'error-handling-try-catch': { type: 'pattern-match', pattern: 'try {' },
    'exports-named-only': { type: 'no-pattern', pattern: 'export default' },
    'types-prefer-interface': { type: 'pattern-match', pattern: 'interface ' },
    'types-prefer-type-alias': { type: 'pattern-match', pattern: 'type ' },
    'imports-relative': { type: 'pattern-match', pattern: "from '." },
  };

  const verification: RuleVerification = verificationMap[pattern.id]
    ? { ...verificationMap[pattern.id], threshold: pattern.prevalence }
    : { type: 'custom', threshold: pattern.prevalence };

  if (pattern.id.includes('import-constraint') || pattern.id.includes('no-controller-in-service')) {
    verification.type = 'import-constraint';
  }

  return {
    id: pattern.id,
    category: categoryMap[pattern.category] || 'patterns',
    severity: severityByPrevalence(pattern.prevalence),
    priority: 0, // Will be set by priority ranker
    description: pattern.description,
    evidence: pattern.examples.map(ex => ({
      file: ex.file,
      line: ex.line,
      note: 'Example of this pattern',
    })),
    appliesTo: undefined,
    verification,
    confidence: pattern.prevalence,
  };
}

/** Generate architecture rules from the dependency graph */
function generateArchRules(analysis: AnalysisResult): Rule[] {
  const rules: Rule[] = [];

  // Layer boundary rules
  for (const boundary of analysis.graph.boundaries) {
    if (!boundary.allowed && boundary.violations > 0) {
      rules.push({
        id: `architecture-no-${boundary.from}-to-${boundary.to}`,
        category: 'architecture',
        severity: 'critical',
        priority: 0,
        description: `${capitalize(boundary.from)} layer should not import from ${capitalize(boundary.to)} layer. ${boundary.violations} existing violation${boundary.violations > 1 ? 's are' : ' is'} known tech debt — don't add more.`,
        evidence: [],
        verification: {
          type: 'import-constraint',
          source: `${boundary.from}/**`,
          forbidden: `${boundary.to}/**`,
          knownViolations: boundary.violations,
        },
        confidence: 0.9,
      });
    }
  }

  // Hub file warnings
  const hubs = analysis.graph.nodes
    .filter(n => n.centrality.degree >= 8)
    .sort((a, b) => b.centrality.degree - a.centrality.degree);

  for (const hub of hubs.slice(0, 3)) {
    rules.push({
      id: `architecture-hub-${hub.id.replace(/[\/\.]/g, '-')}`,
      category: 'architecture',
      severity: 'warning',
      priority: 0,
      description: `${hub.id} has ${hub.centrality.degree} connections — it may be becoming a god object. Consider breaking it into smaller modules.`,
      evidence: [{ file: hub.id, note: `${hub.centrality.degree} connections (degree centrality)` }],
      verification: { type: 'custom' },
      confidence: 0.7,
    });
  }

  return rules;
}

/** Generate symbol-level rules from the call graph (v2 graphs only).
    Gated on tree-sitter coverage so regex-only repos don't get noisy rules. */
function generateCallGraphRules(analysis: AnalysisResult): Rule[] {
  const graph = analysis.graph;
  const symbols = graph.symbols ?? [];
  const coverage = graph.parserCoverage;
  if (symbols.length === 0 || !coverage) return [];
  const total = coverage.treeSitter + coverage.regex;
  if (total === 0 || coverage.treeSitter / total < 0.5) return [];

  const rules: Rule[] = [];

  // Hotspot functions: high resolved fan-in means high blast radius
  const hotspots = symbols
    .filter(s => s.metrics.fanIn >= 10 && (s.kind === 'function' || s.kind === 'method'))
    .sort((a, b) => b.metrics.fanIn - a.metrics.fanIn);
  for (const hs of hotspots.slice(0, 3)) {
    rules.push({
      id: `architecture-hotspot-${hs.id.replace(/[\/\.#]/g, '-')}`,
      category: 'architecture',
      severity: 'warning',
      priority: 0,
      description: `${hs.name} (${hs.file}) is called from ${hs.metrics.fanIn} places — changes here have a high blast radius. Keep its signature and behavior stable.`,
      evidence: [{ file: hs.file, line: hs.line, note: `fan-in ${hs.metrics.fanIn}` }],
      verification: { type: 'custom' },
      confidence: 0.85,
    });
  }

  // God classes: many methods drawing lots of inbound traffic
  const methodsByClass = new Map<string, SymbolNodeLite[]>();
  for (const s of symbols) {
    if (s.kind !== 'method') continue;
    const key = `${s.file}#${s.name.split('.')[0]}`;
    if (!methodsByClass.has(key)) methodsByClass.set(key, []);
    methodsByClass.get(key)!.push(s);
  }
  for (const s of symbols) {
    if (s.kind !== 'class') continue;
    const methods = methodsByClass.get(s.id) ?? [];
    const totalFanIn = methods.reduce((n, m) => n + m.metrics.fanIn, s.metrics.fanIn);
    if (methods.length >= 15 || totalFanIn >= 20) {
      rules.push({
        id: `architecture-god-class-${s.id.replace(/[\/\.#]/g, '-')}`,
        category: 'architecture',
        severity: 'warning',
        priority: 0,
        description: `${s.name} (${s.file}) has ${methods.length} methods and ${totalFanIn} inbound calls — it is becoming a god object. Don't add more responsibilities; split it instead.`,
        evidence: [{ file: s.file, line: s.line, note: `${methods.length} methods, ${totalFanIn} inbound calls` }],
        verification: { type: 'custom' },
        confidence: 0.8,
      });
    }
  }

  // Function-length convention from the p90 of measured bodies
  const sizes = symbols
    .filter(s => (s.kind === 'function' || s.kind === 'method') && s.metrics.bodySize !== undefined)
    .map(s => s.metrics.bodySize!)
    .sort((a, b) => a - b);
  if (sizes.length >= 20) {
    const p90 = sizes[Math.floor(sizes.length * 0.9)];
    rules.push({
      id: 'patterns-function-length',
      category: 'patterns',
      severity: 'info',
      priority: 0,
      description: `90% of functions in this codebase are ${p90} lines or shorter. Keep new functions in that range; extract helpers instead of growing bodies.`,
      evidence: [],
      verification: { type: 'custom', threshold: 0.9 },
      confidence: 0.75,
    });
  }

  return rules;
}

type SymbolNodeLite = NonNullable<AnalysisResult['graph']['symbols']>[number];

/** Synthesize rules from analysis results */
export function synthesizeRules(analysis: AnalysisResult, projectName: string): RulesFile {
  logger.debug('Synthesizing rules from analysis...');

  // Convert patterns to rules
  const patternRules = analysis.patterns.map(patternToRule);

  // Generate architecture rules
  const archRules = generateArchRules(analysis);

  // Generate symbol-level rules from the call graph
  const callGraphRules = generateCallGraphRules(analysis);

  // Combine and rank
  const allRules = [...archRules, ...callGraphRules, ...patternRules];
  const rankedRules = rankRules(allRules, analysis);

  // Determine project languages
  const languages = Object.entries(analysis.stats.languageBreakdown)
    .filter(([lang]) => lang !== 'unknown')
    .sort(([, a], [, b]) => b - a)
    .map(([lang]) => lang);

  // Detect framework
  const framework = detectFramework(analysis);

  // Calculate health score (100% initially since we just generated the rules)
  const healthScore = 100;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    healthScore,
    project: {
      name: projectName,
      languages,
      framework,
    },
    rules: rankedRules,
  };
}

/** Detect the primary framework */
function detectFramework(analysis: AnalysisResult): string | undefined {
  const allImports = analysis.parsedFiles.flatMap(f => f.imports.map(i => i.source));

  const frameworks: Record<string, string> = {
    'next': 'Next.js',
    'next/': 'Next.js',
    'react': 'React',
    'react-dom': 'React',
    '@angular/core': 'Angular',
    'vue': 'Vue.js',
    'svelte': 'Svelte',
    'express': 'Express',
    'fastify': 'Fastify',
    'nestjs': 'NestJS',
    '@nestjs/core': 'NestJS',
    'django': 'Django',
    'flask': 'Flask',
    'fastapi': 'FastAPI',
    'gin-gonic/gin': 'Gin',
    'spring': 'Spring Boot',
  };

  for (const [pkg, name] of Object.entries(frameworks)) {
    if (allImports.some(i => i === pkg || i.startsWith(pkg))) {
      return name;
    }
  }

  return undefined;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
