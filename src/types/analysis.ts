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
  type: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'constant';
  exported: boolean;
  line: number;
  endLine?: number;
  parameters?: string[];
  returnType?: string;
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

/** The complete dependency graph */
export interface DependencyGraph {
  version: number;
  generatedAt: string;
  nodes: GraphNode[];
  edges: ImportEdge[];
  layers: Record<ArchLayer, string[]>;
  boundaries: LayerBoundary[];
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
