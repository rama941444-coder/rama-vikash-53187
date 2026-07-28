/**
 * Live, client-side, per-character syntax validator for Slide 5 (LiveCodeIDE).
 * 100% free, runs entirely in the browser (no LLM calls in the typing loop).
 * Covers the 106-language registry below. Other languages fall back to AI.
 */

export interface LiveError {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning';
  type: string;
  wrongCode?: string;
  suggestion?: string;
}

export const REGISTERED_LANGUAGES: readonly string[] = [
  'ABAP','Apex','Arduino','Astro','AutoIt','Azure CLI','Bash','Batch (BAT)','Bicep','Blade',
  'C','C++','C#','Cairo','Cameligo','Clojure','CMake','COBOL','CoffeeScript','CSS',
  'Cuda','Cypher','Dart','Delphi','Dockerfile','ECL','Elixir','Elm','Erlang','F#',
  'Flow9','Fortran','FreeMarker','Fsh','Gherkin','Git Attributes','Git Commit','Git Ignore','Go','Gradle',
  'GraphQL','Groovy','Handlebars','Haskell','HCL','HTML','INI','Java','JavaScript','JSON',
  'JSX','Julia','Kotlin','LaTeX','Less','Lexon','Liquid','Lisp','Lua','M3',
  'Makefile','Markdown','MDX','MIPS Assembly','MSDAX','MySQL','Objective-C','OCaml','Pascal','Pascaligo',
  'Perl','PgSQL','PHP','PL/SQL','Postiats','PowerQuery','PowerShell','Prisma','Protocol Buffers (Proto)','Pug',
  'Python','Q#','R','Razor','Redis','Redshift','ReStructuredText','Ruby','Rust','SAS',
  'Scala','Scheme','SCSS','Shell Script','Solidity','SPARQL','SQL','ST','Stylus','Swift',
  'SystemVerilog','Tcl','TOML','Twig','TypeScript','TSX','VBA','VB.NET','Verilog','VHDL',
  'Vue','WGSL','XML','YAML','Zig',
] as const;

const REG = new Set(REGISTERED_LANGUAGES.map((l) => l.toLowerCase()));

export function isRegisteredLanguage(lang?: string | null): boolean {
  return !!lang && REG.has(lang.toLowerCase());
}

export function unsupportedLanguageNotice(lang: string): string {
  return `Live local diagnostics are not available for '${lang}'. This language requires the AI model — run the analyzer for full error detection.`;
}

function familyOf(lang: string): string {
  const l = lang.toLowerCase();
  if (l === 'c' || l === 'c++' || l === 'arduino' || l === 'cuda' || l === 'objective-c') return 'c';
  if (l === 'python') return 'python';
  if (l === 'java' || l === 'c#' || l === 'apex' || l === 'scala' || l === 'groovy' || l === 'kotlin') return 'jvm';
  if (l === 'javascript' || l === 'typescript' || l === 'jsx' || l === 'tsx' || l === 'coffeescript' || l === 'vue' || l === 'astro') return 'js';
  if (l === 'html' || l === 'xml' || l === 'mdx') return 'markup';
  if (l === 'css' || l === 'scss' || l === 'less' || l === 'stylus') return 'css';
  if (l === 'json') return 'json';
  if (l === 'yaml' || l === 'toml' || l === 'ini') return 'config';
  if (l === 'sql' || l === 'mysql' || l === 'pgsql' || l === 'pl/sql' || l === 'redshift' || l === 'msdax' || l === 'sparql' || l === 'cypher') return 'sql';
  return 'generic';
}

