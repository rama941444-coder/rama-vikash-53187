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

/* VS Code "Dark+" inspired token colors + bracket pair colorization */
const TOKEN_CSS = `
.lov-hl .token.comment,.lov-hl .token.prolog,.lov-hl .token.doctype,.lov-hl .token.cdata{color:#6a9955;font-style:italic}
.lov-hl .token.punctuation{color:#d4d4d4}
.lov-hl .token.property,.lov-hl .token.tag,.lov-hl .token.boolean,.lov-hl .token.number,.lov-hl .token.constant,.lov-hl .token.symbol{color:#b5cea8}
.lov-hl .token.selector,.lov-hl .token.attr-name,.lov-hl .token.string,.lov-hl .token.char,.lov-hl .token.builtin{color:#ce9178}
.lov-hl .token.operator,.lov-hl .token.entity,.lov-hl .token.url,.lov-hl .language-css .token.string,.lov-hl .style .token.string{color:#d4d4d4}
.lov-hl .token.atrule,.lov-hl .token.attr-value,.lov-hl .token.keyword{color:#569cd6;font-weight:600}
.lov-hl .token.function,.lov-hl .token.class-name{color:#dcdcaa}
.lov-hl .token.regex,.lov-hl .token.important,.lov-hl .token.variable{color:#9cdcfe}
.lov-hl .bp0{color:#ffd700}
.lov-hl .bp1{color:#da70d6}
.lov-hl .bp2{color:#179fff}
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

function underlineErrors(code: string, lang: string | null): Set<number> {
  const bad = new Set<number>();
  if (!lang) return bad;
  if (!['java', 'c', 'cpp', 'csharp', 'javascript', 'typescript'].includes(lang)) return bad;
  const lines = code.split('\n');
  lines.forEach((ln, i) => {
    const t = ln.replace(/\/\/.*$/, '').trim();
    if (!t) return;
    if (/[{};:,\\)]$/.test(t)) return;
    if (/^(if|else|for|while|do|switch|case|default|try|catch|finally|public|private|protected|class|interface|enum|import|package|return|break|continue|#include|#define|@\w+)\b/.test(t)) return;
    if (t.endsWith(')') && /^(if|while|for|switch)\b/.test(t)) return;
    if (/^[A-Za-z_][\w]*\s*\(/.test(t) && t.endsWith(')')) {
      bad.add(i + 1);
    } else if (/=\s*[^;]+$/.test(t)) {
      bad.add(i + 1);
    } else if (/^\s*\w+\s+\w+\s*$/.test(t)) {
      bad.add(i + 1);
    }
  });
  return bad;
}

interface OverlayProps {
  code: string;
  language?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  padding?: string;
}

export const HighlightedOverlay = forwardRef<HTMLPreElement, OverlayProps>(
  ({ code, language, fontFamily, fontSize = 14, lineHeight = 1.5, padding = '8px' }, ref) => {
    const html = useMemo(() => {
      const lang = normalizeLang(language);
      const errLines = underlineErrors(code, lang);
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
      if (errLines.size) {
        const parts = highlighted.split('\n');
        for (let i = 0; i < parts.length; i++) {
          if (errLines.has(i + 1)) parts[i] = `<span class="err-sq">${parts[i] || ' '}</span>`;
        }
        highlighted = parts.join('\n');
      }
      return highlighted;
    }, [code, language]);

    return (
      <pre
        ref={ref}
        aria-hidden
        className="lov-hl"
        style={{
          position: 'absolute', inset: 0, margin: 0, padding,
          fontFamily, fontSize: `${fontSize}px`, lineHeight: String(lineHeight),
          whiteSpace: 'pre', overflow: 'hidden', pointerEvents: 'none',
          color: '#d4d4d4', background: 'transparent',
          tabSize: 4 as unknown as number,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
);
HighlightedOverlay.displayName = 'HighlightedOverlay';
