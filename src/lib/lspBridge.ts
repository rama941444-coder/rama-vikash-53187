/**
 * Slide 5 only — Monaco language-server bridge.
 *
 * Monaco ships real language servers (workers) for TS/JS, JSON, CSS/SCSS/LESS
 * and HTML. When one of them owns the active model, its diagnostics are the
 * primary source of truth; the AST/semgrep engine stays as the fallback for
 * every other language.
 */
import type { Monaco } from '@monaco-editor/react';
import type * as MonacoNS from 'monaco-editor';

const LSP_LANGUAGES = new Set([
  'typescript', 'javascript', 'json', 'css', 'scss', 'less', 'html',
]);

export interface LspFinding {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning';
  type: string;
  suggestion?: string;
}

export function hasLanguageServer(monacoLanguageId?: string | null) {
  return !!monacoLanguageId && LSP_LANGUAGES.has(monacoLanguageId.toLowerCase());
}

/** Reads markers produced by Monaco's own language servers (owner != ours). */
export function readLspFindings(
  monaco: Monaco | null,
  editor: MonacoNS.editor.IStandaloneCodeEditor | null,
  ownOwners: string[] = [],
): LspFinding[] {
  if (!monaco || !editor) return [];
  const model = editor.getModel();
  if (!model) return [];
  if (!hasLanguageServer(model.getLanguageId())) return [];

  const skip = new Set(ownOwners);
  return monaco.editor
    .getModelMarkers({ resource: model.uri })
    .filter((m) => !skip.has(String(m.source || '')))
    .filter((m) => m.severity >= monaco.MarkerSeverity.Warning)
    .map((m) => ({
      line: m.startLineNumber,
      column: m.startColumn,
      endLine: m.endLineNumber,
      endColumn: m.endColumn,
      message: m.message,
      severity: (m.severity === monaco.MarkerSeverity.Error ? 'error' : 'warning') as 'error' | 'warning',
      type: 'LanguageServer',
      suggestion: m.code ? `Language server rule ${typeof m.code === 'object' ? m.code.value : m.code}` : undefined,
    }));
}