const C_LOWERCASE_TOKENS = new Set([
  'auto','break','case','char','const','continue','default','do','double','else','enum','extern','float','for','goto','if','inline','int','long','register','restrict','return','short','signed','sizeof','static','struct','switch','typedef','union','unsigned','void','volatile','while',
  'alignas','alignof','and','and_eq','asm','bitand','bitor','bool','catch','class','compl','concept','consteval','constexpr','constinit','decltype','delete','dynamic_cast','explicit','export','false','friend','mutable','namespace','new','noexcept','not','not_eq','nullptr','operator','or','or_eq','private','protected','public','reinterpret_cast','requires','static_assert','static_cast','template','this','thread_local','throw','true','try','typeid','typename','using','virtual','wchar_t','xor','xor_eq',
  'main','include','define','ifdef','ifndef','endif','elif','pragma','error','warning','printf','scanf','fprintf','fscanf','sprintf','sscanf','puts','gets','putchar','getchar','malloc','calloc','realloc','free','memset','memcpy','strlen','strcpy','strcmp','fopen','fclose','fread','fwrite','stdin','stdout','stderr'
]);

const C_UPPERCASE_TOKENS = new Set([
  'NULL','EOF','FILE','BUFSIZ','FILENAME_MAX','FOPEN_MAX','TMP_MAX','SEEK_SET','SEEK_CUR','SEEK_END','EXIT_SUCCESS','EXIT_FAILURE','RAND_MAX','INT_MIN','INT_MAX','UINT_MAX','LONG_MIN','LONG_MAX','ULONG_MAX','CHAR_BIT','CHAR_MIN','CHAR_MAX','SCHAR_MIN','SCHAR_MAX','UCHAR_MAX','SHRT_MIN','SHRT_MAX','USHRT_MAX','FLT_MIN','FLT_MAX','DBL_MIN','DBL_MAX','TRUE','FALSE'
]);

function maskNonCode(line: string, fam: string, inBlockStart: boolean): { text: string; inBlock: boolean } {
  let out = '';
  let inBlock = inBlockStart;
  let inSingle = false;
  let inDouble = false;
  let inTpl = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1] || '';
    const prev = i > 0 ? line[i - 1] : '';
    if (inBlock) {
      if (c === '*' && n === '/') { out += '  '; i++; inBlock = false; }
      else out += ' ';
      continue;
    }
    if (!inSingle && !inDouble && !inTpl) {
      if (c === '/' && n === '/') { out += ' '.repeat(line.length - i); break; }
      if (c === '/' && n === '*') { out += '  '; i++; inBlock = true; continue; }
      if (c === '#' && (fam === 'python' || fam === 'config' || fam === 'generic')) { out += ' '.repeat(line.length - i); break; }
    }
    if (prev !== '\\') {
      if (c === '"' && !inSingle && !inTpl) { inDouble = !inDouble; out += c; continue; }
      if (c === "'" && !inDouble && !inTpl) { inSingle = !inSingle; out += c; continue; }
      if (c === '`' && !inSingle && !inDouble) { inTpl = !inTpl; out += c; continue; }
    }
    out += (inSingle || inDouble || inTpl) ? ' ' : c;
  }
  return { text: out, inBlock };
}

