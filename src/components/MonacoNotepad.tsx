import { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import type * as MonacoNS from 'monaco-editor';
import { Maximize2, Minimize2, Copy, Trash2, FileDown, Type, Settings2, Sun, Moon, AlertCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const FONT_FAMILIES = [
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, monospace' },
  { label: 'Fira Code', value: '"Fira Code", Consolas, monospace' },
  { label: 'Consolas', value: 'Consolas, Monaco, "Courier New", monospace' },
  { label: 'Monaco', value: 'Monaco, Consolas, monospace' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

// Map the app's language names / detected labels to Monaco language ids.
export function toMonacoLang(name?: string | null): string {
  if (!name) return 'plaintext';
  const l = name.trim().toLowerCase();
  const map: Record<string, string> = {
    'auto-detect': 'plaintext', 'plain text': 'plaintext',
    'javascript': 'javascript', 'js': 'javascript', 'node.js': 'javascript', 'node': 'javascript',
    'typescript': 'typescript', 'ts': 'typescript',
    'jsx': 'javascript', 'react jsx': 'javascript',
    'tsx': 'typescript', 'react tsx': 'typescript',
    'python': 'python', 'python 3': 'python', 'python 2': 'python', 'micropython': 'python', 'circuitpython': 'python',
    'java': 'java',
    'c': 'c',
    'c++': 'cpp', 'cpp': 'cpp', 'arduino': 'cpp', 'cuda': 'cpp',
    'c#': 'csharp', 'csharp': 'csharp',
    'go': 'go', 'rust': 'rust', 'ruby': 'ruby', 'php': 'php',
    'swift': 'swift', 'kotlin': 'kotlin', 'dart': 'dart', 'scala': 'scala',
    'r': 'r', 'perl': 'perl', 'lua': 'lua', 'julia': 'julia', 'haskell': 'plaintext',
    'html': 'html', 'html5': 'html', 'css': 'css', 'css3': 'css',
    'scss': 'scss', 'less': 'less', 'json': 'json', 'yaml': 'yaml', 'toml': 'ini', 'ini': 'ini',
    'xml': 'xml', 'markdown': 'markdown', 'md': 'markdown',
    'sql': 'sql', 'mysql': 'sql', 'postgresql': 'pgsql', 'pgsql': 'pgsql',
    'bash': 'shell', 'shell': 'shell', 'sh': 'shell', 'zsh': 'shell', 'shell script': 'shell',
    'powershell': 'powershell',
    'dockerfile': 'dockerfile', 'makefile': 'plaintext',
    'solidity': 'sol', 'graphql': 'graphql', 'vb.net': 'vb', 'vba': 'vb',
    'objective-c': 'objective-c',
    'clojure': 'clojure', 'coffeescript': 'coffeescript',
    'f#': 'fsharp', 'fsharp': 'fsharp',
    'pascal': 'pascal', 'fortran': 'plaintext', 'cobol': 'plaintext', 'assembly x86': 'plaintext',
    'protocol buffers (proto)': 'proto', 'proto': 'proto',
    'razor': 'razor', 'handlebars': 'handlebars', 'pug': 'pug', 'twig': 'twig',
    'wgsl': 'wgsl', 'hcl': 'hcl',
  };
  return map[l] || (l as any);
}

export interface MonacoNotepadHandle {
  getEditor(): MonacoNS.editor.IStandaloneCodeEditor | null;
  getMonaco(): Monaco | null;
}

export interface NotepadFinding {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  type: string;
  suggestion?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLines?: number;
  language?: string;
  height?: number | string;
  headerLabel?: string;
  onMount?: (editor: MonacoNS.editor.IStandaloneCodeEditor, monaco: Monaco) => void;
  onCursorChange?: (pos: { line: number; column: number }) => void;
  className?: string;
  /** Optional live findings to render below the editor as a rule-explanation panel. */
  findings?: NotepadFinding[];
  diagnosticsPending?: boolean;
  diagnosticsTimeMs?: number;
  /** Called when the user clicks a finding row (e.g. jump to line). */
  onFindingClick?: (f: NotepadFinding) => void;
}

const MonacoNotepad = forwardRef<MonacoNotepadHandle, Props>(function MonacoNotepad(
  { value, onChange, placeholder, maxLines = 300000, language, height = 400, headerLabel = 'Monaco Code Editor', onMount, onCursorChange, className, findings, diagnosticsPending, diagnosticsTimeMs, onFindingClick },
  ref,
) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [fontSize, setFontSize] = useState<number>(() => {
    const v = Number(localStorage.getItem('notepad.fontSize'));
    return v >= 10 && v <= 28 ? v : 14;
  });
  const [fontFamily, setFontFamily] = useState<string>(() => localStorage.getItem('notepad.fontFamily') || FONT_FAMILIES[0].value);
  const [pdfPageSize, setPdfPageSize] = useState<'a4' | 'letter' | 'legal'>((localStorage.getItem('pdf.pageSize') as any) || 'a4');
  const [pdfFontScale, setPdfFontScale] = useState<number>(() => {
    const v = Number(localStorage.getItem('pdf.fontScale'));
    return v >= 6 && v <= 16 ? v : 9;
  });
  const [pdfLineNumbers, setPdfLineNumbers] = useState<boolean>(localStorage.getItem('pdf.lineNumbers') !== '0');
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('notepad.theme') as any) || 'dark');
  const editorRef = useRef<MonacoNS.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const { toast } = useToast();

  useEffect(() => { localStorage.setItem('notepad.fontSize', String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem('notepad.fontFamily', fontFamily); }, [fontFamily]);
  useEffect(() => { localStorage.setItem('pdf.pageSize', pdfPageSize); }, [pdfPageSize]);
  useEffect(() => { localStorage.setItem('pdf.fontScale', String(pdfFontScale)); }, [pdfFontScale]);
  useEffect(() => { localStorage.setItem('pdf.lineNumbers', pdfLineNumbers ? '1' : '0'); }, [pdfLineNumbers]);
  useEffect(() => { localStorage.setItem('notepad.theme', theme); }, [theme]);

  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
    getMonaco: () => monacoRef.current,
  }));

  const lineCount = value.split('\n').length;

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((e) => {
      const p = { line: e.position.lineNumber, column: e.position.column };
      setCursor(p);
      onCursorChange?.(p);
    });
    onMount?.(editor, monaco);
  }, [onCursorChange, onMount]);

  const handleChange = useCallback((v: string | undefined) => {
    const next = v ?? '';
    const ln = next.split('\n').length;
    if (ln > maxLines) {
      toast({ title: 'Line limit reached', description: `Maximum ${maxLines.toLocaleString()} lines allowed`, variant: 'destructive' });
      return;
    }
    onChange(next);
  }, [maxLines, onChange, toast]);

  const copyToClipboard = async () => {
    try { await navigator.clipboard.writeText(value); toast({ title: 'Copied!', description: 'Code copied to clipboard' }); }
    catch { toast({ title: 'Copy failed', variant: 'destructive' }); }
  };

  const clearEditor = () => { onChange(''); toast({ title: 'Cleared', description: 'Editor content cleared' }); };

  const downloadPDF = () => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: pdfPageSize });
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36;
      const lh = Math.round(pdfFontScale * 1.35);
      doc.setFont('courier', 'normal');
      doc.setFontSize(pdfFontScale);
      let y = margin;
      value.split('\n').forEach((ln, idx) => {
        const prefix = pdfLineNumbers ? (String(idx + 1).padStart(4, ' ') + ' | ') : '';
        const wrapped = doc.splitTextToSize(prefix + (ln || ' '), pageWidth - margin * 2);
        wrapped.forEach((w: string) => {
          if (y > pageHeight - margin) { doc.addPage(); y = margin; }
          doc.text(w, margin, y);
          y += lh;
        });
      });
      doc.save(`code-${Date.now()}.pdf`);
      toast({ title: '📄 Downloaded', description: 'Code saved as PDF' });
    } catch {
      toast({ title: 'PDF failed', variant: 'destructive' });
    }
  };

  if (isMinimized) {
    return (
      <div className="border border-border rounded-lg p-3 bg-card flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Code Editor ({lineCount.toLocaleString()} lines)</span>
        <Button variant="ghost" size="sm" onClick={() => setIsMinimized(false)} className="gap-1">
          <Maximize2 className="w-4 h-4" /> Expand
        </Button>
      </div>
    );
  }

  const dark = theme === 'dark';
  const monacoLang = toMonacoLang(language);

  // Memoize Monaco options so identity is stable across keystrokes.
  // A new options object every render forces Monaco to re-apply options
  // per keystroke, which causes the "typing feels laggy / keys drop" bug.
  const editorOptions = useMemo<MonacoNS.editor.IStandaloneEditorConstructionOptions>(() => ({
    fontSize,
    fontFamily,
    fontLigatures: true,
    minimap: { enabled: true },
    automaticLayout: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    wordWrap: 'off',
    tabSize: 4,
    insertSpaces: true,
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    padding: { top: 8, bottom: 8 },
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
  }), [fontSize, fontFamily]);

  const errCount = findings?.filter(f => f.severity === 'error').length || 0;
  const warnCount = findings?.filter(f => f.severity === 'warning').length || 0;

  const jumpToFinding = (f: NotepadFinding) => {
    const editor = editorRef.current;
    if (editor) {
      editor.revealLineInCenter(f.line);
      editor.setPosition({ lineNumber: f.line, column: Math.max(1, f.column) });
      editor.focus();
    }
    onFindingClick?.(f);
  };

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${dark ? 'bg-[#1e1e1e]' : 'bg-white'} ${className || ''}`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b border-border/50 ${dark ? 'bg-[#2d2d2d]' : 'bg-[#f3f3f3]'}`}>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${dark ? 'text-gray-400' : 'text-gray-700'}`}>{headerLabel}</span>
          <span className="text-xs text-gray-500">|</span>
          <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-500'}`}>Lines: {lineCount.toLocaleString()} / {maxLines.toLocaleString()}</span>
          <span className="text-xs text-gray-500">|</span>
          <span className="text-xs text-cyan-500">Monaco · {monacoLang}</span>
          {diagnosticsPending ? (
            <span className="text-xs text-amber-400 animate-pulse">Analyzing…</span>
          ) : typeof diagnosticsTimeMs === 'number' && diagnosticsTimeMs > 0 ? (
            <span className="text-xs text-emerald-500">Diagnostics {diagnosticsTimeMs.toFixed(1)}ms</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={dark ? 'Switch to light background' : 'Switch to dark background'}
            className={`h-7 px-2 ${dark ? 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]' : 'text-gray-700 hover:bg-gray-200'}`}>
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" title="Text size & font"
                className={`h-7 px-2 ${dark ? 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]' : 'text-gray-700 hover:bg-gray-200'}`}>
                <Type className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3" align="end">
              <div>
                <div className="text-xs mb-1 flex justify-between"><span>Font size</span><span className="text-muted-foreground">{fontSize}px</span></div>
                <Slider min={10} max={28} step={1} value={[fontSize]} onValueChange={(v) => setFontSize(v[0])} />
              </div>
              <div>
                <div className="text-xs mb-1">Font family</div>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs">
                  {FONT_FAMILIES.map(f => (<option key={f.label} value={f.value}>{f.label}</option>))}
                </select>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={copyToClipboard}
            className={`h-7 px-2 ${dark ? 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]' : 'text-gray-700 hover:bg-gray-200'}`}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={downloadPDF} title="Download as PDF"
              className={`h-7 px-2 ${dark ? 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]' : 'text-gray-700 hover:bg-gray-200'}`}>
              <FileDown className="w-3.5 h-3.5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" title="PDF settings"
                  className={`h-7 px-1 ${dark ? 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]' : 'text-gray-700 hover:bg-gray-200'}`}>
                  <Settings2 className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3" align="end">
                <div className="text-xs font-semibold">PDF Settings</div>
                <div>
                  <div className="text-xs mb-1">Page size</div>
                  <select value={pdfPageSize} onChange={(e) => setPdfPageSize(e.target.value as any)}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs">
                    <option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs mb-1 flex justify-between"><span>Font scale</span><span className="text-muted-foreground">{pdfFontScale}pt</span></div>
                  <Slider min={6} max={16} step={1} value={[pdfFontScale]} onValueChange={(v) => setPdfFontScale(v[0])} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Include line numbers</span>
                  <Switch checked={pdfLineNumbers} onCheckedChange={setPdfLineNumbers} />
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button variant="ghost" size="sm" onClick={clearEditor}
            className={`h-7 px-2 ${dark ? 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]' : 'text-gray-700 hover:bg-gray-200'}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)}
            className={`h-7 px-2 ${dark ? 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]' : 'text-gray-700 hover:bg-gray-200'}`}>
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        <Editor
          height="100%"
          language={monacoLang}
          value={value}
          theme={dark ? 'vs-dark' : 'vs'}
          onChange={handleChange}
          onMount={handleMount}
          options={editorOptions}
        />
        {!value && placeholder && (
          <div
            className={`pointer-events-none absolute top-2 select-none whitespace-pre-wrap ${dark ? 'text-gray-500' : 'text-gray-400'}`}
            style={{ left: 68, fontFamily, fontSize: `${fontSize}px`, lineHeight: 1.5, opacity: 0.7 }}
          >
            {placeholder}
          </div>
        )}
      </div>

      {findings && findings.length > 0 && (
        <div className={`border-t border-border/60 ${dark ? 'bg-[#161616]' : 'bg-[#f8f8f8]'}`}>
          <button
            type="button"
            onClick={() => setPanelOpen(o => !o)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${dark ? 'text-gray-200 hover:bg-[#222]' : 'text-gray-700 hover:bg-gray-200'}`}
          >
            {panelOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>Rule-based diagnostics</span>
            {errCount > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 text-red-400"><AlertCircle className="w-3 h-3" />{errCount}</span>
            )}
            {warnCount > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 text-amber-400"><AlertTriangle className="w-3 h-3" />{warnCount}</span>
            )}
            <span className="ml-auto text-[10px] uppercase tracking-wide opacity-60">click a rule to jump</span>
          </button>
          {panelOpen && (
            <div className="max-h-40 overflow-y-auto px-2 pb-2 space-y-1">
              {findings.slice(0, 100).map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => jumpToFinding(f)}
                  className={`w-full text-left flex items-start gap-2 px-2 py-1 rounded text-xs font-mono ${dark ? 'hover:bg-[#252525]' : 'hover:bg-gray-200'} ${f.severity === 'error' ? 'text-red-300' : 'text-amber-300'}`}
                >
                  {f.severity === 'error' ? <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                  <span className="shrink-0 opacity-70">Ln {f.line}:{f.column}</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${dark ? 'bg-[#2d2d2d] text-cyan-300' : 'bg-gray-200 text-blue-700'}`}>{f.type}</span>
                  <span className={dark ? 'text-gray-200' : 'text-gray-800'}>
                    {f.message}
                    {f.suggestion ? <span className="text-emerald-400"> — 💡 {f.suggestion}</span> : null}
                  </span>
                </button>
              ))}
              {findings.length > 100 && (
                <div className="px-2 py-1 text-[10px] opacity-60">…{findings.length - 100} more findings hidden</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1.5 bg-[#007acc] text-white text-xs">
        <div className="flex items-center gap-4">
          <span>Ln {cursor.line}, Col {cursor.column}</span>
          <span>|</span>
          <span>{lineCount.toLocaleString()} lines</span>
          <span>|</span>
          <span>{value.length.toLocaleString()} characters</span>
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>Tab Size: 4</span>
          <span className="bg-white/20 px-2 py-0.5 rounded">Monaco</span>
        </div>
      </div>
    </div>
  );
});

export default MonacoNotepad;