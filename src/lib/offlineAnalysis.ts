/**
 * 100% offline complexity analyzer + JS sandbox runner.
 * No network, no AI. Used as instant fallback and as the sole
 * engine when navigator.onLine === false.
 */

export interface OfflineComplexity {
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
}

/**
 * Strip comments and string literals so loop/array regex matches
 * are not fooled by tokens inside text.
 */
function stripCommentsAndStrings(src: string): string {
  let s = src;
  // /* block */ comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // line comments: //  #  --
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  s = s.replace(/(^|\s)#[^\n]*/g, '$1');
  s = s.replace(/--[^\n]*/g, '');
  // strings: "...", '...', `...`
  s = s.replace(/"(?:\\.|[^"\\])*"/g, '""');
  s = s.replace(/'(?:\\.|[^'\\])*'/g, "''");
  s = s.replace(/`(?:\\.|[^`\\])*`/g, '``');
  return s;
}

/**
 * Walk a brace-balanced source and compute the maximum loop nesting depth.
 * Works for languages that delimit blocks with `{ }` (C/C++/Java/JS/TS/Go/Rust/etc).
 * For Python we fall back to indentation analysis.
 */
function maxBraceLoopDepth(src: string): number {
  const loopRe = /\b(for|while|do)\b\s*[\(\{]?/g;
  const stack: { isLoop: boolean }[] = [];
  let maxDepth = 0;
  let curLoopDepth = 0;
  let i = 0;
  let pendingLoop = false;

  while (i < src.length) {
    loopRe.lastIndex = i;
    const m = loopRe.exec(src);
    const nextBraceOpen = src.indexOf('{', i);
    const nextBraceClose = src.indexOf('}', i);

    // Find the next event: loop keyword, `{`, or `}`.
    const candidates = [
      m ? m.index : Infinity,
      nextBraceOpen >= 0 ? nextBraceOpen : Infinity,
      nextBraceClose >= 0 ? nextBraceClose : Infinity,
    ];
    const next = Math.min(...candidates);
    if (next === Infinity) break;

    if (m && next === m.index) {
      pendingLoop = true;
      i = m.index + m[0].length;
    } else if (next === nextBraceOpen) {
      stack.push({ isLoop: pendingLoop });
      if (pendingLoop) {
        curLoopDepth++;
        if (curLoopDepth > maxDepth) maxDepth = curLoopDepth;
      }
      pendingLoop = false;
      i = nextBraceOpen + 1;
    } else {
      const frame = stack.pop();
      if (frame?.isLoop) curLoopDepth--;
      i = nextBraceClose + 1;
    }
  }
  return maxDepth;
}

function maxIndentLoopDepth(src: string): number {
  // Python-style: track loop blocks by indentation
  const lines = src.split('\n');
  const loopStack: number[] = []; // indents where a loop opened
  let maxDepth = 0;
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ');
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    while (loopStack.length && indent <= loopStack[loopStack.length - 1]) {
      loopStack.pop();
    }
    if (/^\s*(for|while)\b.*:\s*$/.test(line)) {
      loopStack.push(indent);
      if (loopStack.length > maxDepth) maxDepth = loopStack.length;
    }
  }
  return maxDepth;
}

export function analyzeComplexityOffline(
  rawCode: string,
  language: string
): OfflineComplexity {
  if (!rawCode.trim()) {
    return { timeComplexity: 'O(1)', spaceComplexity: 'O(1)', explanation: 'Empty program.' };
  }
  const src = stripCommentsAndStrings(rawCode);
  const lang = (language || '').toLowerCase();
  const isIndent = /python|py|coffeescript|nim|yaml/.test(lang);
  let depth = isIndent ? maxIndentLoopDepth(src) : maxBraceLoopDepth(src);

  // Recursion + sort heuristics
  const hasSort = /\.sort\b|\bsort\s*\(|\bsorted\s*\(|Arrays\.sort|Collections\.sort/.test(src);
  const looksBinarySearch =
    /(mid\s*=\s*\(?\s*(low|left|l)\s*\+\s*(high|right|r)\s*\)?\s*\/\s*2)|\bbinary[_-]?search\b/i.test(src);
  const recursionHits = (() => {
    const fnNames = [
      ...src.matchAll(/\bfunction\s+(\w+)/g),
      ...src.matchAll(/\bdef\s+(\w+)/g),
      ...src.matchAll(/\bfn\s+(\w+)/g),
      ...src.matchAll(/(?:\w[\w<>]*\s+)?(\w+)\s*\([^)]*\)\s*\{/g),
    ].map(m => m[1]).filter(Boolean);
    return fnNames.some(n => new RegExp(`\\b${n}\\s*\\([^)]*\\)`, 'g').test(src.replace(new RegExp(`\\b(function|def|fn)\\s+${n}\\b`), '')));
  })();

  let time: string;
  let explanation: string;
  if (depth === 0) {
    if (looksBinarySearch) {
      time = 'O(log n)';
      explanation = 'Divide-and-conquer pattern detected (binary-search style).';
    } else if (hasSort) {
      time = 'O(n log n)';
      explanation = 'Sorting call detected (typical O(n log n)).';
    } else if (recursionHits) {
      time = 'O(n)';
      explanation = 'Linear recursion detected.';
    } else {
      time = 'O(1)';
      explanation = 'No loops or recursion — constant time.';
    }
  } else if (depth === 1) {
    time = hasSort ? 'O(n log n)' : 'O(n)';
    explanation = `Single ${hasSort ? 'sort + loop' : 'loop'} over the input.`;
  } else if (depth === 2) {
    time = 'O(n²)';
    explanation = 'Two nested loops over the input.';
  } else {
    time = `O(n^${depth})`;
    explanation = `${depth} nested loops detected.`;
  }

  // Space complexity: scan for array/list/matrix allocations sized by input
  const has2D =
    /new\s+\w+\s*\[[^\]]+\]\s*\[[^\]]+\]/.test(src) || // C/Java: new int[n][n]
    /\[\s*\[[^\]]*for[^\]]+\][^\]]*for[^\]]+\]/.test(src) || // Python comprehensions
    /vector\s*<\s*vector\s*<[^>]+>\s*>/.test(src) ||
    /\bArray\s*\(\s*\w+\s*\)\.fill\([^)]*Array\s*\(/.test(src);
  const has1D =
    /new\s+\w+\s*\[[^\]]+\]/.test(src) ||
    /\bnew\s+(ArrayList|LinkedList|HashMap|HashSet|Vector|Map|Set)\b/.test(src) ||
    /\b(list|dict|set|tuple)\s*\(/.test(src) ||
    /\[\s*[^[\]]*for\s+\w+\s+in\b/.test(src) ||
    /\bArray\s*\(\s*\w+\s*\)/.test(src) ||
    /\bvec!\s*\[/.test(src) ||
    /\bmake\s*\(\s*\[\]/.test(src);

  let space: string;
  if (has2D) space = 'O(n²)';
  else if (has1D || recursionHits) space = 'O(n)';
  else space = 'O(1)';

  return { timeComplexity: time, spaceComplexity: space, explanation };
}

/**
 * Run JavaScript / TypeScript-ish code 100% offline by capturing console.* output.
 * Other languages return a clear offline notice.
 */
export interface OfflineRunResult {
  output: string;
  error?: string;
  supported: boolean;
}

export function runOffline(code: string, language: string, stdin: string = ''): OfflineRunResult {
  const lang = (language || '').toLowerCase();
  const isJs = /^(javascript|js|typescript|ts|node)/.test(lang) || lang === 'auto-detect';
  if (!isJs) {
    return {
      output: '',
      error:
        `Offline runtime is only available for JavaScript in the browser.\n` +
        `Reconnect to the internet to execute ${language} via the cloud compiler.`,
      supported: false,
    };
  }
  // Sanitize TS-ish syntax cheaply
  const stripped = code
    .replace(/^\s*import[^;]+;?\s*$/gm, '')
    .replace(/^\s*export\s+/gm, '')
    .replace(/:\s*[A-Za-z_][\w<>\[\],\s|&?]*\s*(?=[,)=])/g, '');
  const logs: string[] = [];
  const inputLines = stdin.split('\n');
  let inputIdx = 0;
  const fakeConsole = {
    log: (...a: unknown[]) => logs.push(a.map(formatVal).join(' ')),
    error: (...a: unknown[]) => logs.push(a.map(formatVal).join(' ')),
    warn: (...a: unknown[]) => logs.push(a.map(formatVal).join(' ')),
    info: (...a: unknown[]) => logs.push(a.map(formatVal).join(' ')),
  };
  const fakePrompt = (_msg?: string) => (inputIdx < inputLines.length ? inputLines[inputIdx++] : '');
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('console', 'prompt', `"use strict";\n${stripped}`);
    fn(fakeConsole, fakePrompt);
    return { output: logs.join('\n') || '(no output)', supported: true };
  } catch (e: any) {
    return { output: logs.join('\n'), error: String(e?.message || e), supported: true };
  }
}

function formatVal(v: unknown): string {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}