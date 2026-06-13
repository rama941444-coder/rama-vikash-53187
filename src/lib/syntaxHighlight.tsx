import { useMemo, forwardRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-perl';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-haskell';
import 'prismjs/components/prism-elixir';
import 'prismjs/components/prism-erlang';
import 'prismjs/components/prism-julia';

/* VS Code Dark+ and Light+ inspired token colors + bracket pair colorization */
const TOKEN_CSS = `
/* Dark theme (default) */
.lov-hl.dark .token.comment,.lov-hl.dark .token.prolog,.lov-hl.dark .token.doctype,.lov-hl.dark .token.cdata{color:#6a9955;font-style:italic}
.lov-hl.dark .token.punctuation{color:#d4d4d4}
.lov-hl.dark .token.property,.lov-hl.dark .token.tag,.lov-hl.dark .token.boolean,.lov-hl.dark .token.number,.lov-hl.dark .token.constant,.lov-hl.dark .token.symbol{color:#b5cea8}
.lov-hl.dark .token.selector,.lov-hl.dark .token.attr-name,.lov-hl.dark .token.string,.lov-hl.dark .token.char,.lov-hl.dark .token.builtin{color:#ce9178}
.lov-hl.dark .token.operator,.lov-hl.dark .token.entity,.lov-hl.dark .token.url{color:#d4d4d4}
.lov-hl.dark .token.atrule,.lov-hl.dark .token.attr-value,.lov-hl.dark .token.keyword{color:#569cd6;font-weight:600}
.lov-hl.dark .token.function,.lov-hl.dark .token.class-name{color:#dcdcaa}
.lov-hl.dark .token.regex,.lov-hl.dark .token.important,.lov-hl.dark .token.variable{color:#9cdcfe}
.lov-hl.dark .bp0{color:#ffd700}
.lov-hl.dark .bp1{color:#da70d6}
.lov-hl.dark .bp2{color:#179fff}
/* Light theme */
.lov-hl.light .token.comment,.lov-hl.light .token.prolog,.lov-hl.light .token.doctype,.lov-hl.light .token.cdata{color:#008000;font-style:italic}
.lov-hl.light .token.punctuation{color:#000000}
.lov-hl.light .token.property,.lov-hl.light .token.tag,.lov-hl.light .token.boolean,.lov-hl.light .token.number,.lov-hl.light .token.constant,.lov-hl.light .token.symbol{color:#098658}
.lov-hl.light .token.selector,.lov-hl.light .token.attr-name,.lov-hl.light .token.string,.lov-hl.light .token.char,.lov-hl.light .token.builtin{color:#a31515}
.lov-hl.light .token.operator,.lov-hl.light .token.entity,.lov-hl.light .token.url{color:#000000}
.lov-hl.light .token.atrule,.lov-hl.light .token.attr-value,.lov-hl.light .token.keyword{color:#0000ff;font-weight:600}
.lov-hl.light .token.function,.lov-hl.light .token.class-name{color:#795e26}
.lov-hl.light .token.regex,.lov-hl.light .token.important,.lov-hl.light .token.variable{color:#001080}
.lov-hl.light .bp0{color:#0431fa}
.lov-hl.light .bp1{color:#319331}
.lov-hl.light .bp2{color:#7b3814}
.lov-hl .err-sq{text-decoration:underline wavy #f14c4c;text-decoration-skip-ink:none}
`;

if (typeof document !== 'undefined' && !document.getElementById('lov-hl-style')) {
  const s = document.createElement('style');
  s.id = 'lov-hl-style';
  s.textContent = TOKEN_CSS;
  document.head.appendChild(s);
}

const ALIASES: Record<string, string> = {
  'javascript': 'javascript', 'js': 'javascript', 'node.js': 'javascript', 'nodejs': 'javascript',
  'typescript': 'typescript', 'ts': 'typescript', 'deno': 'typescript', 'bun': 'typescript',
  'jsx': 'jsx', 'tsx': 'tsx',
  'python': 'python', 'python2': 'python', 'python3': 'python', 'py': 'python',
  'c': 'c', 'c++': 'cpp', 'cpp': 'cpp', 'objective-c': 'c',
  'c#': 'csharp', 'csharp': 'csharp', 'vb.net': 'csharp',
  'java': 'java', 'kotlin': 'kotlin', 'scala': 'scala', 'groovy': 'java',
  'php': 'php', 'ruby': 'ruby', 'rb': 'ruby', 'crystal': 'ruby',
  'go': 'go', 'golang': 'go', 'rust': 'rust', 'swift': 'swift', 'dart': 'dart',
  'sql': 'sql', 'mysql': 'sql', 'postgresql': 'sql', 'sqlite': 'sql', 'mariadb': 'sql',
  'oracle database': 'sql', 'oracle pl/sql': 'sql', 'microsoft sql server': 'sql',
  'bash': 'bash', 'shell': 'bash', 'sh': 'bash', 'zsh': 'bash',
  'html': 'markup', 'xml': 'markup', 'markup': 'markup',
  'css': 'css', 'json': 'json',
  'lua': 'lua', 'perl': 'perl', 'r': 'r',
  'haskell': 'haskell', 'elixir': 'elixir', 'erlang': 'erlang', 'julia': 'julia',
  'coffeescript': 'javascript',
};

function normalizeLang(lang?: string): string | null {
  if (!lang) return null;
  const key = lang.trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  if (Prism.languages[key]) return key;
  return null;
}

function colorizeBrackets(html: string): string {
  // Walk char-by-char outside HTML tags, color matching () [] {}
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const opens = new Set(['(', '[', '{']);
  const closes = new Set([')', ']', '}']);
  const stack: { ch: string; depth: number }[] = [];
  let inTag = false;
  let out = '';
  let depth = 0;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === '<') { inTag = true; out += c; continue; }
    if (c === '>') { inTag = false; out += c; continue; }
    if (inTag) { out += c; continue; }
    if (opens.has(c)) {
      const cl = `bp${depth % 3}`;
      stack.push({ ch: c, depth });
      depth++;
      out += `<span class="${cl}">${c}</span>`;
    } else if (closes.has(c)) {
      const top = stack.pop();
      const d = top && top.ch === pairs[c] ? top.depth : Math.max(0, depth - 1);
      depth = Math.max(0, depth - 1);
      out += `<span class="bp${d % 3}">${c}</span>`;
    } else {
      out += c;
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface OverlayProps {
  code: string;
  language?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  padding?: string;
  /** Authoritative 1-based line numbers to mark with the red wavy underline.
   *  When omitted (or empty), NO wavy underline is rendered — preventing false positives. */
  errorLines?: number[];
  theme?: 'dark' | 'light';
}

export const HighlightedOverlay = forwardRef<HTMLPreElement, OverlayProps>(
  ({ code, language, fontFamily, fontSize = 14, lineHeight = 1.5, padding = '8px', errorLines, theme = 'dark' }, ref) => {
    const html = useMemo(() => {
      const lang = normalizeLang(language);
      const errSet = new Set<number>(errorLines || []);
      // ensure trailing newline so caret line is rendered
      const src = code.endsWith('\n') ? code + ' ' : code;
      let highlighted: string;
      if (lang && Prism.languages[lang]) {
        try { highlighted = Prism.highlight(src, Prism.languages[lang], lang); }
        catch { highlighted = escapeHtml(src); }
      } else {
        highlighted = escapeHtml(src);
      }
      highlighted = colorizeBrackets(highlighted);
      if (errSet.size) {
        const parts = highlighted.split('\n');
        for (let i = 0; i < parts.length; i++) {
          if (errSet.has(i + 1)) parts[i] = `<span class="err-sq">${parts[i] || ' '}</span>`;
        }
        highlighted = parts.join('\n');
      }
      return highlighted;
    }, [code, language, errorLines]);

    return (
      <pre
        ref={ref}
        aria-hidden
        className={`lov-hl ${theme}`}
        style={{
          position: 'absolute', inset: 0, margin: 0, padding,
          fontFamily, fontSize: `${fontSize}px`, lineHeight: String(lineHeight),
          whiteSpace: 'pre', overflow: 'hidden', pointerEvents: 'none',
          color: theme === 'light' ? '#000000' : '#d4d4d4',
          background: 'transparent',
          tabSize: 4 as unknown as number,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
);
HighlightedOverlay.displayName = 'HighlightedOverlay';
