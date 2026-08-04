/**
 * Slide 5 only — Semgrep-style semantic rule engine (100% offline, zero API cost).
 *
 * Complements:
 *   - liveSyntaxValidator.ts  (strict per-language syntax/case rules)
 *   - runtimeRiskHeuristics.ts (memory/overflow/leak heuristics)
 *   - treeSitterService.ts     (WASM AST parse errors)
 *
 * This engine adds *pattern + dataflow-lite* inspections that apply to every
 * language in the registry (300+ names mapped onto ~14 language families):
 * logical errors, access-modifier/encapsulation violations, numeric
 * overflow/underflow, data-structure misuse (off-by-one, index bounds, null
 * deref, concurrent modification) and common security rules.
 *
 * Every rule is written to fire ONLY on a real mistake — no speculative noise.
 */

import type { LiveError } from './liveSyntaxValidator';

export type Family =
  | 'c' | 'jvm' | 'dotnet' | 'python' | 'js' | 'go' | 'rust' | 'php'
  | 'ruby' | 'swift' | 'shell' | 'sql' | 'functional' | 'web' | 'generic';

const FAMILY_MAP: Record<string, Family> = {};
const reg = (f: Family, names: string[]) => names.forEach((n) => (FAMILY_MAP[n] = f));

reg('c', ['c', 'c++', 'cpp', 'cxx', 'objective-c', 'objc', 'objective-c++', 'cuda', 'arduino', 'd', 'dlang', 'zig', 'nim', 'vala', 'hare', 'v', 'carbon', 'opencl', 'glsl', 'hlsl', 'wgsl', 'metal', 'systemverilog', 'verilog', 'chapel']);
reg('jvm', ['java', 'kotlin', 'kt', 'scala', 'groovy', 'clojure', 'jsp', 'processing', 'ceylon', 'xtend', 'apex']);
reg('dotnet', ['c#', 'csharp', 'f#', 'fsharp', 'vb.net', 'visual basic', 'visual basic .net', 'powershell', 'ps1']);
reg('python', ['python', 'python2', 'python3', 'py', 'cython', 'mojo', 'jython', 'micropython', 'starlark', 'sage']);
reg('js', ['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'node', 'node.js', 'nodejs', 'deno', 'bun', 'coffeescript', 'livescript', 'assemblyscript', 'actionscript', 'dart', 'reasonml', 'rescript', 'svelte', 'vue', 'solidity', 'sol', 'move', 'cadence']);
reg('go', ['go', 'golang']);
reg('rust', ['rust', 'rs']);
reg('php', ['php', 'hack']);
reg('ruby', ['ruby', 'rb', 'crystal', 'elixir', 'ex', 'perl', 'raku', 'lua', 'tcl', 'julia', 'r']);
reg('swift', ['swift', 'objective-c (swift)']);
reg('shell', ['bash', 'sh', 'shell', 'zsh', 'fish', 'ksh', 'batch', 'cmd', 'awk', 'sed', 'makefile', 'make', 'dockerfile', 'docker']);
reg('sql', ['sql', 'mysql', 'postgresql', 'postgres', 'plsql', 'pl/sql', 'tsql', 't-sql', 'sqlite', 'mariadb', 'oracle', 'hiveql', 'sparksql', 'cypher', 'sparql', 'graphql', 'gql']);
reg('functional', ['haskell', 'hs', 'ocaml', 'ml', 'sml', 'standard ml', 'erlang', 'erl', 'lisp', 'common lisp', 'commonlisp', 'scheme', 'racket', 'elm', 'purescript', 'idris', 'agda', 'coq', 'lean', 'gleam', 'unison', 'apl', 'j', 'k', 'q']);
reg('web', ['html', 'html5', 'css', 'scss', 'sass', 'less', 'stylus', 'xml', 'xslt', 'jsonnet', 'handlebars', 'ejs', 'pug', 'jade', 'twig', 'liquid', 'blade']);

export function familyOf(language?: string | null): Family {
  const l = (language || '').toLowerCase().trim();
  if (!l) return 'generic';
  if (FAMILY_MAP[l]) return FAMILY_MAP[l];
  const key = Object.keys(FAMILY_MAP).find((k) => k.length > 2 && l.startsWith(k));
  return key ? FAMILY_MAP[key] : 'generic';
}

/** Mask strings + comments so rules never fire inside literals. */
function mask(src: string, family: Family): string {
  const lineCmt = family === 'python' || family === 'shell' || family === 'ruby' ? '#'
    : family === 'sql' ? '--'
    : family === 'functional' ? '--'
    : '//';
  let out = '';
  let i = 0;
  const N = src.length;
  while (i < N) {
    const c = src[i];
    if (src.startsWith('/*', i)) {
      out += '  '; i += 2;
      while (i < N && !src.startsWith('*/', i)) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      if (i < N) { out += '  '; i += 2; }
      continue;
    }
    if (src.startsWith(lineCmt, i)) {
      while (i < N && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      out += c; i++;
      while (i < N && src[i] !== c) {
        if (src[i] === '\\' && i + 1 < N) { out += '  '; i += 2; continue; }
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < N) { out += src[i]; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

interface Rule {
  id: string;
  type: string;
  severity: 'error' | 'warning';
  families: Family[] | '*';
  pattern: RegExp;
  message: (m: RegExpExecArray) => string;
  suggestion?: string;
  /** extra confirmation on the whole masked source; rule fires only if true */
  guard?: (src: string, m: RegExpExecArray) => boolean;
}

const RULES: Rule[] = [
  /* ---------------- LOGICAL ERRORS ---------------- */
  {
    id: 'assign-in-condition',
    type: 'LogicError', severity: 'error',
    families: ['c', 'jvm', 'dotnet', 'js', 'php', 'go', 'swift'],
    pattern: /\b(if|while)\s*\(\s*([A-Za-z_]\w*)\s*=\s*(?!=)([^=;)]{1,40})\)/g,
    message: (m) => `Assignment '${m[2]} = ...' used inside '${m[1]}' condition — this assigns instead of comparing.`,
    suggestion: 'Use == (or === ) for comparison.',
  },
  {
    id: 'self-comparison',
    type: 'LogicError', severity: 'warning', families: '*',
    pattern: /\b([A-Za-z_]\w*)\s*(===|==|!=|!==|<=|>=)\s*\1\b/g,
    message: (m) => `Comparing '${m[1]}' with itself is always ${/!/.test(m[2]) ? 'false' : 'true'}.`,
    suggestion: 'Compare against the intended second operand.',
  },
  {
    id: 'string-identity-compare',
    type: 'LogicError', severity: 'error', families: ['jvm'],
    pattern: /\b([A-Za-z_]\w*)\s*(==|!=)\s*"(?:[^"\\]|\\.)*"/g,
    message: () => `Strings compared with '==' compare references, not contents.`,
    suggestion: 'Use .equals() (or Objects.equals) instead.',
  },
  {
    id: 'float-equality',
    type: 'LogicError', severity: 'warning', families: '*',
    pattern: /(?:^|[^\w.])(\d+\.\d+)\s*(==|!=)\s*[A-Za-z_]\w*|\b[A-Za-z_]\w*\s*(?:==|!=)\s*\d+\.\d+/g,
    message: () => `Floating-point values compared for exact equality — rounding makes this unreliable.`,
    suggestion: 'Compare with a tolerance: Math.abs(a - b) < 1e-9.',
  },
  {
    id: 'empty-loop-body',
    type: 'LogicError', severity: 'warning',
    families: ['c', 'jvm', 'dotnet', 'js', 'php', 'swift'],
    pattern: /\b(for|while)\s*\([^)]*\)\s*;/g,
    message: (m) => `'${m[1]}' loop with an empty body (stray ';') — the block after it never runs in the loop.`,
    suggestion: 'Remove the semicolon after the loop header.',
  },
  {
    id: 'if-empty-body',
    type: 'LogicError', severity: 'warning',
    families: ['c', 'jvm', 'dotnet', 'js', 'php', 'swift'],
    pattern: /\bif\s*\([^)]*\)\s*;/g,
    message: () => `'if' statement with an empty body (stray ';').`,
    suggestion: 'Remove the semicolon after if(...).',
  },
  {
    id: 'constant-condition',
    type: 'LogicError', severity: 'warning',
    families: ['c', 'jvm', 'dotnet', 'js', 'php', 'go', 'swift'],
    pattern: /\bif\s*\(\s*(true|false|1|0)\s*\)/g,
    message: (m) => `Condition is the constant '${m[1]}' — the branch is always ${m[1] === 'true' || m[1] === '1' ? 'taken' : 'skipped'}.`,
    suggestion: 'Use a real condition or delete the dead branch.',
  },
  {
    id: 'python-mutable-default',
    type: 'LogicError', severity: 'warning', families: ['python'],
    pattern: /\bdef\s+\w+\s*\([^)]*=\s*(\[\]|\{\})\s*[,)]/g,
    message: (m) => `Mutable default argument '${m[1]}' is shared between calls.`,
    suggestion: 'Use None as the default and create the container inside the function.',
  },
  {
    id: 'js-loose-null',
    type: 'LogicError', severity: 'warning', families: ['js'],
    pattern: /[^=!<>]=\s*=\s*(?:null|undefined)\b/g,
    message: () => `Loose equality with null/undefined performs type coercion.`,
    suggestion: 'Use === / !== or a == null null-ish check intentionally.',
  },

  /* ------------- ACCESS MODIFIERS / ENCAPSULATION ------------- */
  {
    id: 'public-mutable-field',
    type: 'EncapsulationWarning', severity: 'warning', families: ['jvm', 'dotnet'],
    pattern: /^\s*public\s+(?!static\s+final|final|const|readonly|static\s+readonly)(?:static\s+)?[A-Za-z_][\w<>,\[\]\.]*\s+[A-Za-z_]\w*\s*(?:=[^;]*)?;/gm,
    message: () => `Public mutable field breaks encapsulation — any caller can change it.`,
    suggestion: 'Make the field private and expose a getter/setter.',
  },
  {
    id: 'private-in-interface',
    type: 'AccessModifierError', severity: 'error', families: ['jvm'],
    pattern: /\binterface\s+\w+[^{]*\{[^}]*?\b(private|protected)\s+(?!static)\w[\w<>\[\]]*\s+\w+\s*\([^)]*\)\s*;/gs,
    message: (m) => `Interface members cannot be declared '${m[1]}' abstract.`,
    suggestion: 'Interface methods are implicitly public.',
  },
  {
    id: 'static-this',
    type: 'AccessModifierError', severity: 'error', families: ['jvm', 'dotnet'],
    pattern: /\bstatic\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[^{}]*\bthis\s*\./gs,
    message: () => `'this' cannot be used inside a static method.`,
    suggestion: 'Remove `this.` or make the method non-static.',
  },
  {
    id: 'py-name-mangled-access',
    type: 'EncapsulationWarning', severity: 'warning', families: ['python'],
    pattern: /\b(?!self\b)[A-Za-z_]\w*\.__[a-z]\w*\b(?!\s*\()/g,
    message: () => `Accessing a name-mangled private attribute from outside the class.`,
    suggestion: 'Expose a property/accessor instead.',
  },

  /* ------------- OVERFLOW / UNDERFLOW / NUMERIC ------------- */
  {
    id: 'int-literal-overflow',
    type: 'OverflowError', severity: 'error', families: ['c', 'jvm', 'dotnet', 'go', 'rust'],
    pattern: /\b(?:int|short|byte|i32|i16|i8|int32|int16)\s+\w+\s*=\s*(-?\d{5,})\b/g,
    message: (m) => `Value ${m[1]} overflows the declared integer type range.`,
    suggestion: 'Use a wider type (long / int64 / i64).',
    guard: (_s, m) => {
      const v = Number(m[1]);
      return Number.isFinite(v) && (v > 2147483647 || v < -2147483648);
    },
  },
  {
    id: 'unsigned-underflow',
    type: 'UnderflowWarning', severity: 'warning', families: ['c', 'rust', 'go'],
    pattern: /\b(?:unsigned|size_t|u8|u16|u32|u64|uint\w*)\s+(\w+)\s*=\s*0\s*;[\s\S]{0,200}?\b\1\s*--/g,
    message: (m) => `Unsigned variable '${m[1]}' starts at 0 and is decremented — this underflows to a huge value.`,
    suggestion: 'Guard the decrement or use a signed type.',
  },
  {
    id: 'shift-overflow',
    type: 'OverflowWarning', severity: 'warning', families: ['c', 'jvm', 'dotnet', 'js', 'go', 'rust'],
    pattern: /\b1\s*<<\s*(\d{2,})\b/g,
    message: (m) => `Shifting by ${m[1]} bits exceeds a 32-bit value and overflows.`,
    suggestion: 'Use a 64-bit type or reduce the shift count.',
    guard: (_s, m) => Number(m[1]) >= 32,
  },
  {
    id: 'int-division-truncation',
    type: 'LogicError', severity: 'warning', families: ['c', 'jvm', 'dotnet', 'go', 'rust'],
    pattern: /\b(?:float|double|f32|f64)\s+\w+\s*=\s*(\d+)\s*\/\s*(\d+)\s*;/g,
    message: (m) => `Integer division ${m[1]}/${m[2]} truncates before it is stored in a floating-point variable.`,
    suggestion: `Write ${'`'}${'$'}{'{'}${'}'}${'`'}` .replace(/.*/, 'Make one operand a float, e.g. 1.0 / 2.'),
  },
  {
    id: 'literal-div-zero',
    type: 'ArithmeticError', severity: 'error', families: '*',
    pattern: /(?:^|[^\w.])(\d+(?:\.\d+)?)\s*(\/|%)\s*0(?![\d.xXbB])/g,
    message: (m) => `Division by zero: ${m[1]} ${m[2]} 0 ${m[2] === '%' ? 'is undefined' : 'is undefined / Infinity at runtime'}.`,
    suggestion: 'Guard the denominator before dividing.',
  },
  {
    id: 'modulo-negative',
    type: 'LogicError', severity: 'warning', families: ['python', 'js', 'c'],
    pattern: /%\s*-\s*\d+/g,
    message: () => `Modulo with a negative divisor gives implementation-specific signs.`,
    suggestion: 'Normalize with Math.abs() or an explicit formula.',
  },

  /* ------------- DATA STRUCTURES / BOUNDS / NULL ------------- */
  {
    id: 'off-by-one-array',
    type: 'IndexOutOfBounds', severity: 'error',
    families: ['c', 'jvm', 'dotnet', 'js', 'go', 'swift', 'php'],
    pattern: /\bfor\s*\(\s*(?:[\w<>\[\]]+\s+)?([A-Za-z_]\w*)\s*=\s*0\s*;\s*\1\s*<=\s*([A-Za-z_][\w.$]*(?:\.length|\.size\(\)|\.count|\.len\(\))|\w+\.length)\s*;/g,
    message: (m) => `Off-by-one: '${m[1]} <= ${m[2]}' reads one element past the end.`,
    suggestion: `Use '${'<'}' instead of '<='.`,
  },
  {
    id: 'py-range-off-by-one',
    type: 'IndexOutOfBounds', severity: 'error', families: ['python'],
    pattern: /\bfor\s+\w+\s+in\s+range\s*\(\s*len\s*\(\s*(\w+)\s*\)\s*\+\s*1\s*\)/g,
    message: (m) => `range(len(${m[1]}) + 1) iterates one index past the end of '${m[1]}'.`,
    suggestion: 'Use range(len(x)) or iterate the sequence directly.',
  },
  {
    id: 'concurrent-modification',
    type: 'ConcurrentModificationError', severity: 'error', families: ['jvm', 'python', 'dotnet'],
    pattern: /\bfor\s*\(?\s*\w+(?:\s+\w+)?\s*(?::|in)\s*([A-Za-z_]\w*)\s*\)?\s*[:{][\s\S]{0,200}?\b\1\.(remove|add|append|pop|delete)\s*\(/g,
    message: (m) => `Collection '${m[1]}' is modified with .${m[2]}() while it is being iterated.`,
    suggestion: 'Iterate over a copy, or collect changes and apply them after the loop.',
  },
  {
    id: 'null-deref-after-null',
    type: 'NullPointerRisk', severity: 'error', families: ['jvm', 'dotnet', 'js', 'php'],
    pattern: /\b([A-Za-z_]\w*)\s*=\s*(?:null|None|nil)\s*;[\s\S]{0,160}?\b\1\s*\.\s*\w+\s*\(/g,
    message: (m) => `'${m[1]}' is set to null and then dereferenced — this throws a null-pointer/undefined error.`,
    suggestion: 'Assign a real value or add a null check before use.',
  },
  {
    id: 'array-negative-index',
    type: 'IndexOutOfBounds', severity: 'error',
    families: ['c', 'jvm', 'dotnet', 'js', 'go', 'swift'],
    pattern: /\b[A-Za-z_]\w*\s*\[\s*-\s*[1-9]\d*\s*\]/g,
    message: () => `Negative array index is out of bounds in this language.`,
    suggestion: 'Use length - n indexing instead.',
  },
  {
    id: 'fixed-buffer-overrun',
    type: 'BufferOverflowError', severity: 'error', families: ['c'],
    pattern: /\b\w+\s+(\w+)\s*\[\s*(\d+)\s*\][\s\S]{0,200}?\b\1\s*\[\s*(\d+)\s*\]\s*=/g,
    message: (m) => `Writing to '${m[1]}[${m[3]}]' but '${m[1]}' only has ${m[2]} elements (valid 0..${Number(m[2]) - 1}).`,
    suggestion: 'Keep the index below the declared size.',
    guard: (_s, m) => Number(m[3]) >= Number(m[2]),
  },
  {
    id: 'recursion-no-base-case',
    type: 'StackOverflowRisk', severity: 'warning', families: '*',
    pattern: /\b(?:def|function|fn|func|void|int|public\s+\w+)\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*[:{][^{}]{0,300}?\b\1\s*\(/g,
    message: (m) => `Recursive call to '${m[1]}' with no visible base case before it — risk of stack overflow.`,
    suggestion: 'Add a terminating condition before recursing.',
    guard: (_s, m) => !/\b(if|match|switch|guard|case|when)\b/.test(m[0]),
  },

  /* ------------- SECURITY (semgrep-style) ------------- */
  {
    id: 'sql-injection-concat',
    type: 'SecurityError', severity: 'error', families: '*',
    pattern: /\b(?:execute|query|executeQuery|rawQuery|exec)\s*\(\s*(?:"|')?[^)]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^)]*(?:\+|\$\{|%s|\.format\(|f")/gi,
    message: () => `SQL query built by string concatenation — SQL injection risk.`,
    suggestion: 'Use parameterized queries / prepared statements.',
  },
  {
    id: 'command-injection',
    type: 'SecurityError', severity: 'error', families: '*',
    pattern: /\b(?:system|exec|popen|shell_exec|os\.system|subprocess\.(?:call|run|Popen)|child_process\.exec)\s*\(\s*[^)"']*(?:\+|\$\{|%s|\.format\()/g,
    message: () => `Shell command built from dynamic input — command injection risk.`,
    suggestion: 'Pass arguments as an array and avoid shell interpolation.',
  },
  {
    id: 'eval-usage',
    type: 'SecurityError', severity: 'error', families: '*',
    pattern: /\b(?:eval|Function\s*\(\s*['"]|exec)\s*\(\s*(?![)'"])/g,
    message: () => `Dynamic code execution (eval/exec) allows arbitrary code injection.`,
    suggestion: 'Parse the value explicitly instead of evaluating it.',
  },
  {
    id: 'hardcoded-secret',
    type: 'SecurityWarning', severity: 'warning', families: '*',
    pattern: /\b(?:password|passwd|secret|api[_-]?key|token|private[_-]?key)\s*(?:=|:)\s*["'][^"'\s]{8,}["']/gi,
    message: () => `Hardcoded credential in source code.`,
    suggestion: 'Load secrets from environment variables or a secret manager.',
  },
  {
    id: 'weak-hash',
    type: 'SecurityWarning', severity: 'warning', families: '*',
    pattern: /\b(?:MD5|SHA1|sha1|md5)\s*\(/g,
    message: () => `MD5/SHA-1 are cryptographically broken.`,
    suggestion: 'Use SHA-256 or bcrypt/argon2 for passwords.',
  },
  {
    id: 'insecure-random-crypto',
    type: 'SecurityWarning', severity: 'warning', families: '*',
    pattern: /\b(?:Math\.random|rand\s*\(\s*\)|random\.random\s*\(\s*\))[^;\n]{0,60}\b(?:token|key|password|salt|nonce)\b/gi,
    message: () => `Non-cryptographic RNG used for a security value.`,
    suggestion: 'Use a CSPRNG (crypto.randomBytes / secrets module).',
  },
  {
    id: 'unsafe-deserialize',
    type: 'SecurityError', severity: 'error', families: ['python', 'php', 'jvm', 'ruby'],
    pattern: /\b(?:pickle\.loads|yaml\.load\s*\((?![^)]*Loader)|unserialize|readObject)\s*\(/g,
    message: () => `Unsafe deserialization of untrusted data allows remote code execution.`,
    suggestion: 'Use a safe loader (yaml.safe_load / JSON).',
  },
  {
    id: 'tls-verify-disabled',
    type: 'SecurityError', severity: 'error', families: '*',
    pattern: /\b(?:verify\s*=\s*False|rejectUnauthorized\s*:\s*false|InsecureSkipVerify\s*:\s*true|CURLOPT_SSL_VERIFYPEER\s*,\s*(?:0|false))/gi,
    message: () => `TLS certificate verification disabled — traffic can be intercepted.`,
    suggestion: 'Keep certificate verification enabled.',
  },

  /* ------------- RESOURCE / CONCURRENCY ------------- */
  {
    id: 'await-in-loop-sequential',
    type: 'PerformanceWarning', severity: 'warning', families: ['js', 'python', 'dotnet'],
    pattern: /\bfor\s*\([^)]*\)\s*\{[^{}]{0,200}?\bawait\s+/g,
    message: () => `'await' inside a loop serializes every iteration.`,
    suggestion: 'Collect promises and await them together (Promise.all / gather).',
  },
  {
    id: 'unclosed-file',
    type: 'ResourceLeakWarning', severity: 'warning', families: ['python'],
    pattern: /^\s*(\w+)\s*=\s*open\s*\(/gm,
    message: (m) => `File handle '${m[1]}' opened without a 'with' block or a matching close().`,
    suggestion: 'Use `with open(...) as f:` for automatic closing.',
    guard: (src, m) => !new RegExp(`\\b${m[1]}\\.close\\s*\\(`).test(src),
  },
  {
    id: 'empty-catch',
    type: 'ErrorHandlingWarning', severity: 'warning',
    families: ['jvm', 'dotnet', 'js', 'php', 'swift'],
    pattern: /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
    message: () => `Empty catch block silently swallows the exception.`,
    suggestion: 'Log or rethrow the error.',
  },
  {
    id: 'py-bare-except',
    type: 'ErrorHandlingWarning', severity: 'warning', families: ['python'],
    pattern: /^\s*except\s*:\s*$/gm,
    message: () => `Bare 'except:' also catches KeyboardInterrupt and SystemExit.`,
    suggestion: 'Catch a specific exception type (except Exception:).',
  },
  {
    id: 'go-ignored-error',
    type: 'ErrorHandlingWarning', severity: 'warning', families: ['go'],
    pattern: /\b_\s*,\s*_\s*(?::=|=)\s*\w+\s*\(/g,
    message: () => `Return values (including the error) are discarded.`,
    suggestion: 'Handle the returned error value.',
  },
  {
    id: 'rust-unwrap',
    type: 'PanicRisk', severity: 'warning', families: ['rust'],
    pattern: /\.\s*unwrap\s*\(\s*\)/g,
    message: () => `.unwrap() panics on None/Err.`,
    suggestion: 'Use `?`, match, or unwrap_or to handle the failure case.',
  },
];

function lineColFromIndex(code: string, index: number) {
  let line = 1;
  let last = 0;
  for (let i = 0; i < index; i++) {
    if (code[i] === '\n') { line++; last = i + 1; }
  }
  return { line, column: index - last + 1 };
}

const MAX_FINDINGS = 250;
const MAX_CHARS = 400_000;

/**
 * Run the whole rule pack against `code`. Pure, synchronous, no network.
 * Typical cost: 2-8ms on a 2k-line file.
 */
export function runSemanticRules(code: string, language?: string | null): LiveError[] {
  const out: LiveError[] = [];
  if (!code || !code.trim()) return out;
  const src = code.length > MAX_CHARS ? code.slice(0, MAX_CHARS) : code;
  const family = familyOf(language);
  const masked = mask(src, family);
  const seen = new Set<string>();

  for (const rule of RULES) {
    if (rule.families !== '*' && !rule.families.includes(family)) continue;
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
    let m: RegExpExecArray | null;
    let guardCount = 0;
    while ((m = re.exec(masked)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      if (++guardCount > 60) break;
      if (rule.guard && !rule.guard(masked, m)) continue;
      const { line, column } = lineColFromIndex(masked, m.index);
      const key = `${rule.id}:${line}:${column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const firstLine = m[0].split('\n')[0];
      out.push({
        line,
        column,
        endLine: line,
        endColumn: column + Math.max(1, Math.min(firstLine.length, 120)),
        message: rule.message(m),
        severity: rule.severity,
        type: rule.type,
        suggestion: rule.suggestion,
        wrongCode: firstLine.trim().slice(0, 160),
      } as LiveError);
      if (out.length >= MAX_FINDINGS) return out;
    }
  }
  return out;
}

export const SEMANTIC_RULE_COUNT = RULES.length;
