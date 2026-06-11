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
