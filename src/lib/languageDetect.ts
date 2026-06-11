// Lightweight heuristic language detector for the notepad.
// Used when the user leaves the language selector on "Auto-Detect".
// Returns a value that matches one of the entries in PROGRAMMING_LANGUAGES.

type Rule = { lang: string; score: (s: string) => number };

const has = (re: RegExp) => (s: string) => (re.test(s) ? 1 : 0);
const count = (re: RegExp) => (s: string) => (s.match(re) || []).length;

const RULES: Rule[] = [
  // Web
  { lang: 'HTML', score: (s) => (/^\s*<!DOCTYPE html|<html[\s>]|<body[\s>]|<head[\s>]/i.test(s) ? 5 : 0) + count(/<\/?(div|span|p|a|h[1-6]|img|ul|li|table)[\s>]/gi)(s) },
  { lang: 'CSS', score: (s) => (/[{;]\s*(color|background|margin|padding|font-size|display)\s*:/i.test(s) ? 3 : 0) },
  { lang: 'JavaScript', score: (s) => has(/\b(console\.log|=>|require\(|module\.exports|document\.|window\.)/)(s) * 3 + count(/\b(let|const|function|var)\s+\w/g)(s) },
  { lang: 'TypeScript', score: (s) => has(/:\s*(string|number|boolean|any|void|unknown)\b|\binterface\s+\w+|\benum\s+\w+|\bas\s+(string|number|any)\b/)(s) * 4 },

  // Python family
  { lang: 'Python', score: (s) => has(/^\s*def\s+\w+\(|^\s*from\s+\w+\s+import|\bprint\(|\bself\b|^\s*import\s+\w+/m)(s) * 3 },

  // C family
  { lang: 'C', score: (s) => has(/#include\s*<[\w.]+>/)(s) * 2 + has(/\bint\s+main\s*\(/)(s) * 2 + has(/\bprintf\s*\(/)(s) },
  { lang: 'C++', score: (s) => has(/#include\s*<iostream>|std::|cout\s*<<|cin\s*>>/)(s) * 4 },
  { lang: 'C#', score: (s) => has(/\busing\s+System\b|Console\.WriteLine|namespace\s+\w+/)(s) * 3 },

  { lang: 'Java', score: (s) => has(/\bpublic\s+(class|static\s+void\s+main)\b|System\.out\.println/)(s) * 4 },
  { lang: 'Kotlin', score: (s) => has(/\bfun\s+main\s*\(|println\(|\bval\s+\w+\s*=|\bvar\s+\w+\s*=/)(s) * 2 },
  { lang: 'Swift', score: (s) => has(/\bfunc\s+\w+\(|\blet\s+\w+\s*=|\bvar\s+\w+\s*=|print\(/)(s) * 2 + has(/->\s*\w+\s*\{/)(s) },

  { lang: 'Go', score: (s) => has(/\bpackage\s+main\b|func\s+main\(|fmt\.(Println|Printf)/)(s) * 4 },
  { lang: 'Rust', score: (s) => has(/\bfn\s+main\s*\(|let\s+mut\s+|println!\(|use\s+std::/)(s) * 4 },

  { lang: 'Ruby', score: (s) => has(/\bdef\s+\w+\s*$|\bputs\s+|end\s*$/m)(s) * 2 },
  { lang: 'PHP', score: (s) => has(/<\?php|\$\w+\s*=|echo\s+/)(s) * 3 },
  { lang: 'Perl', score: (s) => has(/\buse\s+strict;|\bmy\s+\$\w+|sub\s+\w+\s*\{/)(s) * 3 },
  { lang: 'Lua', score: (s) => has(/\bfunction\s+\w+\(|local\s+\w+\s*=|print\(/)(s) * 2 },
  { lang: 'Bash', score: (s) => has(/^#!\/bin\/(ba)?sh|\becho\s+"|\$\{?\w+\}?/m)(s) * 2 },

  { lang: 'SQL', score: (s) => has(/\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|ALTER TABLE)\b/i)(s) * 3 },

  { lang: 'Haskell', score: (s) => has(/::\s*\w+\s*->|\bmodule\s+\w+\s+where|\bdo\s*$/m)(s) * 3 },
  { lang: 'Scala', score: (s) => has(/\bobject\s+\w+\s*\{|\bdef\s+\w+.*:\s*\w+\s*=/)(s) * 3 },
  { lang: 'R', score: (s) => has(/<-\s*function\(|\bprint\(|\bggplot\(/)(s) * 2 },
  { lang: 'Dart', score: (s) => has(/\bvoid\s+main\(\)|print\(|Widget\s+build\(/)(s) * 2 },
  { lang: 'Elixir', score: (s) => has(/\bdefmodule\s+\w+|\bdef\s+\w+\s+do|\|>/)(s) * 3 },
  { lang: 'Erlang', score: (s) => has(/-module\(|-export\(|->\s*$/m)(s) * 3 },
  { lang: 'Julia', score: (s) => has(/\bfunction\s+\w+\(.*\)\s*$|println\(|\bend\s*$/m)(s) * 2 },
  { lang: 'Zig', score: (s) => has(/\bconst\s+std\s*=\s*@import|pub\s+fn\s+main/)(s) * 4 },
  { lang: 'Nim', score: (s) => has(/\bproc\s+\w+\(|echo\s+"/)(s) * 3 },

  { lang: 'JSON', score: (s) => (/^\s*[\[{][\s\S]*[\]}]\s*$/.test(s.trim()) ? 2 : 0) },
  { lang: 'XML', score: (s) => has(/<\?xml/)(s) * 4 },
  { lang: 'YAML', score: (s) => has(/^[\w-]+:\s*$/m)(s) * 2 },
  { lang: 'Markdown', score: (s) => has(/^#{1,6}\s+|^\s*[-*]\s+|```/m)(s) },
];

export function detectLanguage(code: string): string | null {
  if (!code || code.trim().length < 4) return null;
  let best = { lang: '', score: 0 };
  for (const r of RULES) {
    const score = r.score(code);
    if (score > best.score) best = { lang: r.lang, score };
  }
  return best.score >= 2 ? best.lang : null;
}

// Map detected language → BCP-47 / Prism-friendly hints if needed in future.
export const isAutoDetect = (v: string) =>
  !v || v === 'Auto-Detect' || v.toLowerCase() === 'auto-detect';
