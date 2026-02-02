import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, AlertCircle, CheckCircle, Copy, Trash2, Maximize2, Minimize2, Loader2, Lightbulb, Zap, ArrowRight, Sparkles } from 'lucide-react';
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
  type: string;
  suggestion?: string;
}

interface CodeImprovement {
  title: string;
  original: string;
  improved: string;
  explanation: string;
  level: 'junior' | 'senior';
}

const LiveCodeIDE = ({ onAnalysisComplete }: LiveCodeIDEProps) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('Auto-Detect');
  const [errors, setErrors] = useState<CodeError[]>([]);
  const [correctedCode, setCorrectedCode] = useState('');
  const [improvements, setImprovements] = useState<CodeImprovement[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [detectionTime, setDetectionTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const lines = code.split('\n');
  const lineCount = lines.length;
  const maxLines = 500000;

  // Comprehensive error patterns for multiple languages
  const errorPatterns = {
    // JavaScript/TypeScript errors
    js: [
      { regex: /\bconst\s+(\w+)\s*=\s*$/, message: 'Assignment value expected', type: 'SyntaxError' },
      { regex: /\bfunction\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bif\s*$/, message: 'Condition expected after if', type: 'SyntaxError' },
      { regex: /\bfor\s*$/, message: 'Loop expression expected', type: 'SyntaxError' },
      { regex: /\bwhile\s*$/, message: 'Condition expected after while', type: 'SyntaxError' },
      { regex: /==\s*$/, message: 'Value expected after comparison', type: 'SyntaxError' },
      { regex: /\+\s*$/, message: 'Operand expected after operator', type: 'SyntaxError' },
      { regex: /=>\s*$/, message: 'Arrow function body expected', type: 'SyntaxError' },
      { regex: /\.\s*$/, message: 'Property or method expected after dot', type: 'SyntaxError' },
      { regex: /\basync\s+(?!function|(\(|\w))/, message: 'async must be followed by function or arrow function', type: 'SyntaxError' },
      { regex: /\bawait\s*$/, message: 'Expression expected after await', type: 'SyntaxError' },
      { regex: /\bconsole\.(?!log|error|warn|info|debug|table|trace|dir|clear|group|groupEnd|time|timeEnd)/, message: 'Unknown console method', type: 'TypeError' },
      { regex: /\bundefined\s*\(/, message: 'undefined is not a function', type: 'TypeError' },
      { regex: /\bnull\s*\./, message: 'Cannot read property of null', type: 'TypeError' },
    ],
    // Python errors
    python: [
      { regex: /\bdef\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bif\s*:\s*$/, message: 'Condition expected before colon', type: 'SyntaxError' },
      { regex: /\bfor\s+\w+\s*$/, message: '"in" keyword expected in for loop', type: 'SyntaxError' },
      { regex: /\bclass\s*$/, message: 'Class name expected', type: 'SyntaxError' },
      { regex: /\bimport\s*$/, message: 'Module name expected after import', type: 'SyntaxError' },
      { regex: /\bprint\s+[^(]/, message: 'print is a function in Python 3, use print()', type: 'SyntaxError' },
      { regex: /\breturn\s*$/, message: 'Return value expected (or remove return)', type: 'SyntaxError' },
      { regex: /\bexcept\s*$/, message: 'Exception type expected', type: 'SyntaxError' },
      { regex: /\:\s*\n\s*\n/, message: 'IndentationError: expected an indented block', type: 'IndentationError' },
    ],
    // Java errors
    java: [
      { regex: /\bpublic\s+class\s*$/, message: 'Class name expected', type: 'SyntaxError' },
      { regex: /\bpublic\s+static\s+void\s+main\s*\(\s*\)/, message: 'main method requires String[] args parameter', type: 'SyntaxError' },
      { regex: /\bSystem\.out\.print(?!ln|f)/, message: 'Did you mean System.out.println()?', type: 'SyntaxError' },
      { regex: /\bint\s+\w+\s*=\s*"/, message: 'Type mismatch: cannot assign String to int', type: 'TypeError' },
      { regex: /\bString\s+\w+\s*=\s*\d+\s*;/, message: 'Type mismatch: cannot assign int to String', type: 'TypeError' },
    ],
    // C/C++ errors
    cpp: [
      { regex: /#include\s*$/, message: 'Header file expected after #include', type: 'PreprocessorError' },
      { regex: /\bprintf\s*\(\s*"[^"]*"[^,)]/, message: 'Format specifier missing or malformed', type: 'SyntaxError' },
      { regex: /\bint\s+main\s*\(\s*\)\s*[^{]/, message: 'Opening brace expected for main function', type: 'SyntaxError' },
      { regex: /\bmalloc\s*\([^)]*\)\s*;/, message: 'malloc return value should be assigned', type: 'Warning' },
      { regex: /\bscanf\s*\(\s*"[^"]*",\s*\w+[^&]/, message: 'scanf requires address-of operator (&)', type: 'SyntaxError' },
    ],
    // HTML/CSS errors
    html: [
      { regex: /<\w+[^>]*[^/]>\s*$/, message: 'Closing tag may be missing', type: 'SyntaxError' },
      { regex: /<\/\w+[^>]*$/, message: 'Closing bracket > missing', type: 'SyntaxError' },
      { regex: /style\s*=\s*"[^"]*:[^"]*"[^;]/, message: 'CSS property may be missing semicolon', type: 'Warning' },
    ],
    // SQL errors
    sql: [
      { regex: /\bSELECT\s+\*\s+$/, message: 'FROM clause expected', type: 'SyntaxError' },
      { regex: /\bFROM\s+$/, message: 'Table name expected after FROM', type: 'SyntaxError' },
      { regex: /\bWHERE\s+$/, message: 'Condition expected after WHERE', type: 'SyntaxError' },
      { regex: /\bINSERT\s+INTO\s+\w+\s*$/, message: 'VALUES clause expected', type: 'SyntaxError' },
    ],
  };

  // Advanced live error detection
  const detectErrors = useCallback((codeText: string) => {
    const startTime = performance.now();
    setIsDetecting(true);
    
    const detectedErrors: CodeError[] = [];
    const codeLines = codeText.split('\n');
    
    // Determine language patterns to use
    let patterns = errorPatterns.js; // default
    const lang = language.toLowerCase();
    if (lang.includes('python')) patterns = errorPatterns.python;
    else if (lang.includes('java') && !lang.includes('javascript')) patterns = errorPatterns.java;
    else if (lang.includes('c++') || lang.includes('cpp') || lang === 'c') patterns = errorPatterns.cpp;
    else if (lang.includes('html') || lang.includes('css')) patterns = errorPatterns.html;
    else if (lang.includes('sql')) patterns = errorPatterns.sql;

    // Track bracket balance across lines
    let parenBalance = 0;
    let bracketBalance = 0;
    let braceBalance = 0;
    let singleQuoteOpen = false;
    let doubleQuoteOpen = false;
    let templateLiteralOpen = false;

    codeLines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      
      // Skip comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || 
          trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        return;
      }

      // Check bracket balance
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';
        
        if (prevChar !== '\\') {
          if (char === '"' && !singleQuoteOpen && !templateLiteralOpen) doubleQuoteOpen = !doubleQuoteOpen;
          if (char === "'" && !doubleQuoteOpen && !templateLiteralOpen) singleQuoteOpen = !singleQuoteOpen;
          if (char === '`' && !doubleQuoteOpen && !singleQuoteOpen) templateLiteralOpen = !templateLiteralOpen;
        }
        
        if (!singleQuoteOpen && !doubleQuoteOpen && !templateLiteralOpen) {
          if (char === '(') parenBalance++;
          if (char === ')') parenBalance--;
          if (char === '[') bracketBalance++;
          if (char === ']') bracketBalance--;
          if (char === '{') braceBalance++;
          if (char === '}') braceBalance--;
        }

        // Detect immediate unbalanced closing
        if (parenBalance < 0) {
          detectedErrors.push({
            line: lineNum, column: i + 1,
            message: 'Unexpected closing parenthesis ")"',
            severity: 'error', type: 'SyntaxError',
            suggestion: 'Remove the extra ) or add matching ('
          });
          parenBalance = 0;
        }
        if (bracketBalance < 0) {
          detectedErrors.push({
            line: lineNum, column: i + 1,
            message: 'Unexpected closing bracket "]"',
            severity: 'error', type: 'SyntaxError',
            suggestion: 'Remove the extra ] or add matching ['
          });
          bracketBalance = 0;
        }
        if (braceBalance < 0) {
          detectedErrors.push({
            line: lineNum, column: i + 1,
            message: 'Unexpected closing brace "}"',
            severity: 'error', type: 'SyntaxError',
            suggestion: 'Remove the extra } or add matching {'
          });
          braceBalance = 0;
        }
      }

      // Check for unclosed strings at end of line
      if (singleQuoteOpen && !line.includes("'")) {
        // String continues to next line - could be intentional
      } else if (singleQuoteOpen) {
        const quoteCount = (line.match(/'/g) || []).length;
        if (quoteCount % 2 !== 0) {
          detectedErrors.push({
            line: lineNum, column: line.lastIndexOf("'") + 1,
            message: 'Unclosed string literal (single quote)',
            severity: 'error', type: 'SyntaxError',
            suggestion: "Add closing ' at the end of string"
          });
        }
      }
      
      if (doubleQuoteOpen && line.includes('"')) {
        const quoteCount = (line.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          detectedErrors.push({
            line: lineNum, column: line.lastIndexOf('"') + 1,
            message: 'Unclosed string literal (double quote)',
            severity: 'error', type: 'SyntaxError',
            suggestion: 'Add closing " at the end of string'
          });
        }
      }

      // Apply language-specific patterns
      patterns.forEach(pattern => {
        if (pattern.regex.test(line)) {
          const match = line.match(pattern.regex);
          detectedErrors.push({
            line: lineNum,
            column: match?.index ? match.index + 1 : 1,
            message: pattern.message,
            severity: pattern.type.includes('Warning') ? 'warning' : 'error',
            type: pattern.type,
            suggestion: `Fix the ${pattern.type} on this line`
          });
        }
      });

      // Common typos detection
      const typos: Record<string, string> = {
        'funtcion': 'function', 'funtion': 'function', 'fucntion': 'function',
        'retrun': 'return', 'reutrn': 'return', 'retrn': 'return',
        'consle': 'console', 'cosole': 'console',
        'documnet': 'document', 'docuemnt': 'document',
        'widnow': 'window', 'windwo': 'window',
        'lenght': 'length', 'legnth': 'length',
        'pritn': 'print', 'pirnt': 'print',
        'improt': 'import', 'imoprt': 'import',
        'exprot': 'export', 'exoprt': 'export',
        'calss': 'class', 'clss': 'class',
        'pubilc': 'public', 'publci': 'public',
        'priavte': 'private', 'prviate': 'private',
        'strign': 'string', 'stirng': 'string',
        'nubmer': 'number', 'numebr': 'number',
        'booelan': 'boolean', 'booelean': 'boolean',
        'undefiend': 'undefined', 'undefind': 'undefined',
        'nulll': 'null', 'nul': 'null',
        'treu': 'true', 'ture': 'true',
        'flase': 'false', 'fasle': 'false',
        'elese': 'else', 'esle': 'else',
        'whiel': 'while', 'wihle': 'while',
        'breka': 'break', 'braek': 'break',
        'contnue': 'continue', 'contniue': 'continue',
        'swtich': 'switch', 'siwthc': 'switch',
        'defualt': 'default', 'deafult': 'default',
        'thorw': 'throw', 'trhow': 'throw',
        'ctahc': 'catch', 'cathc': 'catch',
        'finaly': 'finally', 'fianlly': 'finally',
        'extedns': 'extends', 'extneds': 'extends',
        'implments': 'implements', 'impelments': 'implements',
        'interfce': 'interface', 'interfcae': 'interface',
        'syncrohnized': 'synchronized',
        'voaltile': 'volatile',
        'trasient': 'transient',
      };

      Object.entries(typos).forEach(([typo, correct]) => {
        const typoRegex = new RegExp(`\\b${typo}\\b`, 'gi');
        const match = line.match(typoRegex);
        if (match) {
          detectedErrors.push({
            line: lineNum,
            column: line.search(typoRegex) + 1,
            message: `Typo: "${match[0]}" should be "${correct}"`,
            severity: 'error',
            type: 'SpellingError',
            suggestion: `Replace "${match[0]}" with "${correct}"`
          });
        }
      });

      // Missing semicolon check for C-style languages
      if (['JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Auto-Detect'].includes(language)) {
        if (trimmedLine && 
            !trimmedLine.endsWith(';') && !trimmedLine.endsWith('{') && 
            !trimmedLine.endsWith('}') && !trimmedLine.endsWith(':') && 
            !trimmedLine.endsWith(',') && !trimmedLine.endsWith('(') &&
            !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*') &&
            !trimmedLine.startsWith('*') && !trimmedLine.startsWith('#') &&
            !/^(if|else|for|while|do|switch|case|try|catch|finally|function|class|import|export|const|let|var|return|async|public|private|protected|static)\b/.test(trimmedLine) &&
            !/[{}()[\]]\s*$/.test(trimmedLine) &&
            trimmedLine.length > 3 &&
            /[a-zA-Z0-9"'`)\]]\s*$/.test(trimmedLine)) {
          detectedErrors.push({
            line: lineNum,
            column: line.length,
            message: 'Missing semicolon',
            severity: 'warning',
            type: 'Warning',
            suggestion: 'Add ; at the end of the statement'
          });
        }
      }
    });

    // Check for unclosed brackets at end
    if (parenBalance > 0) {
      detectedErrors.push({
        line: codeLines.length, column: 1,
        message: `${parenBalance} unclosed parenthesis "("`,
        severity: 'error', type: 'SyntaxError',
        suggestion: `Add ${parenBalance} closing ) at appropriate location`
      });
    }
    if (bracketBalance > 0) {
      detectedErrors.push({
        line: codeLines.length, column: 1,
        message: `${bracketBalance} unclosed bracket "["`,
        severity: 'error', type: 'SyntaxError',
        suggestion: `Add ${bracketBalance} closing ] at appropriate location`
      });
    }
    if (braceBalance > 0) {
      detectedErrors.push({
        line: codeLines.length, column: 1,
        message: `${braceBalance} unclosed brace "{"`,
        severity: 'error', type: 'SyntaxError',
        suggestion: `Add ${braceBalance} closing } at appropriate location`
      });
    }

    setErrors(detectedErrors);

    // Generate corrected code
    if (detectedErrors.length > 0) {
      let corrected = codeText;
      
      // Apply typo corrections
      Object.entries({
        'funtcion': 'function', 'funtion': 'function', 'fucntion': 'function',
        'retrun': 'return', 'reutrn': 'return', 'retrn': 'return',
        'consle': 'console', 'cosole': 'console',
        'documnet': 'document', 'docuemnt': 'document',
        'widnow': 'window', 'windwo': 'window',
        'lenght': 'length', 'legnth': 'length',
        'pritn': 'print', 'pirnt': 'print',
        'improt': 'import', 'imoprt': 'import',
        'exprot': 'export', 'exoprt': 'export',
        'calss': 'class', 'clss': 'class',
        'treu': 'true', 'ture': 'true',
        'flase': 'false', 'fasle': 'false',
        'elese': 'else', 'esle': 'else',
      }).forEach(([typo, correct]) => {
        corrected = corrected.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correct);
      });

      setCorrectedCode(corrected);
    } else {
      setCorrectedCode('');
    }

    // Generate code improvement suggestions
    generateImprovements(codeText);

    const endTime = performance.now();
    setDetectionTime(endTime - startTime);
    setIsDetecting(false);
  }, [language]);

  // Generate code improvement suggestions
  const generateImprovements = (codeText: string) => {
    const newImprovements: CodeImprovement[] = [];

    // Check for var usage
    if (/\bvar\s+\w+/.test(codeText)) {
      newImprovements.push({
        title: 'Use const/let instead of var',
        original: 'var x = 10;',
        improved: 'const x = 10; // or let x = 10;',
        explanation: 'var has function scope which can lead to bugs. const/let have block scope and are safer.',
        level: 'junior'
      });
    }

    // Check for == instead of ===
    if (/[^=!]==[^=]/.test(codeText)) {
      newImprovements.push({
        title: 'Use strict equality (===)',
        original: 'if (x == 5)',
        improved: 'if (x === 5)',
        explanation: '=== checks both value and type, preventing unexpected type coercion bugs.',
        level: 'junior'
      });
    }

    // Check for string concatenation
    if (/["']\s*\+\s*\w+\s*\+\s*["']/.test(codeText)) {
      newImprovements.push({
        title: 'Use template literals',
        original: '"Hello " + name + "!"',
        improved: '`Hello ${name}!`',
        explanation: 'Template literals are more readable and allow multi-line strings.',
        level: 'junior'
      });
    }

    // Check for callback hell
    if ((codeText.match(/\.then\(/g) || []).length > 2) {
      newImprovements.push({
        title: 'Use async/await instead of .then()',
        original: 'fetch().then().then().then()',
        improved: 'const result = await fetch();\nconst data = await result.json();',
        explanation: 'async/await makes asynchronous code more readable and easier to debug.',
        level: 'senior'
      });
    }

    // Check for manual array iteration
    if (/for\s*\(\s*(var|let)\s+\w+\s*=\s*0\s*;/.test(codeText) && /\.length/.test(codeText)) {
      newImprovements.push({
        title: 'Use array methods',
        original: 'for (let i = 0; i < arr.length; i++)',
        improved: 'arr.forEach((item) => { }) // or arr.map()',
        explanation: 'Array methods like forEach, map, filter are more expressive and less error-prone.',
        level: 'junior'
      });
    }

    // Check for function declaration style
    if (/function\s+\w+\s*\(/.test(codeText) && !codeText.includes('=>')) {
      newImprovements.push({
        title: 'Consider arrow functions',
        original: 'function add(a, b) { return a + b; }',
        improved: 'const add = (a, b) => a + b;',
        explanation: 'Arrow functions have shorter syntax and lexical this binding.',
        level: 'junior'
      });
    }

    // Check for console.log
    if (/console\.log/.test(codeText)) {
      newImprovements.push({
        title: 'Remove console.log in production',
        original: 'console.log("debug:", data);',
        improved: '// Use proper logging library\nlogger.debug("Processing:", data);',
        explanation: 'console.log should be removed before production. Use a logging library instead.',
        level: 'senior'
      });
    }

    // Check for magic numbers
    if (/[^0-9a-zA-Z_](\d{2,})[^0-9]/.test(codeText) && !/const.*=\s*\d+/.test(codeText)) {
      newImprovements.push({
        title: 'Avoid magic numbers',
        original: 'if (age >= 18)',
        improved: 'const ADULT_AGE = 18;\nif (age >= ADULT_AGE)',
        explanation: 'Named constants make code self-documenting and easier to maintain.',
        level: 'senior'
      });
    }

    setImprovements(newImprovements);
  };

  // Live error detection with fast debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (code.trim()) {
      debounceRef.current = setTimeout(() => {
        detectErrors(code);
      }, 5); // 0.005 seconds = 5ms
    } else {
      setErrors([]);
      setCorrectedCode('');
      setImprovements([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, language, detectErrors]);

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

    // Auto-indent on Enter after {
    if (e.key === 'Enter') {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const cursorPos = textarea.selectionStart;
      const charBefore = code[cursorPos - 1];
      
      if (charBefore === '{') {
        e.preventDefault();
        const currentLineStart = code.lastIndexOf('\n', cursorPos - 1) + 1;
        const currentLine = code.substring(currentLineStart, cursorPos);
        const indent = currentLine.match(/^\s*/)?.[0] || '';
        const newIndent = indent + '    ';
        
        const newValue = code.substring(0, cursorPos) + '\n' + newIndent + '\n' + indent + code.substring(cursorPos);
        setCode(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursorPos + 1 + newIndent.length;
        }, 0);
      }
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
    setImprovements([]);
    toast({ title: "Cleared", description: "Editor content cleared" });
  };

  const applyCorrectedCode = () => {
    if (correctedCode) {
      setCode(correctedCode);
      setCorrectedCode('');
      setErrors([]);
      toast({ 
        title: "✅ Fix Applied", 
        description: "Corrected code has been applied to the editor" 
      });
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
    if (lineError) return 'bg-red-500/30 border-l-2 border-red-500';
    if (lineWarning) return 'bg-yellow-500/20 border-l-2 border-yellow-500';
    return '';
  };

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  if (isMinimized) {
    return (
      <div className="border border-border rounded-lg p-3 bg-card flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Live Code IDE ({lineCount.toLocaleString()} lines, {errorCount} errors)
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
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Language (1600+ supported)
          </label>
          <LanguageSelector 
            value={language} 
            onChange={setLanguage}
            placeholder="Auto-Detect"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Play className="w-4 h-4 text-green-500" />
            Run Analysis
          </label>
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
      <div className="border-2 border-border rounded-xl overflow-hidden bg-[#1a1a2e] shadow-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#16213e] to-[#1a1a2e] border-b border-[#0f3460]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-sm font-semibold text-[#e94560]">Live Code IDE</span>
            <span className="text-xs text-gray-500">|</span>
            <span className="text-xs text-gray-400">
              {lineCount.toLocaleString()} / {maxLines.toLocaleString()} lines
            </span>
            {isDetecting && (
              <span className="text-xs text-blue-400 animate-pulse flex items-center gap-1">
                <Zap className="w-3 h-3" /> Detecting...
              </span>
            )}
            {detectionTime > 0 && !isDetecting && (
              <span className="text-xs text-green-400">
                ⚡ {detectionTime.toFixed(2)}ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errorCount} errors
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                ⚠️ {warningCount} warnings
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-8 px-2 text-gray-400 hover:text-white hover:bg-[#0f3460]">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={clearEditor} className="h-8 px-2 text-gray-400 hover:text-white hover:bg-[#0f3460]">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)} className="h-8 px-2 text-gray-400 hover:text-white hover:bg-[#0f3460]">
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex relative" style={{ height: '450px' }}>
          {/* Line Numbers */}
          <div 
            ref={lineNumbersRef}
            className="bg-[#16213e] text-gray-500 text-right py-2 overflow-hidden select-none border-r border-[#0f3460]"
            style={{ 
              minWidth: '60px',
              fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
              fontSize: '14px',
              lineHeight: '1.6',
            }}
          >
            {lineNumbers.map(num => (
              <div 
                key={num} 
                className={`px-3 transition-colors ${num === cursorPosition.line ? 'text-[#e94560] bg-[#0f3460]' : ''} ${getLineClass(num)}`}
                style={{ height: '22.4px' }}
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
            placeholder={"// 🚀 Start typing your code here...\n// ⚡ Live error detection in 0.005 sec\n// 📝 Supports 500,000+ lines\n// 🔧 Auto-close: () [] {} '' \"\" ``\n// ➡️ Tab for indent, Shift+Tab to unindent\n// 🎯 Errors show in RED, corrections in GREEN"}
            className="flex-1 bg-[#1a1a2e] text-[#eaeaea] p-3 resize-none outline-none overflow-auto placeholder:text-gray-600"
            style={{ 
              fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
              fontSize: '14px',
              lineHeight: '1.6',
              tabSize: 4,
              whiteSpace: 'pre',
              overflowWrap: 'normal',
              caretColor: '#e94560',
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-[#e94560] to-[#0f3460] text-white text-xs">
          <div className="flex items-center gap-4">
            <span className="font-medium">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            <span className="opacity-50">|</span>
            <span>{lineCount.toLocaleString()} lines</span>
            <span className="opacity-50">|</span>
            <span>{code.length.toLocaleString()} chars</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-white/20 px-2 py-0.5 rounded">{language}</span>
            <span>UTF-8</span>
            <span>Tab: 4</span>
          </div>
        </div>
      </div>

      {/* Console Output Panels */}
      <div className="space-y-4">
        {/* Error Console - Red */}
        {errors.length > 0 && (
          <div className="bg-[#1a1a2e] border-2 border-red-500/50 rounded-xl overflow-hidden shadow-lg shadow-red-500/10">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-500/30 to-red-600/20 border-b border-red-500/50">
              <span className="text-sm font-bold text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                🔴 CONSOLE - Live Errors Detected ({errors.length})
              </span>
              <span className="text-xs text-red-300">Real-time syntax analysis</span>
            </div>
            <div className="p-4 max-h-[250px] overflow-y-auto space-y-2">
              {errors.map((error, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg border-l-4 ${
                    error.severity === 'error' 
                      ? 'bg-red-500/10 border-red-500 text-red-300' 
                      : 'bg-yellow-500/10 border-yellow-500 text-yellow-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded">
                          Line {error.line}:{error.column}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-black/30">
                          {error.type}
                        </span>
                      </div>
                      <p className="text-sm font-medium">
                        {error.severity === 'error' ? '❌' : '⚠️'} {error.message}
                      </p>
                      {error.suggestion && (
                        <p className="text-xs mt-1 opacity-80 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          {error.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Corrected Code Console - Green */}
        {correctedCode && correctedCode !== code && (
          <div className="bg-[#1a1a2e] border-2 border-green-500/50 rounded-xl overflow-hidden shadow-lg shadow-green-500/10">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500/30 to-green-600/20 border-b border-green-500/50">
              <span className="text-sm font-bold text-green-400 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                🟢 CORRECTED CODE
              </span>
              <Button 
                variant="default" 
                size="sm" 
                onClick={applyCorrectedCode}
                className="h-8 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Apply Fix
              </Button>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              <pre 
                className="text-sm text-green-300 font-mono whitespace-pre-wrap leading-relaxed"
                style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}
              >
                {correctedCode}
              </pre>
            </div>
          </div>
        )}

        {/* Code Improvements Console - Orange */}
        {improvements.length > 0 && (
          <div className="bg-[#1a1a2e] border-2 border-orange-500/50 rounded-xl overflow-hidden shadow-lg shadow-orange-500/10">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500/30 to-orange-600/20 border-b border-orange-500/50">
              <span className="text-sm font-bold text-orange-400 flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                🟠 CODE IMPROVEMENT SUGGESTIONS
              </span>
              <span className="text-xs text-orange-300">Junior → Senior Best Practices</span>
            </div>
            <div className="p-4 max-h-[350px] overflow-y-auto space-y-4">
              {improvements.map((improvement, index) => (
                <div key={index} className="bg-orange-500/5 border border-orange-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-orange-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      {improvement.title}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      improvement.level === 'senior' 
                        ? 'bg-purple-500/20 text-purple-300' 
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {improvement.level === 'senior' ? '🎓 Senior Level' : '📚 Junior Level'}
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
                      <span className="text-xs text-red-400 font-medium block mb-2">❌ Before (Avoid):</span>
                      <code className="text-xs text-red-300 font-mono">{improvement.original}</code>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                      <span className="text-xs text-green-400 font-medium block mb-2">✅ After (Better):</span>
                      <code className="text-xs text-green-300 font-mono whitespace-pre-wrap">{improvement.improved}</code>
                    </div>
                  </div>
                  <p className="text-xs text-orange-200/80 mt-3 flex items-start gap-2">
                    <span className="mt-0.5">💡</span>
                    {improvement.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Errors Message */}
        {code.trim() && errors.length === 0 && (
          <div className="bg-[#1a1a2e] border-2 border-green-500/50 rounded-xl p-4">
            <span className="text-sm font-bold text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              ✨ No syntax errors detected - Your code looks great!
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCodeIDE;
