// ============================================================
// auk — AI Context Engineering Platform
// Regex Parser — zero-dep fallback extraction
// Uses pattern matching to extract imports, exports, functions,
// classes, and types from source code across multiple languages.
// Used when no tree-sitter grammar is available for a language.
// ============================================================

import * as fs from 'fs';
import type { FileEntry, ParsedFile, ImportInfo, ExportInfo, ExtractedSymbol } from '../types/analysis.js';

/** Parse a single file with regex extraction */
export function parseFileRegex(entry: FileEntry, preloaded?: string): ParsedFile {
  let content: string;
  if (preloaded !== undefined) {
    content = preloaded;
  } else {
    try {
      content = fs.readFileSync(entry.absolutePath, 'utf-8');
    } catch {
      return emptyParsedFile(entry);
    }
  }

  const lines = content.split('\n');
  const result = dispatch(entry, content, lines);
  result.parserUsed = 'regex';
  return result;
}

function dispatch(entry: FileEntry, content: string, lines: string[]): ParsedFile {
  switch (entry.language) {
    case 'typescript':
    case 'javascript':
      return parseTypeScriptJavaScript(entry, content, lines);
    case 'python':
      return parsePython(entry, content, lines);
    case 'go':
      return parseGo(entry, content, lines);
    case 'java':
    case 'csharp':
      return parseJavaCSharp(entry, content, lines);
    case 'rust':
      return parseRust(entry, content, lines);
    case 'ruby':
      return parseRuby(entry, content, lines);
    case 'php':
      return parsePHP(entry, content, lines);
    default:
      return emptyParsedFile(entry);
  }
}

/** Parse TypeScript/JavaScript files */
function parseTypeScriptJavaScript(entry: FileEntry, content: string, lines: string[]): ParsedFile {
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const symbols: ExtractedSymbol[] = [];
  const comments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!trimmed) continue;

    // Extract comments that might contain decisions
    if (trimmed.startsWith('// TODO:') || trimmed.startsWith('// FIXME:') ||
        trimmed.startsWith('// NOTE:') || trimmed.startsWith('// Decision:') ||
        trimmed.startsWith('// Why:') || trimmed.startsWith('// HACK:') ||
        trimmed.startsWith('// ADR:')) {
      comments.push(trimmed);
    }

    // Import: import { X, Y } from 'module'
    const importMatch = trimmed.match(/^import\s+(?:type\s+)?(?:\{([^}]*)\}|(\w+)(?:\s*,\s*\{([^}]*)\})?)\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const namedImports = (importMatch[1] || importMatch[3] || '').split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      const defaultImport = importMatch[2];
      imports.push({
        source: importMatch[4],
        symbols: defaultImport ? [defaultImport, ...namedImports] : namedImports,
        isDefault: !!defaultImport && !importMatch[1],
        isNamespace: false,
        line: lineNum,
      });
      continue;
    }

    // Import: import * as X from 'module'
    const nsImportMatch = trimmed.match(/^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
    if (nsImportMatch) {
      imports.push({
        source: nsImportMatch[2],
        symbols: [nsImportMatch[1]],
        isDefault: false,
        isNamespace: true,
        line: lineNum,
      });
      continue;
    }

    // Import: import 'module' (side-effect)
    const sideEffectImport = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
    if (sideEffectImport) {
      imports.push({
        source: sideEffectImport[1],
        symbols: [],
        isDefault: false,
        isNamespace: false,
        line: lineNum,
      });
      continue;
    }

    // Require: const X = require('module')
    const requireMatch = trimmed.match(/(?:const|let|var)\s+(?:\{([^}]*)\}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (requireMatch) {
      const namedImports = (requireMatch[1] || '').split(',').map(s => s.trim()).filter(Boolean);
      const defaultImport = requireMatch[2];
      imports.push({
        source: requireMatch[3],
        symbols: defaultImport ? [defaultImport] : namedImports,
        isDefault: !!defaultImport,
        isNamespace: false,
        line: lineNum,
      });
      continue;
    }

    // Export: export default
    if (trimmed.startsWith('export default')) {
      const nameMatch = trimmed.match(/export\s+default\s+(?:class|function|const|let|var)\s+(\w+)/);
      exports.push({ name: nameMatch?.[1] || 'default', type: 'default', line: lineNum });
    }

    // Export: export { X, Y }
    const namedExportMatch = trimmed.match(/^export\s+\{([^}]*)\}/);
    if (namedExportMatch) {
      const names = namedExportMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      for (const name of names) {
        exports.push({ name, type: 'named', line: lineNum });
      }
    }

    // Export: export const/function/class/interface/type/enum
    const exportDeclMatch = trimmed.match(/^export\s+(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/);
    if (exportDeclMatch) {
      exports.push({ name: exportDeclMatch[1], type: 'named', line: lineNum });
    }

    // Function declarations
    const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        type: 'function',
        exported: trimmed.startsWith('export'),
        line: lineNum,
        parameters: funcMatch[2].split(',').map(p => p.trim()).filter(Boolean),
      });
      continue;
    }

    // Arrow functions: export const X = (...) =>
    const arrowMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|(\w+))\s*(?::\s*[^=]+)?\s*=>/);
    if (arrowMatch) {
      symbols.push({
        name: arrowMatch[1],
        type: 'function',
        exported: trimmed.startsWith('export'),
        line: lineNum,
      });
      continue;
    }

    // Class declarations
    const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        type: 'class',
        exported: trimmed.startsWith('export'),
        line: lineNum,
      });
      continue;
    }

    // Interface declarations
    const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[1],
        type: 'interface',
        exported: trimmed.startsWith('export'),
        line: lineNum,
      });
      continue;
    }

    // Type declarations
    const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)\s*(?:<[^>]*>)?\s*=/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        type: 'type',
        exported: trimmed.startsWith('export'),
        line: lineNum,
      });
      continue;
    }

    // Enum declarations
    const enumMatch = trimmed.match(/^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[1],
        type: 'enum',
        exported: trimmed.startsWith('export'),
        line: lineNum,
      });
    }
  }

  return { entry, imports, exports, symbols, comments };
}

