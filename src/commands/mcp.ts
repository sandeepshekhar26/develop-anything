// ============================================================
// auk — AI Context Engineering Platform
// `auk mcp` — Model Context Protocol server (stdio)
//
// Exposes the knowledge auk has about your codebase — rules,
// dependency graph, decisions, and health — as live MCP tools,
// so agents can QUERY your architecture instead of only reading
// a static CLAUDE.md. Zero dependencies: hand-rolled JSON-RPC
// over newline-delimited stdio, per the MCP stdio transport.
// ============================================================

import * as readline from 'readline';
import { Command } from '../utils/cli.js';
import { loadJson, loadYaml } from '../utils/config.js';
import type { RulesFile, HealthReport } from '../types/rules.js';
import type { DecisionsFile } from '../types/decisions.js';
import type { DependencyGraph } from '../types/analysis.js';

const SERVER_INFO = { name: 'auk', version: '1.0.0' };
const PROTOCOL_VERSION = '2025-06-18';

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: 'get_rules',
    description:
      'Get the codebase-derived context rules (conventions, architecture constraints, patterns). Optionally filter by category: architecture, naming, imports, error-handling, testing, types, patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter' },
      },
    },
  },
  {
    name: 'get_rule',
    description: 'Get full details (evidence, verification, decision link) for a single rule by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Rule id' } },
      required: ['id'],
    },
  },
  {
    name: 'get_health',
    description:
      'Get the latest context-health report: which rules are still valid, degraded, violated, or obsolete.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_architecture',
    description:
      'Get the architectural overview: layers, layer boundaries (allowed/forbidden import directions), and the most connected files.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_dependencies',
    description:
      'For a given file path, list what it imports and which files depend on it, from the dependency graph.',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string', description: 'Project-relative file path' } },
      required: ['file'],
    },
  },
  {
    name: 'get_decisions',
    description:
      'Get the architectural decision log: when/why conventions were adopted, mined from git history, ADRs, and code comments.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function textResult(data: unknown): unknown {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): unknown {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  projectRoot: string
): Promise<unknown> {
  switch (name) {
    case 'get_rules': {
      const rulesFile = await loadYaml<RulesFile>('rules.yaml', projectRoot);
      if (!rulesFile) return errorResult('No rules found. Run `auk generate` first.');
      let rules = rulesFile.rules;
      if (typeof args.category === 'string') {
        rules = rules.filter(r => r.category === args.category);
      }
      return textResult({
        project: rulesFile.project,
        healthScore: rulesFile.healthScore,
        rules: rules.map(r => ({
          id: r.id,
          category: r.category,
          severity: r.severity,
          priority: r.priority,
          description: r.description,
        })),
      });
    }

    case 'get_rule': {
      const rulesFile = await loadYaml<RulesFile>('rules.yaml', projectRoot);
      if (!rulesFile) return errorResult('No rules found. Run `auk generate` first.');
      const rule = rulesFile.rules.find(r => r.id === args.id);
      if (!rule) return errorResult(`Rule not found: ${args.id}`);
      return textResult(rule);
    }

    case 'get_health': {
      const report = loadJson<HealthReport>('health.json', projectRoot);
      if (!report) return errorResult('No health report found. Run `auk verify` first.');
      return textResult(report);
    }

    case 'get_architecture': {
      const graph = loadJson<DependencyGraph>('graph.json', projectRoot);
      if (!graph) return errorResult('No dependency graph found. Run `auk generate` first.');
      const hubs = [...graph.nodes]
        .sort((a, b) => b.centrality.degree - a.centrality.degree)
        .slice(0, 10)
        .map(n => ({ file: n.id, layer: n.layer, connections: n.centrality.degree }));
      return textResult({
        layers: graph.layers,
        boundaries: graph.boundaries,
        mostConnectedFiles: hubs,
        stats: { files: graph.nodes.length, importEdges: graph.edges.length },
      });
    }

    case 'get_dependencies': {
      const graph = loadJson<DependencyGraph>('graph.json', projectRoot);
      if (!graph) return errorResult('No dependency graph found. Run `auk generate` first.');
      const file = String(args.file || '');
      const imports = graph.edges.filter(e => e.source === file).map(e => e.target);
      const dependents = graph.edges.filter(e => e.target === file).map(e => e.source);
      const node = graph.nodes.find(n => n.id === file);
      if (!node && imports.length === 0 && dependents.length === 0) {
        return errorResult(`File not in graph: ${file}. Use project-relative paths (e.g. src/services/user.ts).`);
      }
      return textResult({ file, layer: node?.layer, exports: node?.symbols, imports, dependents });
    }

    case 'get_decisions': {
      const decisions = await loadYaml<DecisionsFile>('decisions.yaml', projectRoot);
      if (!decisions || decisions.decisions.length === 0) {
        return errorResult('No decisions tracked. Run `auk decisions --discover` first.');
      }
      return textResult(decisions);
    }

    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

function respond(id: number | string | null | undefined, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result }) + '\n');
}

function respondError(id: number | string | null | undefined, code: number, message: string): void {
  process.stdout.write(
    JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }) + '\n'
  );
}

export const mcpCommand = new Command('mcp')
  .description('Run auk as an MCP server (stdio) — agents can query rules, graph, decisions, and health live')
  .action(async () => {
    const projectRoot = process.cwd();
    const rl = readline.createInterface({ input: process.stdin, terminal: false });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let req: JsonRpcRequest;
      try {
        req = JSON.parse(trimmed);
      } catch {
        respondError(null, -32700, 'Parse error');
        return;
      }

      try {
        switch (req.method) {
          case 'initialize':
            respond(req.id, {
              protocolVersion:
                typeof req.params?.protocolVersion === 'string'
                  ? req.params.protocolVersion
                  : PROTOCOL_VERSION,
              capabilities: { tools: {} },
              serverInfo: SERVER_INFO,
            });
            break;

          case 'notifications/initialized':
          case 'initialized':
            break; // notification — no response

          case 'ping':
            respond(req.id, {});
            break;

          case 'tools/list':
            respond(req.id, { tools: TOOLS });
            break;

          case 'tools/call': {
            const name = String(req.params?.name || '');
            const args = (req.params?.arguments as Record<string, unknown>) || {};
            const result = await callTool(name, args, projectRoot);
            respond(req.id, result);
            break;
          }

          default:
            if (req.id !== undefined && req.id !== null) {
              respondError(req.id, -32601, `Method not found: ${req.method}`);
            }
        }
      } catch (err) {
        respondError(req.id, -32603, `Internal error: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    // Keep the process alive until stdin closes
    await new Promise<void>((resolvePromise) => {
      rl.on('close', () => resolvePromise());
    });
  });
