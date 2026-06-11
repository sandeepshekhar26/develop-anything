// ============================================================
// auk — AI Context Engineering Platform
// Type definitions for configuration
// ============================================================

/** Supported AI coding agent targets */
export type CompilerTargetName =
  | 'claude-md'
  | 'agents-md'
  | 'cursor-rules'
  | 'copilot-md'
  | 'aider-conf'
  | 'windsurf-rules'
  | 'gemini-settings';

/** LLM provider for optional enhancement */
export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

/** auk configuration stored in .auk/config.yaml */
export interface AukConfig {
  version: number;
  project: {
    name: string;
    root: string;
  };
  targets: CompilerTargetName[];
  llm?: {
    provider: LLMProvider;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };
  analysis: {
    include: string[];
    exclude: string[];
    languages: string[];
    conventionThreshold: number; // 0-1, default 0.8
    maxFiles: number;
  };
  verification: {
    validThreshold: number;      // default 0.9
    degradedThreshold: number;   // default 0.6
  };
  review: {
    centralityThreshold: number; // default 8
    maxViolations: number;       // default 0 for CI mode
  };
  hooks: {
    postCommit: boolean;
    preCommit: boolean;
  };
}

/** Default configuration */
export const DEFAULT_CONFIG: AukConfig = {
  version: 1,
  project: {
    name: '',
    root: '.',
  },
  targets: ['claude-md', 'agents-md', 'cursor-rules', 'copilot-md'],
  analysis: {
    include: ['**/*'],
    exclude: [
      'node_modules/**', 'dist/**', 'build/**', '.git/**',
      'coverage/**', '*.min.js', '*.bundle.js', 'vendor/**',
      '__pycache__/**', '.venv/**', 'target/**',
    ],
    languages: ['typescript', 'javascript', 'python', 'go', 'java', 'rust', 'ruby', 'php', 'csharp'],
    conventionThreshold: 0.8,
    maxFiles: 5000,
  },
  verification: {
    validThreshold: 0.9,
    degradedThreshold: 0.6,
  },
  review: {
    centralityThreshold: 8,
    maxViolations: 0,
  },
  hooks: {
    postCommit: false,
    preCommit: false,
  },
};
