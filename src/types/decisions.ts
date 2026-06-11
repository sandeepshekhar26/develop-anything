// ============================================================
// auk — AI Context Engineering Platform
// Type definitions for decisions
// ============================================================

/** Status of a decision */
export type DecisionStatus = 'active' | 'evolving' | 'deprecated' | 'superseded';

/** Source types for decision rationale */
export type DecisionSourceType = 'commit' | 'pr' | 'comment' | 'adr' | 'readme' | 'manual';

/** A source of evidence for a decision */
export interface DecisionSource {
  type: DecisionSourceType;
  ref?: string;              // commit hash, PR number, etc.
  file?: string;
  line?: number;
  message?: string;
  title?: string;
  text?: string;
}

/** A snapshot in the evolution of a pattern */
export interface EvolutionSnapshot {
  date: string;
  adoption: number;          // percentage 0-100
  state: string;             // human-readable description
}

/** A single architectural decision */
export interface Decision {
  id: string;
  title: string;
  decidedAt: string;
  decidedBy: string;
  commit?: string;
  rationale: string;
  sources: DecisionSource[];
  evolution: EvolutionSnapshot[];
  status: DecisionStatus;
  relatedRules: string[];
  knownViolations?: number;
  violationNotes?: string;
}

/** The complete decisions.yaml structure */
export interface DecisionsFile {
  version: number;
  decisions: Decision[];
}
