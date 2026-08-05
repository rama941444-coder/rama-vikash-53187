/**
 * Slide 5 only — automated tree-sitter grammar onboarding + verification.
 *
 * Maps 300+ language names (from the global registry) onto the closest
 * available tree-sitter WASM grammar, registers them with the parser service,
 * and verifies that every language resolves to a diagnostics path
 * (LSP -> AST -> semantic rules -> local validator).
 */
import { treeSitterService } from './treeSitterService';
import { familyOf, type Family } from './semanticRuleEngine';
import { PROGRAMMING_LANGUAGES } from './programmingLanguages';
import { isRegisteredLanguage } from './liveSyntaxValidator';

/** Extra names/aliases → existing grammars (superset-compatible parses). */
export const GRAMMAR_ALIASES: Record<string, string> = {
  // C family supersets
  'cxx': 'tree-sitter-cpp', 'cc': 'tree-sitter-cpp', 'c99': 'tree-sitter-c', 'c11': 'tree-sitter-c',
  'c17': 'tree-sitter-c', 'ansi c': 'tree-sitter-c', 'embedded c': 'tree-sitter-c',
  'arduino': 'tree-sitter-cpp', 'opencl': 'tree-sitter-c', 'metal': 'tree-sitter-cpp',
  'hlsl': 'tree-sitter-glsl', 'objective-c++': 'tree-sitter-objc', 'vala': 'tree-sitter-c',
  'systemverilog': 'tree-sitter-verilog',
  // JVM
  'jsp': 'tree-sitter-java', 'apex': 'tree-sitter-java', 'xtend': 'tree-sitter-java',
  'processing': 'tree-sitter-java', 'ceylon': 'tree-sitter-java',
  // .NET
  'c sharp': 'tree-sitter-c_sharp', 'dotnet': 'tree-sitter-c_sharp',
  // Python family
  'python2': 'tree-sitter-python', 'python3': 'tree-sitter-python', 'cython': 'tree-sitter-python',
  'mojo': 'tree-sitter-python', 'jython': 'tree-sitter-python', 'micropython': 'tree-sitter-python',
  'starlark': 'tree-sitter-python', 'sage': 'tree-sitter-python', 'bazel': 'tree-sitter-python',
  // JS family
  'jsx': 'tree-sitter-javascript', 'tsx': 'tree-sitter-typescript',
  'node': 'tree-sitter-javascript', 'node.js': 'tree-sitter-javascript', 'nodejs': 'tree-sitter-javascript',
  'deno': 'tree-sitter-typescript', 'bun': 'tree-sitter-typescript',
  'assemblyscript': 'tree-sitter-typescript', 'javascript (es6)': 'tree-sitter-javascript',
  'ecmascript': 'tree-sitter-javascript', 'move': 'tree-sitter-rust', 'cadence': 'tree-sitter-swift',
  // Shell
  'zsh': 'tree-sitter-bash', 'ksh': 'tree-sitter-bash', 'shell script': 'tree-sitter-bash',
  'gnu make': 'tree-sitter-make',
  // SQL dialects
  'mysql': 'tree-sitter-sql', 'postgresql': 'tree-sitter-sql', 'postgres': 'tree-sitter-sql',
  'plsql': 'tree-sitter-sql', 'pl/sql': 'tree-sitter-sql', 'tsql': 'tree-sitter-sql',
  't-sql': 'tree-sitter-sql', 'sqlite': 'tree-sitter-sql', 'mariadb': 'tree-sitter-sql',
  'oracle': 'tree-sitter-sql', 'hiveql': 'tree-sitter-sql', 'sparksql': 'tree-sitter-sql',
  // Functional
  'sml': 'tree-sitter-ocaml', 'standard ml': 'tree-sitter-ocaml', 'reasonml': 'tree-sitter-ocaml',
  'rescript': 'tree-sitter-ocaml', 'purescript': 'tree-sitter-haskell', 'idris': 'tree-sitter-haskell',
  'gleam': 'tree-sitter-elixir', 'common lisp': 'tree-sitter-commonlisp', 'emacs lisp': 'tree-sitter-commonlisp',
  'elisp': 'tree-sitter-commonlisp',
  // Web / templating
  'html5': 'tree-sitter-html', 'xhtml': 'tree-sitter-html', 'handlebars': 'tree-sitter-html',
  'ejs': 'tree-sitter-html', 'twig': 'tree-sitter-html', 'liquid': 'tree-sitter-html',
  'blade': 'tree-sitter-php', 'sass': 'tree-sitter-scss', 'less': 'tree-sitter-css',
  'stylus': 'tree-sitter-css', 'xslt': 'tree-sitter-xml', 'svg': 'tree-sitter-xml',
  'jsonc': 'tree-sitter-json', 'json5': 'tree-sitter-json', 'jsonnet': 'tree-sitter-json',
  // Misc
  'crystal': 'tree-sitter-ruby', 'raku': 'tree-sitter-perl', 'octave': 'tree-sitter-julia',
  'matlab': 'tree-sitter-julia', 'gdscript': 'tree-sitter-python', 'hcl2': 'tree-sitter-hcl',
};

let onboarded = false;

/** Runs once: pushes every alias into the parser service. */
export function onboardGrammars(): number {
  if (onboarded) return 0;
  onboarded = true;
  return treeSitterService.registerAliases(GRAMMAR_ALIASES);
}

export interface LanguageCoverage {
  language: string;
  grammar: string | null;
  family: Family;
  hasStrictValidator: boolean;
  /** Highest-precision engine that can produce diagnostics for this language. */
  tier: 'AST' | 'Rules+Validator' | 'Rules';
}

const SKIP_CATEGORIES = new Set(['Auto', 'Analysis']);

/** Verifies diagnostics routing for every language in the global registry. */
export function verifyGrammarOnboarding(): {
  total: number;
  withGrammar: number;
  withValidator: number;
  rulesOnly: number;
  grammars: number;
  rows: LanguageCoverage[];
} {
  onboardGrammars();
  const rows: LanguageCoverage[] = [];
  const seen = new Set<string>();

  for (const entry of PROGRAMMING_LANGUAGES) {
    const name = entry.value;
    if (SKIP_CATEGORIES.has(entry.category)) continue;
    const key = name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    const grammar = treeSitterService.grammarFor(key);
    const hasStrictValidator = isRegisteredLanguage(name);
    rows.push({
      language: name,
      grammar,
      family: familyOf(name),
      hasStrictValidator,
      tier: grammar ? 'AST' : hasStrictValidator ? 'Rules+Validator' : 'Rules',
    });
  }

  return {
    total: rows.length,
    withGrammar: rows.filter((r) => r.grammar).length,
    withValidator: rows.filter((r) => r.hasStrictValidator).length,
    rulesOnly: rows.filter((r) => !r.grammar && !r.hasStrictValidator).length,
    grammars: new Set(rows.map((r) => r.grammar).filter(Boolean)).size,
    rows,
  };
}