/** Parse Python files */
function parsePython(entry: FileEntry, content: string, lines: string[]): ParsedFile {
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const symbols: ExtractedSymbol[] = [];
  const comments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('# TODO:') || trimmed.startsWith('# NOTE:') ||
          trimmed.startsWith('# FIXME:') || trimmed.startsWith('# Decision:')) {
        comments.push(trimmed);
      }
      continue;
    }

    // import module
    const importMatch = trimmed.match(/^import\s+([\w.]+)(?:\s+as\s+\w+)?/);
    if (importMatch) {
      imports.push({
        source: importMatch[1],
        symbols: [importMatch[1].split('.').pop()!],
        isDefault: true,
        isNamespace: false,
        line: lineNum,
      });
      continue;
    }

    // from module import X, Y
    const fromImportMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
    if (fromImportMatch) {
      const syms = fromImportMatch[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(s => s !== '*');
      imports.push({
        source: fromImportMatch[1],
        symbols: syms,
        isDefault: false,
        isNamespace: fromImportMatch[2].trim() === '*',
        line: lineNum,
      });
      continue;
    }

    // def function_name(...)
    const funcMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        type: 'function',
        exported: !funcMatch[1].startsWith('_'),
        line: lineNum,
        parameters: funcMatch[2].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean),
      });
      continue;
    }

    // class ClassName
    const classMatch = trimmed.match(/^class\s+(\w+)(?:\s*\(([^)]*)\))?/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        type: 'class',
        exported: !classMatch[1].startsWith('_'),
        line: lineNum,
      });
    }
  }

  // Check for __all__ exports
  const allMatch = content.match(/__all__\s*=\s*\[([^\]]*)\]/);
  if (allMatch) {
    const names = allMatch[1].match(/['"](\w+)['"]/g);
    if (names) {
      for (const name of names) {
        exports.push({ name: name.replace(/['"]/g, ''), type: 'named', line: 0 });
      }
    }
  }

  return { entry, imports, exports, symbols, comments };
}

/** Parse Go files */
function parseGo(entry: FileEntry, content: string, lines: string[]): ParsedFile {
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const symbols: ExtractedSymbol[] = [];
  const comments: string[] = [];

  let inImportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed) continue;

    // Comments
    if (trimmed.startsWith('// TODO:') || trimmed.startsWith('// NOTE:') ||
        trimmed.startsWith('// FIXME:')) {
      comments.push(trimmed);
    }

    // Import block
    if (trimmed === 'import (') { inImportBlock = true; continue; }
    if (inImportBlock && trimmed === ')') { inImportBlock = false; continue; }
    if (inImportBlock) {
      const pkgMatch = trimmed.match(/(?:(\w+)\s+)?["']([^"']+)["']/);
      if (pkgMatch) {
        imports.push({
          source: pkgMatch[2],
          symbols: [pkgMatch[1] || pkgMatch[2].split('/').pop()!],
          isDefault: false,
          isNamespace: false,
          line: lineNum,
        });
      }
      continue;
    }

    // Single import
    const singleImport = trimmed.match(/^import\s+(?:(\w+)\s+)?["']([^"']+)["']/);
    if (singleImport) {
      imports.push({
        source: singleImport[2],
        symbols: [singleImport[1] || singleImport[2].split('/').pop()!],
        isDefault: false,
        isNamespace: false,
        line: lineNum,
      });
      continue;
    }

    // Function
    const funcMatch = trimmed.match(/^func\s+(?:\(\w+\s+\*?(\w+)\)\s+)?(\w+)\s*\(/);
    if (funcMatch) {
      const name = funcMatch[2];
      const isExported = name[0] === name[0].toUpperCase();
      symbols.push({
        name,
        type: 'function',
        exported: isExported,
        line: lineNum,
      });
      if (isExported) exports.push({ name, type: 'named', line: lineNum });
      continue;
    }

    // Struct/Interface
    const typeMatch = trimmed.match(/^type\s+(\w+)\s+(struct|interface)/);
    if (typeMatch) {
      const name = typeMatch[1];
      const isExported = name[0] === name[0].toUpperCase();
      symbols.push({
        name,
        type: typeMatch[2] === 'struct' ? 'class' : 'interface',
        exported: isExported,
        line: lineNum,
      });
      if (isExported) exports.push({ name, type: 'named', line: lineNum });
    }
  }

  return { entry, imports, exports, symbols, comments };
}

/** Parse Java/C# files */
function parseJavaCSharp(entry: FileEntry, content: string, lines: string[]): ParsedFile {
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const symbols: ExtractedSymbol[] = [];
  const comments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed) continue;

    // Java import / C# using
    const importMatch = trimmed.match(/^(?:import|using)\s+(?:static\s+)?([\w.]+)\s*;/);
    if (importMatch) {
      imports.push({
        source: importMatch[1],
        symbols: [importMatch[1].split('.').pop()!],
        isDefault: false,
        isNamespace: false,
        line: lineNum,
      });
      continue;
    }

    // Class
    const classMatch = trimmed.match(/(?:public|private|protected|internal)?\s*(?:abstract|sealed|static|partial)?\s*class\s+(\w+)/);
    if (classMatch) {
      symbols.push({ name: classMatch[1], type: 'class', exported: trimmed.includes('public'), line: lineNum });
      exports.push({ name: classMatch[1], type: 'named', line: lineNum });
      continue;
    }

    // Interface
    const ifaceMatch = trimmed.match(/(?:public|private|protected)?\s*interface\s+(\w+)/);
    if (ifaceMatch) {
      symbols.push({ name: ifaceMatch[1], type: 'interface', exported: true, line: lineNum });
      continue;
    }

    // Method
    const methodMatch = trimmed.match(/(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*\(/);
    if (methodMatch && !['if', 'for', 'while', 'switch', 'catch', 'new', 'return', 'class'].includes(methodMatch[1])) {
      symbols.push({ name: methodMatch[1], type: 'function', exported: trimmed.includes('public'), line: lineNum });
    }
  }

  return { entry, imports, exports, symbols, comments };
}

/** Parse Rust files */
function parseRust(entry: FileEntry, content: string, lines: string[]): ParsedFile {
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const symbols: ExtractedSymbol[] = [];
  const comments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;
    if (!trimmed) continue;

    // use statements
    const useMatch = trimmed.match(/^use\s+([\w:]+)(?:::\{([^}]*)\})?/);
    if (useMatch) {
      const source = useMatch[1];
      const syms = useMatch[2] ? useMatch[2].split(',').map(s => s.trim()).filter(Boolean) : [source.split('::').pop()!];
      imports.push({ source, symbols: syms, isDefault: false, isNamespace: false, line: lineNum });
      continue;
    }

    // pub fn / fn
    const fnMatch = trimmed.match(/^(pub\s+)?(?:async\s+)?fn\s+(\w+)/);
    if (fnMatch) {
      symbols.push({ name: fnMatch[2], type: 'function', exported: !!fnMatch[1], line: lineNum });
      if (fnMatch[1]) exports.push({ name: fnMatch[2], type: 'named', line: lineNum });
      continue;
    }

    // struct/enum/trait
    const typeMatch = trimmed.match(/^(pub\s+)?(?:struct|enum|trait)\s+(\w+)/);
    if (typeMatch) {
      symbols.push({ name: typeMatch[2], type: 'class', exported: !!typeMatch[1], line: lineNum });
      if (typeMatch[1]) exports.push({ name: typeMatch[2], type: 'named', line: lineNum });
    }
  }

  return { entry, imports, exports, symbols, comments };
}

/** Parse Ruby files */
function parseRuby(entry: FileEntry, content: string, lines: string[]): ParsedFile {
  const imports: ImportInfo[] = [];
  const symbols: ExtractedSymbol[] = [];
  const comments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;
    if (!trimmed) continue;

    const reqMatch = trimmed.match(/^require(?:_relative)?\s+['"]([^'"]+)['"]/);
    if (reqMatch) {
      imports.push({ source: reqMatch[1], symbols: [], isDefault: true, isNamespace: false, line: lineNum });
      continue;
    }

    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (classMatch) { symbols.push({ name: classMatch[1], type: 'class', exported: true, line: lineNum }); continue; }

    const defMatch = trimmed.match(/^def\s+(\w+)/);
    if (defMatch) { symbols.push({ name: defMatch[1], type: 'function', exported: true, line: lineNum }); }
  }

  return { entry, imports, exports: [], symbols, comments };
}

/** Parse PHP files */
function parsePHP(entry: FileEntry, content: string, lines: string[]): ParsedFile {
  const imports: ImportInfo[] = [];
  const symbols: ExtractedSymbol[] = [];
  const comments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;
    if (!trimmed) continue;

    const useMatch = trimmed.match(/^use\s+([\w\\]+)(?:\s+as\s+\w+)?;/);
    if (useMatch) {
      imports.push({ source: useMatch[1], symbols: [useMatch[1].split('\\').pop()!], isDefault: false, isNamespace: false, line: lineNum });
      continue;
    }

    const classMatch = trimmed.match(/^(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) { symbols.push({ name: classMatch[1], type: 'class', exported: true, line: lineNum }); continue; }

    const funcMatch = trimmed.match(/^(?:public|private|protected|static|\s)*function\s+(\w+)/);
    if (funcMatch) { symbols.push({ name: funcMatch[1], type: 'function', exported: true, line: lineNum }); }
  }

  return { entry, imports, exports: [], symbols, comments };
}

/** Create an empty parsed file */
export function emptyParsedFile(entry: FileEntry): ParsedFile {
  return { entry, imports: [], exports: [], symbols: [], comments: [] };
}

