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