function needsCSemicolon(trimmed: string, nextTrimmed: string): boolean {
  if (!trimmed || /[;{}:,\\]$/.test(trimmed) || /^#/.test(trimmed)) return false;
  if (/^(if|else|for|while|do|switch|case|default|try|catch|class|namespace|public|private|protected)\b/.test(trimmed)) return false;
  if (/^(struct|union|enum)\b.*\{?$/.test(trimmed)) return false;
  if (/^[A-Za-z_]\w*\s*:\s*$/.test(trimmed)) return false;
  if (/^[A-Za-z_][\w:\s*&*<>~,]+\s+[A-Za-z_]\w*\s*\([^;]*\)\s*(?:const\s*)?(?:\{|$)/.test(trimmed)) return false;
  if (nextTrimmed === '{' && /^[A-Za-z_][\w:\s*&*<>~,]+\s+[A-Za-z_]\w*\s*\([^;]*\)\s*$/.test(trimmed)) return false;
  if (/^(return|break|continue|goto|throw)\b/.test(trimmed)) return true;
  if (/(\+\+|--)$/.test(trimmed)) return true;
  if (/(^|[^=!<>])=(?!=)|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=/.test(trimmed)) return true;
  if (/^(?:const\s+|static\s+|extern\s+|register\s+|volatile\s+|unsigned\s+|signed\s+|long\s+|short\s+|struct\s+\w+\s+|enum\s+\w+\s+|union\s+\w+\s+)*(?:void|char|short|int|long|float|double|signed|unsigned|size_t|bool|FILE|auto|[A-Za-z_]\w*(?:::\w+)?(?:\s*[<*][^;=(){}]*[>*])?)\s+[A-Za-z_*&\s][\w*&\s]*(?:\[[^\]]*\])?\s*(?:$|,)/.test(trimmed)) return true;
  if (/^[A-Za-z_]\w*(?:::\w+)?\s*\([^;{}]*\)$/.test(trimmed)) return true;
  return false;
}

function push(out: LiveError[], line: number, col: number, len: number, msg: string, type = 'SyntaxError', severity: 'error' | 'warning' = 'error', wrongCode?: string, suggestion?: string) {
  out.push({ line, column: col, endLine: line, endColumn: col + Math.max(1, len), message: msg, severity, type, wrongCode, suggestion });
}

function scan(line: string, lineNum: number, re: RegExp, build: (m: RegExpExecArray) => { msg: string; type?: string; severity?: 'error' | 'warning'; suggestion?: string } | null, out: LiveError[]) {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(line)) !== null) {
    const info = build(m);
    if (info && info.msg) push(out, lineNum, m.index + 1, m[0].length, info.msg, info.type, info.severity, m[0], info.suggestion);
    if (m.index === r.lastIndex) r.lastIndex++;
  }
}

