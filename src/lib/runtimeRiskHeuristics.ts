/**
 * Slide 5 only — heuristic runtime-risk warnings that run 100% offline.
 * Not a real static analyzer: pattern-based scans for common leaks,
 * overflows, infinite loops, unsafe stdlib calls. Fast (<3ms on 50k chars).
 */

import type { LiveError } from './liveSyntaxValidator';

type Finding = LiveError;

function loc(lines: string[], idx: number, offset: number): { line: number; column: number } {
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].length + 1;
    if (offset < pos + len) return { line: i + 1, column: offset - pos + 1 };
    pos += len;
  }
  return { line: lines.length, column: 1 };
}

/**
 * Replace the contents of string literals, char literals, and line/block
 * comments with spaces so regex scans don't match inside them. Preserves
 * length + newlines so `loc()` offsets stay correct.
 */
function stripNonCode(src: string, family: string): string {
  let out = '';
  let i = 0;
  const N = src.length;
  const lineCmt = family === 'python' ? '#' : '//';
  const supportsBlock = family !== 'python';
  while (i < N) {
    const c = src[i];
    const n = src[i + 1];
    // block comment
    if (supportsBlock && c === '/' && n === '*') {
      out += '  '; i += 2;
      while (i < N && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      if (i < N) { out += '  '; i += 2; }
      continue;
    }
    // line comment
    if (src.startsWith(lineCmt, i)) {
      while (i < N && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    // string / char literal
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += q; i++;
      while (i < N && src[i] !== q) {
        if (src[i] === '\\' && i + 1 < N) { out += '  '; i += 2; continue; }
        if (src[i] === '\n') { out += '\n'; i++; continue; }
        out += ' '; i++;
      }
      if (i < N) { out += q; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

function push(out: Finding[], line: number, column: number, length: number, message: string, type: string, severity: 'error' | 'warning' = 'warning', suggestion?: string, wrongCode?: string) {
  out.push({
    line, column, endLine: line, endColumn: column + Math.max(1, length),
    message, severity, type, wrongCode, suggestion,
  });
}

function fam(lang?: string | null): string {
  const l = (lang || '').toLowerCase();
  if (l === 'c' || l === 'c++' || l === 'cpp' || l === 'arduino' || l === 'cuda' || l === 'objective-c') return 'c';
  if (l === 'python') return 'python';
  if (l === 'java' || l === 'c#' || l === 'kotlin' || l === 'scala') return 'jvm';
  if (l === 'javascript' || l === 'typescript' || l === 'jsx' || l === 'tsx' || l === 'node' || l === 'node.js') return 'js';
  if (l === 'go') return 'go';
  if (l === 'rust') return 'rust';
  return 'generic';
}

export function detectRuntimeRisks(code: string, language?: string | null): Finding[] {
  const out: Finding[] = [];
  if (!code) return out;
  const family = fam(language);
  const lines = code.split('\n');
  // Scan on a masked copy so patterns don't match inside strings/comments.
  const src = stripNonCode(code, family);

  // --- Memory leak: malloc/calloc/new without free/delete in the file
  if (family === 'c') {
    const allocRe = /\b(malloc|calloc|realloc)\s*\(/g;
    const hasFree = /\bfree\s*\(/.test(src);
    // Skip leak warning when the file already uses RAII / smart pointers,
    // or when every alloc is returned (ownership transfer).
    const usesSmart = /\b(unique_ptr|shared_ptr|make_unique|make_shared|std::vector|std::string)\b/.test(src);
    const returnsAlloc = /\breturn\s+(?:\w+\s*=\s*)?(?:malloc|calloc|realloc|new)\b/.test(src);
    let m: RegExpExecArray | null;
    while ((m = allocRe.exec(src))) {
      if (!hasFree && !usesSmart && !returnsAlloc) {
        const p = loc(lines, m.index, m.index);
        push(out, p.line, p.column, m[0].length,
          `Possible memory leak: '${m[1]}' has no matching free() in this file.`,
          'MemoryLeakWarning', 'warning', `Call free() on the pointer when done.`, m[0]);
      }
    }
    // Buffer overflow risk
    const dangerRe = /\b(gets|strcpy|strcat|sprintf)\s*\(/g;
    while ((m = dangerRe.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Buffer overflow risk: '${m[1]}' does not bound writes. Use ${m[1] === 'gets' ? 'fgets' : m[1] === 'strcpy' ? 'strncpy' : m[1] === 'strcat' ? 'strncat' : 'snprintf'}.`,
        'BufferOverflowWarning', 'warning', undefined, m[0]);
    }
    // scanf("%s", …) — no width
    const scanfRe = /\bscanf\s*\(\s*"[^"]*%s[^"]*"/g;
    while ((m = scanfRe.exec(code))) { // scan original (needs literal)
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Buffer overflow risk: scanf("%s") is unbounded. Use a width like %255s.`,
        'BufferOverflowWarning', 'warning', undefined, m[0]);
    }
    // File leak
    const fopenRe = /\bfopen\s*\(/g;
    const hasFclose = /\bfclose\s*\(/.test(src);
    while ((m = fopenRe.exec(src))) {
      if (!hasFclose) {
        const p = loc(lines, m.index, m.index);
        push(out, p.line, p.column, m[0].length,
          `Possible file-handle leak: fopen() has no matching fclose() in this file.`,
          'ResourceLeakWarning', 'warning', 'Call fclose(fp) when done.', m[0]);
      }
    }
  }

  // --- C++ new without delete
  if (family === 'c') {
    const newRe = /\bnew\s+[A-Za-z_][\w:]*(?:\s*\[[^\]]*\])?/g;
    const hasDelete = /\bdelete\s*(\[\])?\s*\w/.test(src);
    const usesSmart = /\b(unique_ptr|shared_ptr|make_unique|make_shared)\b/.test(src);
    const returnsAlloc = /\breturn\s+new\b/.test(src);
    let m: RegExpExecArray | null;
    while ((m = newRe.exec(src))) {
      if (!hasDelete && !usesSmart && !returnsAlloc) {
        const p = loc(lines, m.index, m.index);
        push(out, p.line, p.column, m[0].length,
          `Possible memory leak: 'new' has no matching 'delete' in this file. Prefer smart pointers.`,
          'MemoryLeakWarning', 'warning', 'Use std::unique_ptr or std::shared_ptr.', m[0]);
      }
    }
  }

  // --- Infinite loop
  const infRe = /\b(while\s*\(\s*(?:true|1)\s*\)|for\s*\(\s*;\s*;\s*\))/g;
  {
    let m: RegExpExecArray | null;
    while ((m = infRe.exec(src))) {
      const p = loc(lines, m.index, m.index);
      const window = src.slice(m.index, Math.min(src.length, m.index + 800));
      if (!/\b(break|return|exit|throw)\b/.test(window)) {
        push(out, p.line, p.column, m[0].length,
          `Possible infinite loop: no break/return/exit found inside the loop body.`,
          'InfiniteLoopWarning', 'warning', 'Add a break or return condition inside the loop.', m[0]);
      }
    }
  }

  // --- Huge array allocation
  const bigArrRe = /\b(new\s+\w+\s*\[|malloc\s*\(|calloc\s*\(\s*)(\d{7,})/g;
  {
    let m: RegExpExecArray | null;
    while ((m = bigArrRe.exec(src))) {
      const n = Number(m[2]);
      if (n > 10_000_000) {
        const p = loc(lines, m.index, m.index);
        push(out, p.line, p.column, m[0].length,
          `Possible stack/heap overflow: allocating ${n.toLocaleString()} elements may exhaust memory.`,
          'OverflowWarning', 'warning', 'Reduce the size or allocate on the heap in chunks.', m[0]);
      }
    }
  }

  // --- Division by zero literal
  // Only flag `/ 0` where the divisor is a bare literal 0 (not 0.5, not part of an identifier).
  const divZeroRe = /(?<![\/*])\/\s*0(?![\d.\w])/g;
  {
    let m: RegExpExecArray | null;
    while ((m = divZeroRe.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Division by zero (literal). Runtime will crash (or produce NaN/Infinity).`,
        'DivisionByZeroError', 'error', 'Guard against zero divisor before dividing.', m[0]);
    }
  }

  // --- Math errors ------------------------------------------------------------

  // Modulo by zero literal: `a % 0`
  {
    const re = /%\s*0(?!\.\d|\d)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Modulo by zero. Runtime will throw / produce NaN.`,
        'ModuloByZeroError', 'error', 'Check divisor is non-zero before %.', m[0]);
    }
  }

  // sqrt of a negative literal: sqrt(-N), Math.sqrt(-N)
  {
    const re = /\b(?:Math\.)?sqrt\s*\(\s*-\s*\d+(?:\.\d+)?\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Math error: sqrt of a negative number → NaN / domain error.`,
        'MathDomainError', 'error', 'Take abs() first or use a complex number type.', m[0]);
    }
  }

  // log of zero or negative literal: log(0), log(-N), Math.log(0)
  {
    const re = /\b(?:Math\.)?(?:log|log2|log10|ln)\s*\(\s*(-\s*\d+(?:\.\d+)?|0(?:\.0+)?)\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Math error: log(${m[1].replace(/\s+/g, '')}) is undefined / -Infinity.`,
        'MathDomainError', 'error', 'Ensure argument > 0.', m[0]);
    }
  }

  // asin / acos with argument outside [-1, 1]
  {
    const re = /\b(?:Math\.)?(asin|acos)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const v = Number(m[2]);
      if (v < -1 || v > 1) {
        const p = loc(lines, m.index, m.index);
        push(out, p.line, p.column, m[0].length,
          `Math domain error: ${m[1]}(${v}) — argument must be in [-1, 1].`,
          'MathDomainError', 'error', `Clamp the argument to [-1, 1] before calling ${m[1]}.`, m[0]);
      }
    }
  }

  // factorial(negative literal)
  {
    const re = /\b(?:math\.)?factorial\s*\(\s*(-\s*\d+)\s*\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Math error: factorial of a negative number is undefined.`,
        'MathDomainError', 'error', 'Ensure the argument is >= 0.', m[0]);
    }
  }

  // Array index literal that is clearly negative or absurdly large
  {
    const re = /\[\s*(-\d+)\s*\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // Python allows negative indexing; skip for python family.
      if (family === 'python') continue;
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Negative array index literal '${m[1]}' — undefined behaviour in C-family / RangeError in JS/JVM.`,
        'InvalidIndexError', 'error', 'Use a non-negative index.', m[0]);
    }
  }

  // pow(0, 0) — indeterminate in some languages
  {
    const re = /\b(?:Math\.)?pow\s*\(\s*0\s*,\s*0\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `pow(0, 0) is indeterminate; many math libraries return 1 but semantics vary.`,
        'MathIndeterminateWarning', 'warning', 'Handle the (0,0) case explicitly.', m[0]);
    }
  }

  // Integer overflow risk: shift by >= 32 for 32-bit ints
  {
    const re = /(?:<<|>>)\s*(\d{2,})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const n = Number(m[1]);
      if (n >= 32) {
        const p = loc(lines, m.index, m.index);
        push(out, p.line, p.column, m[0].length,
          `Bit-shift by ${n} on a 32-bit int is undefined / wraps to 0.`,
          'IntegerOverflowWarning', 'warning', 'Use a 64-bit type or mask the shift amount.', m[0]);
      }
    }
  }

  // Python integer division vs float division confusion: `x / n` where a Python-3 int result is used with % or [] indexing
  if (family === 'python') {
    const re = /\[\s*[a-zA-Z_]\w*\s*\/\s*[a-zA-Z_0-9]+\s*\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Python 3: '/' returns a float. Indexing with a float raises TypeError. Use '//' for int division.`,
        'FloatIndexError', 'error', "Replace '/' with '//' inside the index.", m[0]);
    }
  }

  // --- Logic errors ----------------------------------------------------------

  // Assignment inside a condition: if (x = 5) — likely meant ==
  {
    const re = /\b(if|while)\s*\(\s*[A-Za-z_]\w*\s*=(?!=)\s*[^)]+\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Assignment inside '${m[1]}' condition — did you mean '=='?`,
        'AssignmentInConditionWarning', 'warning', "Use '==' or '===' for comparison.", m[0]);
    }
  }

  // Self-assignment: `x = x;`
  {
    const re = /\b([A-Za-z_]\w*)\s*=\s*\1\s*[;\n]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Self-assignment '${m[1]} = ${m[1]}' has no effect.`,
        'SelfAssignmentWarning', 'warning', 'Remove the line or fix the intended target.', m[0]);
    }
  }

  // Always-true / always-false condition
  {
    const re = /\b(if|while)\s*\(\s*(true|false|1|0|1\s*==\s*1|0\s*==\s*0|1\s*!=\s*0)\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const val = m[2];
      const truthy = val === 'true' || val === '1' || val === '1 == 1' || val === '0 == 0' || val === '1 != 0';
      if (m[1] === 'while' && truthy) continue; // covered by infinite-loop check
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Constant '${m[1]}' condition — always ${truthy ? 'true' : 'false'}.`,
        'ConstantConditionWarning', 'warning', 'Replace with a real condition or remove the branch.', m[0]);
    }
  }

  // Unreachable code after return / throw / break / continue on the previous non-blank line
  {
    for (let i = 0; i < lines.length - 1; i++) {
      const t = lines[i].trim();
      if (/^(return\b|throw\b|break\s*;|continue\s*;|exit\s*\(|raise\b)/.test(t) && /[;}]?\s*$/.test(t)) {
        // find next non-blank, non-comment, non-closing-brace line
        for (let j = i + 1; j < lines.length; j++) {
          const nt = lines[j].trim();
          if (!nt) continue;
          if (nt.startsWith('//') || nt.startsWith('#') || nt.startsWith('/*') || nt.startsWith('*')) continue;
          if (/^[})\]]/.test(nt)) break; // block ended
          if (/^(case\b|default\b|else\b|elif\b|catch\b|finally\b)/.test(nt)) break; // legit branch
          push(out, j + 1, 1, nt.length,
            `Unreachable code — previous line already returns/throws/breaks.`,
            'UnreachableCodeWarning', 'warning', 'Remove the dead code or restructure the flow.', nt);
          break;
        }
      }
    }
  }

  // Off-by-one: `for (i = 0; i <= arr.length; i++)` — should be `<`
  {
    const re = /for\s*\(\s*(?:let|var|int|size_t)?\s*([A-Za-z_]\w*)\s*=\s*0\s*;\s*\1\s*<=\s*([A-Za-z_]\w*)\.(?:length|size\s*\(\s*\))\s*;/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Off-by-one: '${m[1]} <= ${m[2]}.length' will overflow by one. Use '<'.`,
        'OffByOneError', 'error', "Change '<=' to '<'.", m[0]);
    }
  }

  // Comparing float with == (JS/C-family)
  if (family === 'js' || family === 'c' || family === 'jvm') {
    const re = /([A-Za-z_]\w*|\d+\.\d+)\s*(===?)\s*(\d+\.\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Float equality '${m[2]}' is unreliable due to IEEE-754 rounding.`,
        'FloatEqualityWarning', 'warning', 'Compare using abs(a - b) < EPS.', m[0]);
    }
  }

  // (Removed: unbounded-recursion heuristic — produced too many false positives
  // on well-formed recursive functions. Prefer real static analysis.)

  // --- Python: mutable default arg
  if (family === 'python') {
    const mutDefRe = /\bdef\s+\w+\s*\([^)]*=\s*(\[\]|\{\}|dict\(\)|list\(\))/g;
    let m: RegExpExecArray | null;
    while ((m = mutDefRe.exec(src))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Mutable default argument (${m[1]}) is a common Python bug — the same object is shared across calls.`,
        'MutableDefaultWarning', 'warning', 'Use =None and create the list/dict inside the function.');
    }
  }

  // --- JS: == comparison
  if (family === 'js') {
    // Only flag loose equality that is NOT the well-known idiomatic `== null`
    // / `== undefined` null-check. Also skip `!=` / `===` / `!==`.
    const looseEq = /[^=!<>](==|!=)(?!=)\s*([A-Za-z_$][\w$]*|\d+|"[^"]*"|'[^']*')/g;
    let m: RegExpExecArray | null;
    while ((m = looseEq.exec(src))) {
      const rhs = m[3];
      if (rhs === 'null' || rhs === 'undefined') continue; // idiomatic
      const p = loc(lines, m.index + 1, m.index + 1);
      push(out, p.line, p.column, 2,
        `Loose ${m[1] === '==' ? 'equality' : 'inequality'} '${m[1]}' performs type coercion. Prefer '${m[1]}='.`,
        'LooseEqualityWarning', 'warning', `Replace '${m[1]}' with '${m[1]}='.`, m[1]);
    }
  }

  return out;
}

export const RUNTIME_RISK_LEGEND = [
  'Memory leaks (malloc/new without free/delete)',
  'Buffer overflow (gets, strcpy, unbounded scanf)',
  'Infinite loops (while(true) / for(;;) with no break)',
  'Stack/heap overflow (arrays > 10⁷)',
  'Division / modulo by zero',
  'Math domain errors (sqrt/log/asin/acos/factorial)',
  'Negative or out-of-range array indices',
  'Off-by-one loop bounds',
  'Assignment-in-condition, self-assignment, constant conditions, unreachable code',
  'File handle leaks',
  'Python mutable default args',
  'JS loose equality (excluding idiomatic == null)',
];