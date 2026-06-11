// ============================================================
// auk — AI Context Engineering Platform
// Type definitions for architectural review
// ============================================================

/** Severity of a review finding */
export type ReviewSeverity = 'violation' | 'warning' | 'suggestion' | 'clean';

/** Type of architectural issue */
export type ViolationType =
  | 'boundary-violation'
  | 'circular-dependency'
  | 'god-object'
  | 'rule-violation'
  | 'convention-violation'
  | 'complexity-increase';

/** A changed file in a diff */
export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  addedLines: DiffLine[];
  removedLines: DiffLine[];
  addedImports: string[];
  removedImports: string[];
  addedSymbols: string[];
}

/** A single line in a diff */
export interface DiffLine {
  number: number;
  content: string;
}

/** An architectural violation found in a diff */
export interface Violation {
  type: ViolationType;
  severity: ReviewSeverity;
  file: string;
  line?: number;
  message: string;
  explanation: string;
  suggestion?: string;
  relatedRule?: string;
  relatedDecision?: string;
}

/** Complexity change for a file */
export interface ComplexityChange {
  file: string;
  before: { degree: number; betweenness: number };
  after: { degree: number; betweenness: number };
  degreeChange: number;
  isGodObjectRisk: boolean;
}

/** New edge added by the diff */
export interface NewEdge {
  source: string;
  target: string;
  symbols: string[];
  crossesBoundary: boolean;
  createsCycle: boolean;
}

/** Complete review result */
export interface ReviewResult {
  timestamp: string;
  diffBase: string;
  totalFilesChanged: number;
  violations: Violation[];
  complexityChanges: ComplexityChange[];
  newEdges: NewEdge[];
  summary: {
    clean: number;
    suggestions: number;
    warnings: number;
    violations: number;
  };
}
