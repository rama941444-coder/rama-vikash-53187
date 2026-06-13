import { useState, useRef, useEffect, useCallback } from 'react';
import { Maximize2, Minimize2, Copy, Trash2, FileDown, Type, Settings2, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { HighlightedOverlay } from '@/lib/syntaxHighlight';

const FONT_FAMILIES = [
  { label: 'Consolas', value: 'Consolas, Monaco, "Courier New", monospace' },
  { label: 'Fira Code', value: '"Fira Code", Consolas, monospace' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, monospace' },
  { label: 'Monaco', value: 'Monaco, Consolas, monospace' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

interface EnhancedCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLines?: number;
  language?: string;
}

const EnhancedCodeEditor = ({ 
  value, 
  onChange, 
  placeholder = "// Start typing your code here...\n// This editor supports up to 300,000 lines",
  maxLines = 300000,
  language,
}: EnhancedCodeEditorProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [fontSize, setFontSize] = useState<number>(() => {
    const v = Number(localStorage.getItem('notepad.fontSize'));
    return v >= 10 && v <= 28 ? v : 14;
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    return localStorage.getItem('notepad.fontFamily') || FONT_FAMILIES[0].value;
  });
  // PDF settings
  const [pdfPageSize, setPdfPageSize] = useState<'a4' | 'letter' | 'legal'>(
    (localStorage.getItem('pdf.pageSize') as 'a4' | 'letter' | 'legal') || 'a4'
  );
  const [pdfFontScale, setPdfFontScale] = useState<number>(() => {
    const v = Number(localStorage.getItem('pdf.fontScale'));
    return v >= 6 && v <= 16 ? v : 9;
  });
  const [pdfLineNumbers, setPdfLineNumbers] = useState<boolean>(
    localStorage.getItem('pdf.lineNumbers') !== '0'
  );
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('notepad.theme') as 'dark' | 'light') || 'dark'
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLPreElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem('notepad.fontSize', String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem('notepad.fontFamily', fontFamily);
  }, [fontFamily]);
  useEffect(() => { localStorage.setItem('pdf.pageSize', pdfPageSize); }, [pdfPageSize]);
  useEffect(() => { localStorage.setItem('pdf.fontScale', String(pdfFontScale)); }, [pdfFontScale]);
  useEffect(() => { localStorage.setItem('pdf.lineNumbers', pdfLineNumbers ? '1' : '0'); }, [pdfLineNumbers]);
  useEffect(() => { localStorage.setItem('notepad.theme', theme); }, [theme]);

  const lineHeightPx = Math.round(fontSize * 1.5);

  // Calculate line numbers
  const lines = value.split('\n');
  const lineCount = lines.length;

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Update cursor position
  const updateCursorPosition = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorIndex = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorIndex);
    const linesBeforeCursor = textBeforeCursor.split('\n');
    const currentLine = linesBeforeCursor.length;
    const currentColumn = linesBeforeCursor[linesBeforeCursor.length - 1].length + 1;
    
    setCursorPosition({ line: currentLine, column: currentColumn });
  }, [value]);

  // Handle text change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newLineCount = newValue.split('\n').length;
    
    if (newLineCount > maxLines) {
      toast({
        title: "Line limit reached",
        description: `Maximum ${maxLines.toLocaleString()} lines allowed`,
        variant: "destructive",
      });
      return;
    }
    
    onChange(newValue);
  };

  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = '    '; // 4 spaces for tab

      if (e.shiftKey) {
        // Remove indentation
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineText = value.substring(lineStart, start);
        if (lineText.startsWith(spaces)) {
          const newValue = value.substring(0, lineStart) + 
                          value.substring(lineStart + spaces.length);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start - spaces.length;
          }, 0);
        }
      } else {
        // Add indentation
        const newValue = value.substring(0, start) + spaces + value.substring(end);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
        }, 0);
      }
    }

    // Auto-close brackets and quotes
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'",
      '`': '`',
    };

    if (pairs[e.key]) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);
      
      const newValue = value.substring(0, start) + 
                      e.key + selectedText + pairs[e.key] + 
                      value.substring(end);
      onChange(newValue);
      
      setTimeout(() => {
        if (selectedText) {
          textarea.selectionStart = start + 1;
          textarea.selectionEnd = start + 1 + selectedText.length;
        } else {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        }
      }, 0);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Clear editor
  const clearEditor = () => {
    onChange('');
    toast({ title: "Cleared", description: "Editor content cleared" });
  };

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
      const codeLines = value.split('\n');
      codeLines.forEach((ln, idx) => {
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
    } catch (e) {
      toast({ title: 'PDF failed', description: 'Could not generate PDF', variant: 'destructive' });
    }
  };


  useEffect(() => {
    updateCursorPosition();
  }, [value, updateCursorPosition]);

  // Generate line numbers
  const lineNumbers = Array.from({ length: Math.max(lineCount, 20) }, (_, i) => i + 1);

  if (isMinimized) {
    return (
      <div className="border border-border rounded-lg p-3 bg-card flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Code Editor ({lineCount.toLocaleString()} lines)
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMinimized(false)}
          className="gap-1"
        >
          <Maximize2 className="w-4 h-4" />
          Expand
        </Button>
      </div>
    );
  }

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${theme === 'light' ? 'bg-white' : 'bg-[#1e1e1e]'}`}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-border/50 ${theme === 'light' ? 'bg-[#f3f3f3]' : 'bg-[#2d2d2d]'}`}>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-400'}`}>
            Notepad-Style Code Editor
          </span>
          <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
            |
          </span>
          <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
            Lines: {lineCount.toLocaleString()} / {maxLines.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to light background' : 'Switch to dark background'}
            className={`h-7 px-2 ${theme === 'light' ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]'}`}>
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" title="Text size & font"
                className={`h-7 px-2 ${theme === 'light' ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]'}`}>
                <Type className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3" align="end">
              <div>
                <div className="text-xs mb-1 flex justify-between">
                  <span>Font size</span><span className="text-muted-foreground">{fontSize}px</span>
                </div>
                <Slider min={10} max={28} step={1} value={[fontSize]}
                  onValueChange={(v) => setFontSize(v[0])} />
              </div>
              <div>
                <div className="text-xs mb-1">Font family</div>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
                >
                  {FONT_FAMILIES.map(f => (
                    <option key={f.label} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={copyToClipboard}
            className={`h-7 px-2 ${theme === 'light' ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]'}`}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={downloadPDF}
              className={`h-7 px-2 ${theme === 'light' ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]'}`} title="Download as PDF">
              <FileDown className="w-3.5 h-3.5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" title="PDF settings"
                  className={`h-7 px-1 ${theme === 'light' ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]'}`}>
                  <Settings2 className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3" align="end">
                <div className="text-xs font-semibold">PDF Settings</div>
                <div>
                  <div className="text-xs mb-1">Page size</div>
                  <select value={pdfPageSize}
                    onChange={(e) => setPdfPageSize(e.target.value as 'a4' | 'letter' | 'legal')}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs">
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                    <option value="legal">Legal</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs mb-1 flex justify-between">
                    <span>Font scale</span><span className="text-muted-foreground">{pdfFontScale}pt</span>
                  </div>
                  <Slider min={6} max={16} step={1} value={[pdfFontScale]}
                    onValueChange={(v) => setPdfFontScale(v[0])} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Include line numbers</span>
                  <Switch checked={pdfLineNumbers} onCheckedChange={setPdfLineNumbers} />
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button variant="ghost" size="sm" onClick={clearEditor}
            className={`h-7 px-2 ${theme === 'light' ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]'}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)}
            className={`h-7 px-2 ${theme === 'light' ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]'}`}>
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex relative" style={{ height: '400px' }}>
        {/* Line Numbers */}
        <div 
          ref={lineNumbersRef}
          className={`text-right py-2 overflow-hidden select-none border-r ${theme === 'light' ? 'bg-[#f8f8f8] text-gray-500 border-[#e5e5e5]' : 'bg-[#252526] text-gray-500 border-[#3d3d3d]'}`}
          style={{ 
            minWidth: '60px',
            fontFamily,
            fontSize: `${fontSize}px`,
            lineHeight: '1.5',
          }}
        >
          {lineNumbers.map(num => (
            <div 
              key={num} 
              className={`px-3 ${num === cursorPosition.line ? (theme === 'light' ? 'text-black bg-[#e8f0fe]' : 'text-white bg-[#264f78]') : ''}`}
              style={{ height: `${lineHeightPx}px` }}
            >
              {num}
            </div>
          ))}
        </div>

        {/* Highlight overlay + Text Area */}
        <div className={`flex-1 relative ${theme === 'light' ? 'bg-white' : 'bg-[#1e1e1e]'}`} style={{ minWidth: 0 }}>
          <HighlightedOverlay
            ref={overlayRef}
            code={value}
            language={language}
            fontFamily={fontFamily}
            fontSize={fontSize}
            lineHeight={1.5}
            padding="8px"
            theme={theme}
          />
          <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          placeholder={placeholder}
          className={`absolute inset-0 w-full h-full bg-transparent text-transparent p-2 resize-none outline-none overflow-auto placeholder:text-gray-500 ${theme === 'light' ? 'caret-black' : 'caret-white'}`}
          style={{ 
            fontFamily,
            fontSize: `${fontSize}px`,
            lineHeight: '1.5',
            tabSize: 4,
            whiteSpace: 'pre',
            overflowWrap: 'normal',
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#007acc] text-white text-xs">
        <div className="flex items-center gap-4">
          <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
          <span>|</span>
          <span>{lineCount.toLocaleString()} lines</span>
          <span>|</span>
          <span>{value.length.toLocaleString()} characters</span>
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>Tab Size: 4</span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedCodeEditor;
