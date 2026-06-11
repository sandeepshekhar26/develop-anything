// ============================================================
// auk — AI Context Engineering Platform
// Tree-sitter parser — AST-accurate symbols, call sites, body
// spans, and complexity hints. Imports/exports/comments reuse
// the regex extractor (line-oriented constructs it handles well);
// the AST adds what regex cannot: bodies, calls, nesting.
// ============================================================

import type { Node, Parser, Query } from 'web-tree-sitter';
import type { CallSite, ExtractedSymbol, FileEntry, ParsedFile } from '../../types/analysis.js';
import { parseFileRegex } from '../regex-parser.js';
import { GRAMMARS, type LanguageSpec } from './queries.js';

const DEF_TYPES: Record<string, ExtractedSymbol['type']> = {
  'def.function': 'function',
  'def.var.fn': 'function',
  'def.class': 'class',
  'def.interface': 'interface',
  'def.type': 'type',
  'def.enum': 'enum',
  'def.method': 'method',
};

export function parseWithTreeSitter(entry: FileEntry, content: string, parser: Parser, query: Query, grammarKey: string): ParsedFile {
  const spec: LanguageSpec = GRAMMARS[grammarKey].spec;
  const tree = parser.parse(content);
  if (!tree) return { ...parseFileRegex(entry, content) };

  // Regex pass supplies imports/exports/comments and the export-name set
  const base = parseFileRegex(entry, content);
  const exportedNames = new Set(base.exports.map((e) => e.name));

  const symbols: ExtractedSymbol[] = [];
  const calls: CallSite[] = [];

  try {
    for (const cap of query.captures(tree.rootNode)) {
      const node = cap.node;
      const defType = DEF_TYPES[cap.name];
      if (defType) {
        symbols.push(toSymbol(node, defType, spec, exportedNames, entry));
        continue;
      }
      switch (cap.name) {
        case 'call':
        case 'call.member':
          calls.push(toCall(node, 'call', spec));
          break;
        case 'new':
          calls.push(toCall(node, 'new', spec));
          break;
        case 'extends':
          calls.push(toCall(node, 'extends', spec));
          break;
        case 'implements':
          calls.push(toCall(node, 'implements', spec));
          break;
      }
    }
    symbols.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
    calls.sort((a, b) => a.line - b.line || a.callee.localeCompare(b.callee));
    return { entry, imports: base.imports, exports: base.exports, comments: base.comments, symbols, calls, parserUsed: 'tree-sitter' };
  } finally {
    tree.delete();
  }
}

/** Build a symbol from its name-node capture */
function toSymbol(nameNode: Node, type: ExtractedSymbol['type'], spec: LanguageSpec, exportedNames: Set<string>, entry: FileEntry): ExtractedSymbol {
  const decl = declarationNode(nameNode);
  const name = nameNode.text;
  // functions nested in a class body are methods (python/go-style grammars
  // have no distinct method node)
  const parent = (type === 'method' || type === 'function') ? enclosingName(nameNode, spec.classNodes) : undefined;
  if (type === 'function' && parent) type = 'method';
  const startLine = decl.startPosition.row + 1;
  const endLine = decl.endPosition.row + 1;
  const sym: ExtractedSymbol = {
    name,
    type,
    exported: isExported(name, decl, exportedNames, entry),
    line: startLine,
    endLine,
  };
  if (parent) sym.parentSymbol = parent;
  if (type === 'function' || type === 'method') {
    sym.bodySize = endLine - startLine + 1;
    sym.complexityHint = countBranches(decl, spec.branchNodes);
  }
  return sym;
}

/** The declaration node owning a captured name node */
function declarationNode(nameNode: Node): Node {
  return nameNode.parent ?? nameNode;
}

/** Name of the nearest enclosing node of one of the given types */
function enclosingName(node: Node, containerTypes: string[]): string | undefined {
  for (let n = node.parent; n; n = n.parent) {
    if (containerTypes.includes(n.type)) {
      return n.childForFieldName('name')?.text ?? undefined;
    }
  }
  return undefined;
}

/** Count branch nodes inside a declaration (1 = straight-line code) */
function countBranches(decl: Node, branchTypes: string[]): number {
  let count = 1;
  const stack: Node[] = [decl];
  while (stack.length) {
    const n = stack.pop()!;
    for (let i = 0; i < n.namedChildCount; i++) {
      const child = n.namedChild(i);
      if (!child) continue;
      if (branchTypes.includes(child.type)) {
        // binary_expression only counts for short-circuit operators
        if (child.type !== 'binary_expression' || /&&|\|\|/.test(child.text.slice(0, 200))) count++;
      }
      stack.push(child);
    }
  }
  return count;
}

function isExported(name: string, decl: Node, exportedNames: Set<string>, entry: FileEntry): boolean {
  if (exportedNames.has(name)) return true;
  if (entry.language === 'go') return name[0] === name[0].toUpperCase();
  if (entry.language === 'python') return !name.startsWith('_');
  // export_statement ancestor (TS/JS), pub modifier (rust) via declaration text prefix
  for (let n = decl.parent; n; n = n.parent) {
    if (n.type === 'export_statement') return true;
    if (n.type === 'program' || n.type === 'module') break;
  }
  if (entry.language === 'rust') return decl.parent?.type === 'visibility_modifier' || decl.text.startsWith('pub ');
  if (entry.language === 'java') return decl.text.startsWith('public');
  return false;
}

/** Build a call site, attributing it to its enclosing function/method */
function toCall(node: Node, kind: CallSite['kind'], spec: LanguageSpec): CallSite {
  const callee = node.text.length > 120 ? node.text.slice(0, 120) : node.text;
  const dot = callee.indexOf('.');
  const call: CallSite = {
    caller: enclosingCaller(node, spec),
    callee,
    line: node.startPosition.row + 1,
    kind,
  };
  if (dot > 0) call.calleeRoot = callee.slice(0, dot);
  return call;
}

/** Enclosing symbol name for a call: "Class.method", "fn", or '' (module level) */
function enclosingCaller(node: Node, spec: LanguageSpec): string {
  for (let n = node.parent; n; n = n.parent) {
    if (spec.functionNodes.includes(n.type)) {
      let name = n.childForFieldName('name')?.text;
      // anonymous fn assigned to a variable: const foo = () => ...
      if (!name && n.parent?.type === 'variable_declarator') {
        name = n.parent.childForFieldName('name')?.text ?? undefined;
      }
      if (!name) continue; // anonymous: attribute to outer scope
      const cls = enclosingName(n, spec.classNodes);
      return cls ? `${cls}.${name}` : name;
    }
  }
  return '';
}
