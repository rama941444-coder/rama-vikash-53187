import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface EnhancedCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const EnhancedCodeEditor = ({ 
  value, 
  onChange, 
  placeholder = "Paste or type your code here...",
  className,
  minHeight = "400px"
}: EnhancedCodeEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);
  const [currentLine, setCurrentLine] = useState(1);
  const [currentColumn, setCurrentColumn] = useState(1);

  // Calculate line numbers
  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(Math.max(lines, 20)); // Minimum 20 lines shown
  }, [value]);

  // Sync scroll between line numbers and textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Handle cursor position
  const handleSelect = useCallback(() => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);
      const lines = textBeforeCursor.split('\n');
      setCurrentLine(lines.length);
      setCurrentColumn(lines[lines.length - 1].length + 1);
    }
  }, [value]);

  // Handle tab key
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart || 0;
      const end = textareaRef.current?.selectionEnd || 0;
      
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      
      // Move cursor after tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
    
    // Auto-close brackets and quotes
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'",
      '`': '`'
    };
    
    if (pairs[e.key]) {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart || 0;
      const end = textareaRef.current?.selectionEnd || 0;
      const selectedText = value.substring(start, end);
      
      const newValue = value.substring(0, start) + e.key + selectedText + pairs[e.key] + value.substring(end);
      onChange(newValue);
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1;
        }
      }, 0);
    }
  }, [value, onChange]);

  // Generate line numbers
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className={cn("relative rounded-xl border-2 border-primary/30 bg-card overflow-hidden", className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-muted-foreground ml-2">Code Editor</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Ln {currentLine}, Col {currentColumn}
        </div>
      </div>
      
      {/* Editor area */}
      <div className="flex" style={{ minHeight }}>
        {/* Line numbers */}
        <div 
          ref={lineNumbersRef}
          className="flex-shrink-0 w-12 bg-secondary/30 text-muted-foreground text-right text-sm font-mono py-3 overflow-hidden select-none"
          style={{ minHeight }}
        >
          {lineNumbers.map(num => (
            <div 
              key={num} 
              className={cn(
                "px-2 leading-6",
                num === currentLine && "text-primary font-semibold bg-primary/10"
              )}
            >
              {num}
            </div>
          ))}
        </div>
        
        {/* Code textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onSelect={handleSelect}
          onClick={handleSelect}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "flex-1 resize-none bg-transparent text-foreground font-mono text-sm p-3 leading-6",
            "focus:outline-none focus:ring-0 border-0",
            "placeholder:text-muted-foreground/50"
          )}
          style={{ minHeight }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      </div>
      
      {/* Footer bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-secondary/30 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{value.length} characters</span>
          <span>{value.split('\n').length} lines</span>
          <span>{value.split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <div className="flex items-center gap-2">
          <span>UTF-8</span>
          <span>•</span>
          <span>Tab Size: 2</span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedCodeEditor;
