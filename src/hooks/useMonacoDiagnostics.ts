import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type * as MonacoNS from 'monaco-editor';
import { validateLive } from '@/lib/liveSyntaxValidator';
import { detectRuntimeRisks } from '@/lib/runtimeRiskHeuristics';

export interface MonacoDiagnosticFinding {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning';
  type: string;
  suggestion?: string;
}

interface UseMonacoDiagnosticsArgs {
  code: string;
  language?: string | null;
  editorRef: MutableRefObject<MonacoNS.editor.IStandaloneCodeEditor | null>;
  monacoRef: MutableRefObject<Monaco | null>;
  owner: string;
  readyKey?: number;
  debounceMs?: number;
  maxMarkers?: number;
  externalFindings?: MonacoDiagnosticFinding[];
}

const normalizeFinding = (finding: any): MonacoDiagnosticFinding | null => {
  const line = Number(finding?.line);
  if (!Number.isFinite(line) || line < 1) return null;

  return {
    line,
    column: Math.max(1, Number(finding?.column) || 1),
    endLine: Number.isFinite(Number(finding?.endLine)) ? Math.max(1, Number(finding.endLine)) : undefined,
    endColumn: Number.isFinite(Number(finding?.endColumn)) ? Math.max(1, Number(finding.endColumn)) : undefined,
    message: String(finding?.message || 'Diagnostic finding'),
    severity: finding?.severity === 'error' ? 'error' : 'warning',
    type: String(finding?.type || 'Diagnostic'),
    suggestion: finding?.suggestion ? String(finding.suggestion) : undefined,
  };
};

const findingSignature = (findings: MonacoDiagnosticFinding[]) =>
  findings
    .map((f) => `${f.severity}|${f.line}|${f.column}|${f.endLine || f.line}|${f.endColumn || 0}|${f.type}|${f.message}|${f.suggestion || ''}`)
    .join('\n');

export function useMonacoDiagnostics({
  code,
  language,
  editorRef,
  monacoRef,
  owner,
  readyKey = 0,
  debounceMs = 400,
  maxMarkers = 300,
  externalFindings,
}: UseMonacoDiagnosticsArgs): MonacoDiagnosticFinding[] {
  const [findings, setFindings] = useState<MonacoDiagnosticFinding[]>([]);
  const lastMarkerSignatureRef = useRef('');
  const lastFindingSignatureRef = useRef('');
  const runSeqRef = useRef(0);
  const currentModelRef = useRef<MonacoNS.editor.ITextModel | null>(null);

  const externalSignature = useMemo(
    () => (externalFindings ? findingSignature(externalFindings.map(normalizeFinding).filter(Boolean) as MonacoDiagnosticFinding[]) : ''),
    [externalFindings],
  );

  useEffect(() => {
    const applyDiagnostics = (nextRaw: any[]) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const nextFindings = nextRaw
        .map(normalizeFinding)
        .filter(Boolean) as MonacoDiagnosticFinding[];

      const deduped = Array.from(
        new Map(nextFindings.map((f) => [`${f.line}:${f.column}:${f.type}:${f.message}`, f])).values(),
      ).slice(0, maxMarkers);

      const nextFindingSignature = findingSignature(deduped);
      if (nextFindingSignature !== lastFindingSignatureRef.current) {
        lastFindingSignatureRef.current = nextFindingSignature;
        setFindings(deduped);
      }

      if (!editor || !monaco) return;
      const model = editor.getModel();
      if (!model) return;
      currentModelRef.current = model;

      const markers = deduped.map((f) => {
        const lineText = model.getLineContent(Math.min(f.line, model.getLineCount())) || '';
        const startColumn = Math.max(1, Math.min(f.column || 1, lineText.length + 1));
        const endColumn = Math.max(startColumn + 1, Math.min(f.endColumn || lineText.length + 1, lineText.length + 1));
        return {
          startLineNumber: f.line,
          startColumn,
          endLineNumber: f.endLine || f.line,
          endColumn,
          message: `${f.type}: ${f.message}${f.suggestion ? `\n💡 ${f.suggestion}` : ''}`,
          severity: f.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
          source: owner,
        };
      });

      const markerSignature = `${model.uri.toString()}\n${model.getVersionId()}\n${findingSignature(deduped)}`;
      if (markerSignature !== lastMarkerSignatureRef.current) {
        monaco.editor.setModelMarkers(model, owner, markers);
        lastMarkerSignatureRef.current = markerSignature;
      }
    };

    if (externalFindings) {
      applyDiagnostics(externalFindings);
      return;
    }

    const seq = ++runSeqRef.current;
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (seq !== runSeqRef.current) return;
      if (!code.trim()) {
        applyDiagnostics([]);
        return;
      }

      const activeLanguage = language || 'plaintext';
      let next: any[] = [];
      try { next = next.concat(validateLive(code, activeLanguage) || []); } catch {}
      try { next = next.concat(detectRuntimeRisks(code, activeLanguage) || []); } catch {}
      applyDiagnostics(next);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [code, language, owner, readyKey, debounceMs, maxMarkers, externalSignature, externalFindings, editorRef, monacoRef]);

  useEffect(() => {
    return () => {
      const monaco = monacoRef.current;
      const model = currentModelRef.current;
      if (monaco && model) monaco.editor.setModelMarkers(model, owner, []);
    };
  }, [monacoRef, owner]);

  return findings;
}