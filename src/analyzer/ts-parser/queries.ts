// ============================================================
// auk — AI Context Engineering Platform
// Tree-sitter queries + node-type tables per language.
// Capture naming convention:
//   def.function / def.class / def.interface / def.type /
//   def.enum / def.method / def.var.fn   → name node of a definition
//   call / call.member / new / extends / implements → call sites
// ============================================================

/** Per-language query source + structural node-type sets */
export interface LanguageSpec {
  query: string;
  /** node types that define a callable scope (for caller attribution) */
  functionNodes: string[];
  /** node types that define a class-like container (for method parents) */
  classNodes: string[];
  /** node types counted as branches for complexity hints */
  branchNodes: string[];
}

const TS_BRANCHES = ['if_statement', 'for_statement', 'for_in_statement', 'while_statement', 'switch_case', 'catch_clause', 'ternary_expression', 'binary_expression'];

const typescriptSpec: LanguageSpec = {
  query: `
    (function_declaration name: (_) @def.function)
    (generator_function_declaration name: (_) @def.function)
    (class_declaration name: (_) @def.class)
    (abstract_class_declaration name: (_) @def.class)
    (interface_declaration name: (_) @def.interface)
    (type_alias_declaration name: (_) @def.type)
    (enum_declaration name: (_) @def.enum)
    (method_definition name: (_) @def.method)
    (variable_declarator name: (identifier) @def.var.fn value: [(arrow_function) (function_expression)])
    (call_expression function: (identifier) @call)
    (call_expression function: (member_expression) @call.member)
    (new_expression constructor: (_) @new)
    (extends_clause value: (_) @extends)
    (implements_clause (_) @implements)
  `,
  functionNodes: ['function_declaration', 'generator_function_declaration', 'method_definition', 'arrow_function', 'function_expression'],
  classNodes: ['class_declaration', 'abstract_class_declaration'],
  branchNodes: TS_BRANCHES,
};

const javascriptSpec: LanguageSpec = {
  query: `
    (function_declaration name: (_) @def.function)
    (generator_function_declaration name: (_) @def.function)
    (class_declaration name: (_) @def.class)
    (method_definition name: (_) @def.method)
    (variable_declarator name: (identifier) @def.var.fn value: [(arrow_function) (function_expression)])
    (call_expression function: (identifier) @call)
    (call_expression function: (member_expression) @call.member)
    (new_expression constructor: (_) @new)
    (class_heritage (_) @extends)
  `,
  functionNodes: ['function_declaration', 'generator_function_declaration', 'method_definition', 'arrow_function', 'function_expression'],
  classNodes: ['class_declaration'],
  branchNodes: TS_BRANCHES,
};

const pythonSpec: LanguageSpec = {
  query: `
    (function_definition name: (identifier) @def.function)
    (class_definition name: (identifier) @def.class)
    (class_definition superclasses: (argument_list (identifier) @extends))
    (call function: (identifier) @call)
    (call function: (attribute) @call.member)
  `,
  functionNodes: ['function_definition'],
  classNodes: ['class_definition'],
  branchNodes: ['if_statement', 'for_statement', 'while_statement', 'except_clause', 'conditional_expression', 'boolean_operator', 'case_clause'],
};

const goSpec: LanguageSpec = {
  query: `
    (function_declaration name: (identifier) @def.function)
    (method_declaration name: (field_identifier) @def.method)
    (type_declaration (type_spec name: (type_identifier) @def.class))
    (call_expression function: (identifier) @call)
    (call_expression function: (selector_expression) @call.member)
  `,
  functionNodes: ['function_declaration', 'method_declaration', 'func_literal'],
  classNodes: [],
  branchNodes: ['if_statement', 'for_statement', 'expression_case', 'type_case', 'binary_expression'],
};

const javaSpec: LanguageSpec = {
  query: `
    (method_declaration name: (identifier) @def.method)
    (constructor_declaration name: (identifier) @def.method)
    (class_declaration name: (identifier) @def.class)
    (interface_declaration name: (identifier) @def.interface)
    (enum_declaration name: (identifier) @def.enum)
    (superclass (type_identifier) @extends)
    (super_interfaces (type_list (type_identifier) @implements))
    (method_invocation name: (identifier) @call)
    (object_creation_expression type: (type_identifier) @new)
  `,
  functionNodes: ['method_declaration', 'constructor_declaration', 'lambda_expression'],
  classNodes: ['class_declaration', 'interface_declaration', 'enum_declaration'],
  branchNodes: ['if_statement', 'for_statement', 'enhanced_for_statement', 'while_statement', 'switch_block_statement_group', 'catch_clause', 'ternary_expression', 'binary_expression'],
};

const rustSpec: LanguageSpec = {
  query: `
    (function_item name: (identifier) @def.function)
    (struct_item name: (type_identifier) @def.class)
    (enum_item name: (type_identifier) @def.enum)
    (trait_item name: (type_identifier) @def.interface)
    (type_item name: (type_identifier) @def.type)
    (call_expression function: (identifier) @call)
    (call_expression function: (field_expression) @call.member)
    (call_expression function: (scoped_identifier) @call.member)
    (impl_item trait: (type_identifier) @implements)
  `,
  functionNodes: ['function_item', 'closure_expression'],
  classNodes: ['impl_item', 'struct_item', 'trait_item'],
  branchNodes: ['if_expression', 'match_arm', 'while_expression', 'for_expression', 'binary_expression'],
};

/** Grammar wasm filename + spec per grammar key */
export const GRAMMARS: Record<string, { wasm: string; spec: LanguageSpec }> = {
  typescript: { wasm: 'tree-sitter-typescript.wasm', spec: typescriptSpec },
  tsx: { wasm: 'tree-sitter-tsx.wasm', spec: typescriptSpec },
  javascript: { wasm: 'tree-sitter-javascript.wasm', spec: javascriptSpec },
  python: { wasm: 'tree-sitter-python.wasm', spec: pythonSpec },
  go: { wasm: 'tree-sitter-go.wasm', spec: goSpec },
  java: { wasm: 'tree-sitter-java.wasm', spec: javaSpec },
  rust: { wasm: 'tree-sitter-rust.wasm', spec: rustSpec },
};

/** Map a file (language + extension) to a grammar key, or null if unsupported */
export function grammarKeyFor(language: string, filePath: string): string | null {
  switch (language) {
    case 'typescript':
      return filePath.endsWith('.tsx') ? 'tsx' : 'typescript';
    case 'javascript':
      return 'javascript';
    case 'python':
    case 'go':
    case 'java':
    case 'rust':
      return language;
    default:
      return null;
  }
}
