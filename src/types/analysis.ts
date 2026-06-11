// ============================================================
// auk — AI Context Engineering Platform
// Type definitions for code analysis
// ============================================================

/** Supported programming languages */
export type Language =
  | 'typescript' | 'javascript' | 'python' | 'go'
  | 'java' | 'rust' | 'ruby' | 'php' | 'csharp'
  | 'unknown';

/** Architectural layers */
export type ArchLayer =
  | 'api' | 'controller' | 'service' | 'data'
  | 'model' | 'ui' | 'utility' | 'config'
  | 'test' | 'unknown';

/** A scanned file entry */
export interface FileEntry {
  path: string;              // relative path from project root
  absolutePath: string;
  language: Language;
  size: number;              // bytes
  hash: string;              // content hash for change detection
}

/** An extracted symbol (function, class, etc.) */
export interface ExtractedSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'constant' | 'method';
  exported: boolean;
  line: number;
  endLine?: number;
  parameters?: string[];
  returnType?: string;
  parentSymbol?: string;     // owning class for methods
  bodySize?: number;         // lines in body (tree-sitter only)
  complexityHint?: number;   // branch-node count (tree-sitter only)
}

/** A call site extracted from a function/method body (tree-sitter only) */
export interface CallSite {
  caller: string;            // enclosing symbol ('' = module top level)
  callee: string;            // callee as written ('foo' or 'obj.bar')
  calleeRoot?: string;       // leftmost identifier for member calls
  line: number;
  kind: 'call' | 'new' | 'extends' | 'implements';
}

/** Import information */
export interface ImportInfo {
  source: string;            // module specifier
  symbols: string[];         // imported names
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
  resolvedPath?: string;     // resolved file path
}

/** Export information */
export interface ExportInfo {
  name: string;
  type: 'named' | 'default' | 'all';
  line: number;
}

/** A parsed file with all extracted information */
export interface ParsedFile {
  entry: FileEntry;
  imports: ImportInfo[];
  exports: ExportInfo[];
  symbols: ExtractedSymbol[];
  comments: string[];         // notable comments
  calls?: CallSite[];         // tree-sitter only
  parserUsed?: 'tree-sitter' | 'regex';
}

/** An edge in the import graph */
export interface ImportEdge {
  source: string;            // source file path
  target: string;            // target file path
  symbols: string[];         // imported symbols
  type: 'import' | 'require' | 'dynamic';
}

/** A node in the dependency graph */
export interface GraphNode {
  id: string;                // file path
  type: 'file';
  layer: ArchLayer;
  symbols: string[];
  centrality: {
    degree: number;
    betweenness: number;
  };
}

/** A symbol-level node in the call graph (v2) */
export interface SymbolNode {
  id: string;                // "src/a.ts#Class.method"
  file: string;
  name: string;
  kind: 'function' | 'class' | 'method' | 'interface';
  exported: boolean;
  line: number;
  endLine?: number;
  metrics: {
    fanIn: number;           // resolved inbound calls
    fanOut: number;          // outbound calls (incl. unresolved)
    bodySize?: number;
    complexity?: number;
  };
}

/** A symbol-level call edge (v2) */
export interface CallEdge {
  source: string;            // symbol id
  target: string;            // symbol id, or "external:<name>"
  kind: 'call' | 'instantiation' | 'inherits' | 'implements';
  line: number;
  resolved: boolean;
}

/** The complete dependency graph */
export interface DependencyGraph {
  version: number;
  generatedAt: string;
  nodes: GraphNode[];
  edges: ImportEdge[];
  layers: Record<ArchLayer, string[]>;
  boundaries: LayerBoundary[];
  // v2 additions (absent in v1 graph.json files)
  symbols?: SymbolNode[];
  callEdges?: CallEdge[];
  parserCoverage?: { treeSitter: number; regex: number };
}

/** Layer boundary rule */
export interface LayerBoundary {
  from: ArchLayer;
  to: ArchLayer;
  allowed: boolean;
  violations: number;
}

/** A detected pattern/convention */
export interface DetectedPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  prevalence: number;        // 0-1, how many files follow this
  examples: Array<{ file: string; line?: number }>;
  counterExamples: Array<{ file: string; line?: number; note: string }>;
}

/** Layer classification result */
export interface LayerClassification {
  file: string;
  layer: ArchLayer;
  confidence: number;
  signals: string[];         // what signals led to this classification
}

/** Full analysis result */
export interface AnalysisResult {
  scannedFiles: FileEntry[];
  parsedFiles: ParsedFile[];
  graph: DependencyGraph;
  patterns: DetectedPattern[];
  layers: LayerClassification[];
  stats: {
    totalFiles: number;
    totalSymbols: number;
    totalImports: number;
    languageBreakdown: Record<string, number>;
    layerBreakdown: Record<string, number>;
  };
}