/** Main entry — call on every keystroke. Target: 2–5 ms for ~50k chars. */
export function validateLive(code: string, language: string): LiveError[] {
  const out: LiveError[] = [];
  if (!code || !isRegisteredLanguage(language)) return out;

  const fam = familyOf(language);
  const lines = code.split('\n');

  // ---- bracket / quote balance ----
  let paren = 0, brack = 0, brace = 0;
  let inSingle = false, inDouble = false, inTpl = false, inBlock = false;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let lineCmt = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const prev = i > 0 ? line[i - 1] : '';
      if (inBlock) { if (c === '/' && prev === '*') inBlock = false; continue; }
      if (lineCmt) break;
      if (!inSingle && !inDouble && !inTpl) {
        if (c === '/' && line[i + 1] === '/') { lineCmt = true; break; }
        if (c === '#' && (fam === 'python' || fam === 'config' || fam === 'generic')) { lineCmt = true; break; }
        if (c === '/' && line[i + 1] === '*') { inBlock = true; i++; continue; }
      }
      if (prev !== '\\') {
        if (c === '"' && !inSingle && !inTpl) inDouble = !inDouble;
        else if (c === "'" && !inDouble && !inTpl) inSingle = !inSingle;
        else if (c === '`' && !inDouble && !inSingle) inTpl = !inTpl;
      }
      if (inSingle || inDouble || inTpl) continue;
      if (c === '(') paren++;
      else if (c === ')') { paren--; if (paren < 0) { push(out, li + 1, i + 1, 1, "unexpected closing ')'", 'SyntaxError'); paren = 0; } }
      else if (c === '[') brack++;
      else if (c === ']') { brack--; if (brack < 0) { push(out, li + 1, i + 1, 1, "unexpected closing ']'", 'SyntaxError'); brack = 0; } }
      else if (c === '{') brace++;
      else if (c === '}') { brace--; if (brace < 0) { push(out, li + 1, i + 1, 1, "unexpected closing '}'", 'SyntaxError'); brace = 0; } }
    }
    if (inSingle) { push(out, li + 1, Math.max(1, line.length), 1, "unclosed string literal (')", 'SyntaxError', 'error', line, "Add closing '"); inSingle = false; }
    if (inDouble && fam !== 'python') { push(out, li + 1, Math.max(1, line.length), 1, 'unclosed string literal (")', 'SyntaxError', 'error', line, 'Add closing "'); inDouble = false; }
  }
  const last = lines[lines.length - 1] || '';
  if (paren > 0) push(out, lines.length, last.length + 1, 1, `${paren} unclosed '('`, 'SyntaxError');
  if (brack > 0) push(out, lines.length, last.length + 1, 1, `${brack} unclosed '['`, 'SyntaxError');
  if (brace > 0) push(out, lines.length, last.length + 1, 1, `${brace} unclosed '{'`, 'SyntaxError');

  // ---- per-family casing and statement rules ----
  let maskingBlockComment = false;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineNum = li + 1;
    const trimmed = line.trim();
    const masked = maskNonCode(line, fam, maskingBlockComment);
    maskingBlockComment = masked.inBlock;
    const codeOnly = masked.text;
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    if ((fam === 'python' || fam === 'config') && trimmed.startsWith('#')) continue;

    // Rule A — C/C++/Arduino preprocessor
    if (fam === 'c') {
      const canonical = /^\s*#\s*include\s+[<"][^>"]+[>"]\s*$/.test(line);
      const looksLikeInclude = /#\s*[iI][nN][cC][lL]?[uU]?[dD]?[eE]?\b/.test(line) || /#\s*[Ii]n[Cc]lu[Dd]e/.test(line);
      if (looksLikeInclude && !canonical) {
        const col = line.indexOf('#') + 1;
        push(out, lineNum, col || 1, trimmed.length,
          "Invalid preprocessor directive capitalization or syntax structure. Expected lowercase '#include <header.h>'.",
          'PreprocessorError', 'error', trimmed,
          "Use '#include <stdio.h>' (lowercase, with matching '<...>').");
      }
      if (/^\s*[Ii]nclude\s*[<"]/.test(line)) {
        push(out, lineNum, 1, trimmed.length,
          "Missing '#' before preprocessor directive. Expected '#include <header.h>'.",
          'PreprocessorError', 'error', trimmed, "Prefix with '#'.");
      }

      scan(codeOnly, lineNum, /\b[A-Za-z_]\w*\b/, (m) => {
        const tok = m[0];
        const lower = tok.toLowerCase();
        const upper = tok.toUpperCase();
        const before = codeOnly.slice(0, m.index);
        if (tok !== lower && C_LOWERCASE_TOKENS.has(lower)) {
          return {
            msg: `Fatal Compilation Syntax Error. C/C++ is case-sensitive: '${tok}' must be '${lower}'.`,
            type: 'CaseSensitivityError',
            suggestion: `Replace '${tok}' with '${lower}'.`,
          };
        }
        if (tok !== upper && C_UPPERCASE_TOKENS.has(upper)) {
          return {
            msg: `Macro/constant case anomaly. Standard macro '${upper}' must remain uppercase, not '${tok}'.`,
            type: 'CaseSensitivityError',
            severity: 'warning',
            suggestion: `Replace '${tok}' with '${upper}'.`,
          };
        }
        if (/^\s*#\s*define\s+$/.test(before) && /[a-z]/.test(tok)) {
          return {
            msg: `Macro definition '${tok}' should be uppercase by C convention.`,
            type: 'MacroCaseWarning',
            severity: 'warning',
            suggestion: `Use '${upper}'.`,
          };
        }
        return null;
      }, out);

      const nextTrimmed = (lines[li + 1] || '').trim();
      if (needsCSemicolon(codeOnly.trim(), nextTrimmed)) {
        push(out, lineNum, line.length || 1, 1,
          "expected ';' at end of this C/C++ statement.",
          'SyntaxError', 'error', line, "Append ';' only on this statement line.");
      }
    }

    // Rule B — Python casing
    if (fam === 'python') {
      scan(line, lineNum, /\b(Def|DEF|Class|CLASS|If|IF|For|FOR|While|WHILE|Return|RETURN|Import|IMPORT|Print|PRINT|Lambda|LAMBDA|Elif|ELIF|Else|ELSE|TRUE|FALSE|NONE)\b/, (m) => {
        const tok = m[0];
        const lower = tok.toLowerCase();
        const builtins: Record<string, string> = { true: 'True', false: 'False', none: 'None' };
        const expected = builtins[lower] ?? lower;
        if (tok === expected) return null;
        return {
          msg: `Python identifiers and keywords are strictly case-sensitive. Expected lowercase keyword '${expected}'.`,
          type: 'NameError',
          suggestion: `Replace '${tok}' with '${expected}'.`,
        };
      }, out);
      scan(line, lineNum, /^\s*(def|if|elif|else|for|while|class|try|except|finally|with)\b[^#\n]*$/, (m) => {
        const txt = m[0].replace(/\s+$/, '');
        if (txt.endsWith(':')) return null;
        return { msg: "Missing ':' at end of compound statement.", type: 'SyntaxError', suggestion: "Add ':' at the end of the line." };
      }, out);
    }

    // Rule C — Java / C# casing + missing semicolon
    if (fam === 'jvm') {
      scan(line, lineNum, /\b(string|integer|boolean|character|double|float|long|short|byte|object)\s+[A-Za-z_]\w*\s*[=;)]/, (m) => {
        const tok = m[1];
        const cap = tok[0].toUpperCase() + tok.slice(1);
        return {
          msg: `Syntax Violation. Unresolved compilation token or missing terminating semicolon ';'. (use '${cap}' instead of '${tok}')`,
          type: 'CompilationError',
          suggestion: `Capitalize as '${cap}'.`,
        };
      }, out);
      const looksLikeStatement = trimmed.length > 0
        && !/[{};:,(]$/.test(trimmed)
        && !/^\s*[@#]/.test(trimmed)
        && !/^[A-Za-z_]\w*\s*:\s*$/.test(trimmed)
        && !/^(if|else|for|while|do|switch|case|default|try|catch|finally|public|private|protected|static|abstract|final|class|interface|enum|package|import|namespace|using|void)\b.*[({]\s*$/.test(trimmed)
        && /[A-Za-z0-9_)\]"']\s*$/.test(trimmed);
      if (looksLikeStatement) {
        push(out, lineNum, line.length || 1, 1,
          "Syntax Violation. Unresolved compilation token or missing terminating semicolon ';'.",
          'CompilationError', 'warning', line, "Append ';' at end of statement.");
      }
    }

    // Rule D — JS / TS / web casing
    if (fam === 'js') {
      scan(line, lineNum, /\b(Const|CONST|Let|LET|Var|VAR|Function|FUNCTION|Return|RETURN|If|IF|Else|ELSE|For|FOR|While|WHILE|Class|CLASS|New|NEW|This|THIS|Async|ASYNC|Await|AWAIT|Import|IMPORT|Export|EXPORT|TRUE|FALSE|NULL|UNDEFINED)\b/, (m) => {
        const tok = m[0];
        const lower = tok.toLowerCase();
        return {
          msg: `Unexpected token casing syntax anomaly detected. (use lowercase '${lower}')`,
          type: 'SyntaxError',
          suggestion: `Replace '${tok}' with '${lower}'.`,
        };
      }, out);
    }

    if (fam === 'markup') {
      scan(line, lineNum, /<\/[A-Za-z][\w-]*[^>]*$/, () => ({
        msg: "Closing '>' missing on end tag.",
        type: 'SyntaxError',
        suggestion: "Add '>' to close the tag.",
      }), out);
    }

    if (fam === 'json') {
      scan(line, lineNum, /,\s*[}\]]/, () => ({
        msg: 'Trailing comma is not allowed in JSON.',
        type: 'SyntaxError',
        suggestion: 'Remove the trailing comma.',
      }), out);
    }
  }

  return out;
}
