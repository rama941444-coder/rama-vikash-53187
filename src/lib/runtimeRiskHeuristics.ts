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

  // --- Memory leak: malloc/calloc/new without free/delete in the file
  if (family === 'c') {
    const allocRe = /\b(malloc|calloc|realloc)\s*\(/g;
    const hasFree = /\bfree\s*\(/.test(code);
    let m: RegExpExecArray | null;
    while ((m = allocRe.exec(code))) {
      if (!hasFree) {
        const p = loc(lines, m.index, m.index);
        push(out, p.line, p.column, m[0].length,
          `Possible memory leak: '${m[1]}' has no matching free() in this file.`,
          'MemoryLeakWarning', 'warning', `Call free() on the pointer when done.`, m[0]);
      }
    }
    // Buffer overflow risk
    const dangerRe = /\b(gets|strcpy|strcat|sprintf)\s*\(/g;
    while ((m = dangerRe.exec(code))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Buffer overflow risk: '${m[1]}' does not bound writes. Use ${m[1] === 'gets' ? 'fgets' : m[1] === 'strcpy' ? 'strncpy' : m[1] === 'strcat' ? 'strncat' : 'snprintf'}.`,
        'BufferOverflowWarning', 'warning', undefined, m[0]);
    }
    // scanf("%s", …) — no width
    const scanfRe = /\bscanf\s*\(\s*"[^"]*%s[^"]*"/g;
    while ((m = scanfRe.exec(code))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Buffer overflow risk: scanf("%s") is unbounded. Use a width like %255s.`,
        'BufferOverflowWarning', 'warning', undefined, m[0]);
    }
    // File leak
    const fopenRe = /\bfopen\s*\(/g;
    const hasFclose = /\bfclose\s*\(/.test(code);
    while ((m = fopenRe.exec(code))) {
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
    const hasDelete = /\bdelete\s*(\[\])?\s*\w/.test(code);
    let m: RegExpExecArray | null;
    while ((m = newRe.exec(code))) {
      if (!hasDelete) {
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
    while ((m = infRe.exec(code))) {
      const p = loc(lines, m.index, m.index);
      // Look for a nearby break/return inside the following 400 chars (rough scope)
      const window = code.slice(m.index, Math.min(code.length, m.index + 600));
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
    while ((m = bigArrRe.exec(code))) {
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
  const divZeroRe = /\/\s*0(?!\.\d|\d)/g;
  {
    let m: RegExpExecArray | null;
    while ((m = divZeroRe.exec(code))) {
      const p = loc(lines, m.index, m.index);
      // Skip if inside a comment (rough check: line starts with // or #)
      const lineText = lines[p.line - 1] || '';
      if (lineText.trim().startsWith('//') || lineText.trim().startsWith('#')) continue;
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
    while ((m = re.exec(code))) {
      const p = loc(lines, m.index, m.index);
      const lt = lines[p.line - 1] || '';
      if (lt.trim().startsWith('//') || lt.trim().startsWith('#')) continue;
      push(out, p.line, p.column, m[0].length,
        `Modulo by zero. Runtime will throw / produce NaN.`,
        'ModuloByZeroError', 'error', 'Check divisor is non-zero before %.', m[0]);
    }
  }

  // sqrt of a negative literal: sqrt(-N), Math.sqrt(-N)
  {
    const re = /\b(?:Math\.)?sqrt\s*\(\s*-\s*\d+(?:\.\d+)?\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
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
    while ((m = re.exec(code))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Math error: log(${m[1].replace(/\s+/g, '')}) is undefined / -Infinity.`,
        'MathDomainError', 'error', 'Ensure argument > 0.', m[0]);
    }
  }

  // pow(0, 0) — indeterminate in some languages
  {
    const re = /\b(?:Math\.)?pow\s*\(\s*0\s*,\s*0\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
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
    while ((m = re.exec(code))) {
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
    while ((m = re.exec(code))) {
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
    while ((m = re.exec(code))) {
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
    while ((m = re.exec(code))) {
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
    while ((m = re.exec(code))) {
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
    while ((m = re.exec(code))) {
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
    while ((m = re.exec(code))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Float equality '${m[2]}' is unreliable due to IEEE-754 rounding.`,
        'FloatEqualityWarning', 'warning', 'Compare using abs(a - b) < EPS.', m[0]);
    }
  }

  // --- Unbounded recursion: function fn(...) { ... fn(...) ... } with no base case return before the recursive call
  const funcRe = /\b(?:function|def|fn|func)\s+([A-Za-z_]\w*)\s*\(/g;
  {
    let m: RegExpExecArray | null;
    while ((m = funcRe.exec(code))) {
      const name = m[1];
      const start = m.index;
      // Take a rough 800-char body window
      const body = code.slice(start, Math.min(code.length, start + 1200));
      const selfCall = new RegExp(`\\b${name}\\s*\\(`, 'g');
      const callMatches = body.match(selfCall) || [];
      if (callMatches.length >= 2) { // definition + at least one recursive call
        if (!/\b(if|switch|match|guard|when)\b[^{;]*\breturn\b/s.test(body) && !/\bif\b[^{;]*:\s*(?:return|raise)/.test(body)) {
          const p = loc(lines, start, start);
          push(out, p.line, p.column, name.length,
            `Possible unbounded recursion in '${name}': no base-case return detected before the recursive call. Risk of stack overflow.`,
            'RecursionWarning', 'warning', 'Add a base-case condition that returns before recursing.');
        }
      }
    }
  }

  // --- Python: mutable default arg
  if (family === 'python') {
    const mutDefRe = /\bdef\s+\w+\s*\([^)]*=\s*(\[\]|\{\}|dict\(\)|list\(\))/g;
    let m: RegExpExecArray | null;
    while ((m = mutDefRe.exec(code))) {
      const p = loc(lines, m.index, m.index);
      push(out, p.line, p.column, m[0].length,
        `Mutable default argument (${m[1]}) is a common Python bug — the same object is shared across calls.`,
        'MutableDefaultWarning', 'warning', 'Use =None and create the list/dict inside the function.');
    }
  }

  // --- JS: == comparison
  if (family === 'js') {
    const looseEq = /[^=!<>]==(?!=)/g;
    let m: RegExpExecArray | null;
    while ((m = looseEq.exec(code))) {
      const p = loc(lines, m.index + 1, m.index + 1);
      push(out, p.line, p.column, 2,
        `Loose equality '==' performs type coercion. Prefer '==='.`,
        'LooseEqualityWarning', 'warning', "Replace '==' with '==='.", '==');
    }
  }

  return out;
}

export const RUNTIME_RISK_LEGEND = [
  'Memory leaks (malloc/new without free/delete)',
  'Buffer overflow (gets, strcpy, unbounded scanf)',
  'Infinite loops (while(true) / for(;;) with no break)',
  'Stack/heap overflow (arrays > 10⁷)',
  'Division by zero',
  'Unbounded recursion',
  'File handle leaks',
  'Python mutable default args',
  'JS loose equality',
];