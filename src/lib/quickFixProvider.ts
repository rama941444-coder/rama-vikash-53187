/**
 * Slide 5 only — Monaco quick fixes + hover explanations.
 *
 * Every finding produced by the offline pipeline (LSP → tree-sitter AST →
 * semgrep/semantic rules → heuristics) is turned into an actionable Monaco
 * code action and a hover card that names the engine that reported it.
 */
import type { Monaco } from '@monaco-editor/react';
import type * as MonacoNS from 'monaco-editor';

export interface QuickFixFinding {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning';
  type: string;
  suggestion?: string;
  wrongCode?: string;
  correctCode?: string;
  source?: string;
}

export interface QuickFix {
  title: string;
  /** Replacement text for the target line (whole-line edit). */
  newLineText: string;
}

const IMPORT_HINTS: Record<string, Record<string, string>> = {
  c: { printf: '#include <stdio.h>', scanf: '#include <stdio.h>', malloc: '#include <stdlib.h>', strlen: '#include <string.h>' },
  cpp: { cout: '#include <iostream>', cin: '#include <iostream>', vector: '#include <vector>', string: '#include <string>' },
  java: { List: 'import java.util.List;', ArrayList: 'import java.util.ArrayList;', Map: 'import java.util.Map;', Scanner: 'import java.util.Scanner;' },
  python: { sqrt: 'import math', randint: 'import random', datetime: 'import datetime', json: 'import json' },
};

function normalizeFamily(language?: string | null): string {
  const l = (language || '').toLowerCase();
  if (l.startsWith('c++') || l.includes('cpp')) return 'cpp';
  if (l === 'c') return 'c';
  if (l.includes('java') && !l.includes('javascript')) return 'java';
  if (l.includes('python')) return 'python';
  return l;
}

/** Derives concrete line edits for a finding. Pure + synchronous, fully offline. */
export function buildQuickFixes(
  finding: QuickFixFinding,
  lineText: string,
  language?: string | null,
): QuickFix[] {
  const fixes: QuickFix[] = [];
  const add = (title: string, newLineText: string) => {
    if (newLineText !== lineText) fixes.push({ title, newLineText });
  };

  // 1. Explicit correction supplied by the rule engine.
  if (finding.correctCode && finding.wrongCode && lineText.includes(finding.wrongCode)) {
    add(`Replace '${finding.wrongCode}' with '${finding.correctCode}'`,
      lineText.replace(finding.wrongCode, finding.correctCode));
  } else if (finding.correctCode && finding.correctCode.includes('\n') === false && !finding.wrongCode) {
    add('Apply suggested correction', finding.correctCode);
  }

  const type = finding.type.toLowerCase();
  const msg = finding.message.toLowerCase();

  // 2. Missing semicolon / statement terminator.
  if (msg.includes("expected ';'") || msg.includes('missing semicolon') || msg.includes('semicolon')) {
    if (!lineText.trimEnd().endsWith(';')) add("Add missing ';'", `${lineText.trimEnd()};`);
  }

  // 3. Missing import / include.
  if (type.includes('undefined') || msg.includes('not declared') || msg.includes('missing import') || msg.includes('undefined reference') || msg.includes('cannot find symbol')) {
    const fam = normalizeFamily(language);
    const table = IMPORT_HINTS[fam];
    if (table) {
      for (const [symbol, stmt] of Object.entries(table)) {
        if (new RegExp(`\\b${symbol}\\b`).test(lineText)) {
          fixes.push({ title: `Add '${stmt}' above`, newLineText: `${stmt}\n${lineText}` });
          break;
        }
      }
    }
  }

  // 4. Bounds / off-by-one risks.
  if (type.includes('bounds') || msg.includes('off-by-one') || msg.includes('out of bounds')) {
    if (/<=\s*\w+\.?(length|size\(\)|len\()/.test(lineText)) {
      add('Use < instead of <= for the bound', lineText.replace('<=', '<'));
    }
  }

  // 5. Overflow / underflow risks.
  if (type.includes('overflow') || msg.includes('overflow') || msg.includes('underflow')) {
    if (/\bint\b/.test(lineText)) add('Widen int to long to avoid overflow', lineText.replace(/\bint\b/, 'long'));
  }

  // 6. Type mismatch: guard with an explicit cast hint.
  if (type.includes('type') && (msg.includes('mismatch') || msg.includes('incompatible'))) {
    add('Comment the mismatch for review', `${lineText}  // TODO: type mismatch — ${finding.message}`);
  }

  // 7. Loose equality.
  if (type.includes('looseequality')) {
    if (lineText.includes('==') && !lineText.includes('===')) add("Use '===' strict equality", lineText.replace('==', '==='));
    else if (lineText.includes('!=') && !lineText.includes('!==')) add("Use '!==' strict inequality", lineText.replace('!=', '!=='));
  }

  // 8. Universal fallback — record the suggestion inline so nothing is silent.
  if (!fixes.length && finding.suggestion) {
    add(`Insert hint: ${finding.suggestion}`, `${lineText}  // ${finding.suggestion}`);
  }

  return fixes;
}

export function describeFinding(f: QuickFixFinding): string {
  const src = f.source ? ` · reported by **${f.source}**` : '';
  const tip = f.suggestion ? `\n\n💡 ${f.suggestion}` : '';
  return `**${f.type}** (${f.severity})${src}\n\n${f.message}${tip}`;
}

/**
 * Registers hover + quick-fix providers backed by a live findings getter.
 * Returns a disposer.
 */
export function registerQuickFixProviders(
  monaco: Monaco,
  languageId: string,
  getFindings: () => QuickFixFinding[],
  getLanguageName: () => string,
): MonacoNS.IDisposable {
  const findingsForLine = (line: number) => getFindings().filter((f) => f.line === line);

  const hover = monaco.languages.registerHoverProvider(languageId, {
    provideHover(model, position) {
      const items = findingsForLine(position.lineNumber);
      if (!items.length) return null;
      return {
        range: new monaco.Range(position.lineNumber, 1, position.lineNumber, model.getLineMaxColumn(position.lineNumber)),
        contents: items.slice(0, 5).map((f) => ({ value: describeFinding(f) })),
      };
    },
  });

  const actions = monaco.languages.registerCodeActionProvider(languageId, {
    provideCodeActions(model, range) {
      const line = range.startLineNumber;
      const lineText = model.getLineContent(line);
      const items = findingsForLine(line);
      const all: MonacoNS.languages.CodeAction[] = [];

      for (const f of items) {
        for (const fix of buildQuickFixes(f, lineText, getLanguageName())) {
          all.push({
            title: fix.title,
            kind: 'quickfix',
            diagnostics: [],
            isPreferred: all.length === 0,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  versionId: model.getVersionId(),
                  textEdit: {
                    range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
                    text: fix.newLineText,
                  },
                } as MonacoNS.languages.IWorkspaceTextEdit,
              ],
            },
          });
        }
      }

      return { actions: all, dispose() {} };
    },
  });

  return {
    dispose() {
      hover.dispose();
      actions.dispose();
    },
  };
}
