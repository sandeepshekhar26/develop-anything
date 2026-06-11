// ============================================================
// auk — AI Context Engineering Platform
// Type definitions for rules
// ============================================================

/** Rule severity levels */
export type RuleSeverity = 'critical' | 'warning' | 'info';

/** Rule categories */
export type RuleCategory =
  | 'architecture'
  | 'naming'
  | 'imports'
  | 'error-handling'
  | 'testing'
  | 'types'
  | 'patterns'
  | 'file-organization'
  | 'dependencies';

/** Verification type for automated checking */
export type VerificationType =
  | 'pattern-match'
  | 'file-exists'
  | 'import-constraint'
  | 'naming-convention'
  | 'no-pattern'
  | 'directory-structure'
  | 'custom';

/** Evidence linking a rule to actual code */
export interface RuleEvidence {
  file: string;
  line?: number;
  note: string;
}

/** Verification configuration for a rule */
export interface RuleVerification {
  type: VerificationType;
  pattern?: string;
  source?: string;
  target?: string;
  forbidden?: string;
  threshold?: number;
  knownViolations?: number;
  /** which symbol kinds a naming convention applies to */
  subject?: 'class' | 'function' | 'all';
}

/** LLM-written enhancement of a rule. The deterministic core (id,
    verification, evidence, confidence) is never touched by enhancement,
    so a bad LLM response cannot corrupt verification. */
export interface RuleEnhancement {
  description: string;
  rationale?: string;
  examples?: RuleEvidence[];
  enhancedAt: string;
  source: string;              // e.g. 'host-agent'
  /** set when the deterministic description changed after enhancement */
  stale?: boolean;
}

/** A single rule in the rules.yaml */
export interface Rule {
  id: string;
  category: RuleCategory;
  severity: RuleSeverity;
  priority: number;           // 0-100, higher = more important
  description: string;
  evidence: RuleEvidence[];
  appliesTo?: string;         // glob pattern
  verification: RuleVerification;
  decisionRef?: string;       // links to decisions.yaml
  confidence: number;         // 0-1, how confident the analysis is
  enhanced?: RuleEnhancement; // optional LLM-polished layer (v2)
}

/** Response schema for `auk enhance --apply` (written by a host agent) */
export interface EnhancementResponse {
  version: 1;
  batch: string;
  enhancements: Array<{
    ruleId: string;
    description: string;
    rationale?: string;
    examples?: Array<{ file: string; note: string }>;
  }>;
}

/** A high-level orientation map of the repo, rendered at the top of
    CLAUDE.md/AGENTS.md so an agent knows the lay of the land before rules. */
export interface ProjectOverview {
  summary: string;                                  // one-paragraph what-this-is
  stack: string[];                                  // detected tech, human-readable
  entrypoints: Array<{ path: string; note: string }>;
  directories: Array<{ path: string; role: string }>;
  commands: Array<{ label: string; command: string }>;
}

/** The complete rules.yaml structure */
export interface RulesFile {
  version: number;
  generatedAt: string;
  healthScore: number;
  project: {
    name: string;
    languages: string[];
    framework?: string;
  };
  overview?: ProjectOverview;
  rules: Rule[];
}

/** Claim status from verification */
export type ClaimStatus = 'valid' | 'degraded' | 'violated' | 'obsolete';

/** A verifiable claim extracted from a rule */
export interface VerifiableClaim {
  ruleId: string;
  description: string;
  type: VerificationType;
  assertion: string;
  threshold: number;
  /** glob limiting which files the claim applies to */
  appliesTo?: string;
  /** which symbol kinds a naming convention applies to */
  subject?: 'class' | 'function' | 'all';
  status?: ClaimStatus;
  actualScore?: number;
  details?: string;
}

/** Verification result for a single rule */
export interface VerificationResult {
  ruleId: string;
  status: ClaimStatus;
  claims: VerifiableClaim[];
  score: number;              // 0-1
  details: string;
}

/** Overall health report */
export interface HealthReport {
  timestamp: string;
  overallScore: number;       // 0-100
  totalRules: number;
  valid: number;
  degraded: number;
  violated: number;
  obsolete: number;
  results: VerificationResult[];
}
