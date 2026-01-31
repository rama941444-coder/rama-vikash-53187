import { useState, useRef, useEffect, useCallback } from 'react';
import { Maximize2, Minimize2, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface EnhancedCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLines?: number;
}

const EnhancedCodeEditor = ({ 
  value, 
  onChange, 
  placeholder = "// Start typing your code here...\n// This editor supports up to 300,000 lines",
  maxLines = 300000 
}: EnhancedCodeEditorProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Calculate line numbers
  const lines = value.split('\n');
  const lineCount = lines.length;

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
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
    toast({
      title: "Cleared",
      description: "Editor content cleared",
    });
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
    <div className="border border-border rounded-lg overflow-hidden bg-[#1e1e1e]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border-b border-border/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400">
            Notepad-Style Code Editor
          </span>
          <span className="text-xs text-gray-500">
            |
          </span>
          <span className="text-xs text-gray-500">
            Lines: {lineCount.toLocaleString()} / {maxLines.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="h-7 px-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearEditor}
            className="h-7 px-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(true)}
            className="h-7 px-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
          >
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
              className={`px-3 ${num === cursorPosition.line ? 'text-white bg-[#264f78]' : ''}`}
              style={{ height: '21px' }}
            >
              {num}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          placeholder={placeholder}
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
