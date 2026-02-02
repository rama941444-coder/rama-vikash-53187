import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, AlertCircle, CheckCircle, Copy, Trash2, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LanguageSelector from '@/components/LanguageSelector';
import { supabase } from '@/integrations/supabase/client';

interface LiveCodeIDEProps {
  onAnalysisComplete: (data: any) => void;
}

interface CodeError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

const LiveCodeIDE = ({ onAnalysisComplete }: LiveCodeIDEProps) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('Auto-Detect');
  const [errors, setErrors] = useState<CodeError[]>([]);
  const [correctedCode, setCorrectedCode] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const lines = code.split('\n');
  const lineCount = lines.length;
  const maxLines = 500000;

  // Live error detection with debounce (0.005 sec = 5ms, but we use 50ms for practicality)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (code.trim()) {
      debounceRef.current = setTimeout(() => {
        detectErrors(code);
      }, 50); // Fast detection
    } else {
      setErrors([]);
      setCorrectedCode('');
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, language]);

  const detectErrors = useCallback(async (codeText: string) => {
    // Basic syntax error detection patterns
    const detectedErrors: CodeError[] = [];
    const codeLines = codeText.split('\n');

    codeLines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check for common syntax errors
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        detectedErrors.push({
          line: lineNum,
          column: line.indexOf('(') + 1 || line.indexOf(')') + 1,
          message: 'Mismatched parentheses',
          severity: 'error'
        });
      }

      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        detectedErrors.push({
          line: lineNum,
          column: line.indexOf('[') + 1 || line.indexOf(']') + 1,
          message: 'Mismatched brackets',
          severity: 'error'
        });
      }

      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        detectedErrors.push({
          line: lineNum,
          column: line.indexOf('{') + 1 || line.indexOf('}') + 1,
          message: 'Mismatched braces',
          severity: 'error'
        });
      }

      // Check for unclosed strings
      const singleQuotes = (line.match(/'/g) || []).length;
      const doubleQuotes = (line.match(/"/g) || []).length;
      if (singleQuotes % 2 !== 0) {
        detectedErrors.push({
          line: lineNum,
          column: line.indexOf("'") + 1,
          message: 'Unclosed string literal (single quote)',
          severity: 'error'
        });
      }
      if (doubleQuotes % 2 !== 0) {
        detectedErrors.push({
          line: lineNum,
          column: line.indexOf('"') + 1,
          message: 'Unclosed string literal (double quote)',
          severity: 'error'
        });
      }

      // Check for common typos
      if (/\bfuntcion\b/i.test(line)) {
        detectedErrors.push({
          line: lineNum,
          column: line.search(/\bfuntcion\b/i) + 1,
          message: 'Typo: "funtcion" should be "function"',
          severity: 'error'
        });
      }

      if (/\bretrun\b/i.test(line)) {
        detectedErrors.push({
          line: lineNum,
          column: line.search(/\bretrun\b/i) + 1,
          message: 'Typo: "retrun" should be "return"',
          severity: 'error'
        });
      }

      // Check for missing semicolons (for C-style languages)
      if (['JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#'].includes(language)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && 
            !trimmed.endsWith('}') && !trimmed.endsWith(':') && 
            !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
            !trimmed.startsWith('*') && !trimmed.startsWith('if') &&
            !trimmed.startsWith('else') && !trimmed.startsWith('for') &&
            !trimmed.startsWith('while') && !trimmed.startsWith('function') &&
            !trimmed.startsWith('class') && !trimmed.startsWith('import') &&
            !trimmed.startsWith('export') && !trimmed.startsWith('const') &&
            !trimmed.startsWith('let') && !trimmed.startsWith('var') &&
            trimmed.length > 0 && !trimmed.endsWith(',')) {
          // This is just a warning
          detectedErrors.push({
            line: lineNum,
            column: line.length,
            message: 'Possible missing semicolon',
            severity: 'warning'
          });
        }
      }
    });

    setErrors(detectedErrors);

    // Generate corrected code if there are errors
    if (detectedErrors.length > 0) {
      let corrected = codeText;
      // Basic auto-corrections
      corrected = corrected.replace(/\bfuntcion\b/gi, 'function');
      corrected = corrected.replace(/\bretrun\b/gi, 'return');
      setCorrectedCode(corrected);
    } else {
      setCorrectedCode('');
    }
  }, [language]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const updateCursorPosition = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorIndex = textarea.selectionStart;
    const textBeforeCursor = code.substring(0, cursorIndex);
    const linesBeforeCursor = textBeforeCursor.split('\n');
    const currentLine = linesBeforeCursor.length;
    const currentColumn = linesBeforeCursor[linesBeforeCursor.length - 1].length + 1;
    
    setCursorPosition({ line: currentLine, column: currentColumn });
  }, [code]);

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
    
    setCode(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = '    ';

      if (e.shiftKey) {
        const lineStart = code.lastIndexOf('\n', start - 1) + 1;
        const lineText = code.substring(lineStart, start);
        if (lineText.startsWith(spaces)) {
          const newValue = code.substring(0, lineStart) + code.substring(lineStart + spaces.length);
          setCode(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start - spaces.length;
          }, 0);
        }
      } else {
        const newValue = code.substring(0, start) + spaces + code.substring(end);
        setCode(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
        }, 0);
      }
    }

    // Auto-close brackets
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
      const selectedText = code.substring(start, end);
      
      const newValue = code.substring(0, start) + 
                      e.key + selectedText + pairs[e.key] + 
                      code.substring(end);
      setCode(newValue);
      
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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Copied!", description: "Code copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const clearEditor = () => {
    setCode('');
    setErrors([]);
    setCorrectedCode('');
    toast({ title: "Cleared", description: "Editor content cleared" });
  };

  const applyCorrectedCode = () => {
    if (correctedCode) {
      setCode(correctedCode);
      setCorrectedCode('');
      setErrors([]);
      toast({ title: "Applied", description: "Corrected code applied" });
    }
  };

  const runAnalysis = async () => {
    if (!code.trim()) {
      toast({
        title: "No code",
        description: "Please enter some code to analyze",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-code', {
        body: {
          code: code,
          language,
          files: [],
          fileData: []
        }
      });

      if (data) {
        if (data.error === 'RATE_LIMIT_EXCEEDED') {
          toast({
            title: "⚠️ Rate Limit",
            description: "Too many requests. Please wait.",
            variant: "destructive",
          });
        } else if (data.error === 'PAYMENT_REQUIRED') {
          toast({
            title: "⚠️ Credits Required",
            description: "Add credits to enable AI analysis.",
            variant: "destructive",
          });
        } else if (data.error) {
          toast({
            title: "⚠️ Error",
            description: "Analysis error occurred.",
            variant: "destructive",
          });
        } else {
          onAnalysisComplete(data);
          toast({
            title: "✅ Analysis Complete!",
            description: "Results are ready.",
          });
        }
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "❌ Failed",
        description: error.message || "Network error.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    updateCursorPosition();
  }, [code, updateCursorPosition]);

  const lineNumbers = Array.from({ length: Math.max(lineCount, 30) }, (_, i) => i + 1);

  const getLineClass = (lineNum: number) => {
    const lineError = errors.find(e => e.line === lineNum && e.severity === 'error');
    const lineWarning = errors.find(e => e.line === lineNum && e.severity === 'warning');
    if (lineError) return 'bg-red-500/20 border-l-2 border-red-500';
    if (lineWarning) return 'bg-yellow-500/20 border-l-2 border-yellow-500';
    return '';
  };

  if (isMinimized) {
    return (
      <div className="border border-border rounded-lg p-3 bg-card flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Live Code IDE ({lineCount.toLocaleString()} lines, {errors.length} errors)
        </span>
        <Button variant="ghost" size="sm" onClick={() => setIsMinimized(false)} className="gap-1">
          <Maximize2 className="w-4 h-4" />
          Expand
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">Language (1600+ supported)</label>
          <LanguageSelector 
            value={language} 
            onChange={setLanguage}
            placeholder="Auto-Detect"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">Run Analysis</label>
          <Button 
            onClick={runAnalysis} 
            disabled={isAnalyzing}
            className="w-full gap-2 neon-glow"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run & Analyze
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="border border-border rounded-lg overflow-hidden bg-[#1e1e1e]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-400">Live Code IDE</span>
            <span className="text-xs text-gray-500">|</span>
            <span className="text-xs text-gray-500">
              Lines: {lineCount.toLocaleString()} / {maxLines.toLocaleString()}
            </span>
            {errors.length > 0 && (
              <>
                <span className="text-xs text-gray-500">|</span>
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.filter(e => e.severity === 'error').length} errors
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 px-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d]">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={clearEditor} className="h-7 px-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d]">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)} className="h-7 px-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d]">
              <Minimize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex relative" style={{ height: '400px' }}>
          {/* Line Numbers */}
          <div 
            ref={lineNumbersRef}
            className="bg-[#252526] text-gray-500 text-right py-2 overflow-hidden select-none border-r border-[#3d3d3d]"
            style={{ 
              minWidth: '60px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '14px',
              lineHeight: '1.5',
            }}
          >
            {lineNumbers.map(num => (
              <div 
                key={num} 
                className={`px-3 ${num === cursorPosition.line ? 'text-white bg-[#264f78]' : ''} ${getLineClass(num)}`}
                style={{ height: '21px' }}
              >
                {num}
              </div>
            ))}
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            onClick={updateCursorPosition}
            onKeyUp={updateCursorPosition}
            placeholder={"// Start typing your code here...\n// Live error detection enabled\n// Supports up to 500,000 lines\n// Tab for indent, auto-closes brackets"}
            className="flex-1 bg-[#1e1e1e] text-[#d4d4d4] p-2 resize-none outline-none overflow-auto"
            style={{ 
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '14px',
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

        {/* Status Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#007acc] text-white text-xs">
          <div className="flex items-center gap-4">
            <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            <span>|</span>
            <span>{lineCount.toLocaleString()} lines</span>
            <span>|</span>
            <span>{code.length.toLocaleString()} chars</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{language}</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>

      {/* Console Output */}
      <div className="space-y-4">
        {/* Error Console */}
        {errors.length > 0 && (
          <div className="bg-[#1e1e1e] border border-red-500/50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-red-500/20 border-b border-red-500/50">
              <span className="text-sm font-medium text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Console - Errors ({errors.length})
              </span>
            </div>
            <div className="p-4 max-h-[200px] overflow-y-auto">
              {errors.map((error, index) => (
                <div key={index} className={`text-sm mb-2 ${error.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                  <span className="text-gray-500">Line {error.line}:{error.column}</span>
                  <span className="mx-2">-</span>
                  <span>{error.severity === 'error' ? '❌' : '⚠️'} {error.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Corrected Code Console */}
        {correctedCode && (
          <div className="bg-[#1e1e1e] border border-green-500/50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-green-500/20 border-b border-green-500/50">
              <span className="text-sm font-medium text-green-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Corrected Code
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={applyCorrectedCode}
                className="h-7 px-3 text-green-400 hover:text-white hover:bg-green-500/20"
              >
                Apply Fix
              </Button>
            </div>
            <div className="p-4 max-h-[200px] overflow-y-auto">
              <pre className="text-sm text-green-300 font-mono whitespace-pre-wrap">{correctedCode}</pre>
            </div>
          </div>
        )}

        {/* No Errors Message */}
        {code.trim() && errors.length === 0 && (
          <div className="bg-[#1e1e1e] border border-green-500/50 rounded-lg p-4">
            <span className="text-sm font-medium text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              No syntax errors detected
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCodeIDE;
