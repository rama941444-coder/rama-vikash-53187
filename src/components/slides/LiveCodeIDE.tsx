import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, AlertCircle, CheckCircle, Copy, Trash2, Maximize2, Minimize2, Loader2, Lightbulb, Zap, ArrowRight, Sparkles, Terminal, TrendingUp, Award, Save, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LanguageSelector from '@/components/LanguageSelector';
import { supabase } from '@/integrations/supabase/client';
import { treeSitterService, type TreeSitterError } from '@/lib/treeSitterService';

interface LiveCodeIDEProps {
  onAnalysisComplete: (data: any) => void;
  persistedCode?: string;
  onCodeChange?: (code: string) => void;
}

interface CodeError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  type: string;
  suggestion?: string;
  wrongCode?: string;
  correctCode?: string;
}

interface ExecutionResult {
  output: string;
  error?: string;
  executionTime?: number;
}

interface ComplexityAnalysis {
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
}

interface BestSolution {
  code: string;
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
}

const LiveCodeIDE = ({ onAnalysisComplete, persistedCode = '', onCodeChange }: LiveCodeIDEProps) => {
  const [code, setCode] = useState(persistedCode);
  const [language, setLanguage] = useState('Auto-Detect');
  const [errors, setErrors] = useState<CodeError[]>([]);
  const [correctedCode, setCorrectedCode] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [detectionTime, setDetectionTime] = useState(0);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [complexityAnalysis, setComplexityAnalysis] = useState<ComplexityAnalysis | null>(null);
  const [bestSolution, setBestSolution] = useState<BestSolution | null>(null);
  const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [inputPrompt, setInputPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const [treeSitterReady, setTreeSitterReady] = useState(false);
  const treeSitterLangRef = useRef<string>('');

  // Sync with persisted code
  useEffect(() => {
    if (persistedCode && persistedCode !== code) {
      setCode(persistedCode);
    }
  }, [persistedCode]);

  // Initialize Tree-sitter WASM
  useEffect(() => {
    treeSitterService.init().then(ok => {
      setTreeSitterReady(ok);
      if (ok) console.log('🌳 Tree-sitter WASM initialized');
    });
    return () => { /* keep singleton alive */ };
  }, []);

  // Notify parent of code changes
  useEffect(() => {
    if (onCodeChange && code !== persistedCode) {
      onCodeChange(code);
    }
  }, [code, onCodeChange, persistedCode]);

  const lines = code.split('\n');
  const lineCount = lines.length;
  const maxLines = 500000;

  // AI-powered deep error detection (compiler-style)
  const aiDetectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiErrors, setAiErrors] = useState<CodeError[]>([]);
  const [aiCorrectedCode, setAiCorrectedCode] = useState('');
  const [isAiDetecting, setIsAiDetecting] = useState(false);
  const lastAiCodeRef = useRef('');

  // Comprehensive error patterns for multiple languages (offline fallback)
  const errorPatterns: Record<string, Array<{regex: RegExp, message: string, type: string}>> = {
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
    java: [
      { regex: /\bpublic\s+class\s*$/, message: 'Class name expected', type: 'SyntaxError' },
      { regex: /\bpublic\s+static\s+void\s+main\s*\(\s*\)/, message: 'main method requires String[] args parameter', type: 'SyntaxError' },
      { regex: /\bSystem\.out\.print(?!ln|f)/, message: 'Did you mean System.out.println()?', type: 'SyntaxError' },
      { regex: /\bint\s+\w+\s*=\s*"/, message: 'Type mismatch: cannot assign String to int', type: 'TypeError' },
      { regex: /\bString\s+\w+\s*=\s*\d+\s*;/, message: 'Type mismatch: cannot assign int to String', type: 'TypeError' },
    ],
    cpp: [
      { regex: /#include\s*$/, message: 'Header file expected after #include', type: 'PreprocessorError' },
      { regex: /\bprintf\s*\(\s*"[^"]*"[^,)]/, message: 'Format specifier missing or malformed', type: 'SyntaxError' },
      { regex: /\bint\s+main\s*\(\s*\)\s*[^{]/, message: 'Opening brace expected for main function', type: 'SyntaxError' },
      { regex: /\bmalloc\s*\([^)]*\)\s*;/, message: 'malloc return value should be assigned', type: 'Warning' },
      { regex: /\bscanf\s*\(\s*"[^"]*",\s*\w+[^&]/, message: 'scanf requires address-of operator (&)', type: 'SyntaxError' },
      { regex: /\bcout\s*<<\s*$/, message: 'Expression expected after <<', type: 'SyntaxError' },
      { regex: /\bcin\s*>>\s*$/, message: 'Variable expected after >>', type: 'SyntaxError' },
    ],
    html: [
      { regex: /<\w+[^>]*[^/]>\s*$/, message: 'Closing tag may be missing', type: 'SyntaxError' },
      { regex: /<\/\w+[^>]*$/, message: 'Closing bracket > missing', type: 'SyntaxError' },
      { regex: /style\s*=\s*"[^"]*:[^"]*"[^;]/, message: 'CSS property may be missing semicolon', type: 'Warning' },
    ],
    sql: [
      { regex: /\bSELECT\s+\*\s+$/, message: 'FROM clause expected', type: 'SyntaxError' },
      { regex: /\bFROM\s+$/, message: 'Table name expected after FROM', type: 'SyntaxError' },
      { regex: /\bWHERE\s+$/, message: 'Condition expected after WHERE', type: 'SyntaxError' },
      { regex: /\bINSERT\s+INTO\s+\w+\s*$/, message: 'VALUES clause expected', type: 'SyntaxError' },
    ],
    rust: [
      { regex: /\blet\s+mut\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
      { regex: /\bfn\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bprintln!\s*$/, message: 'Format string expected', type: 'SyntaxError' },
      { regex: /\blet\s+\w+\s*=\s*$/, message: 'Expression expected after =', type: 'SyntaxError' },
      { regex: /\bimpl\s*$/, message: 'Type name expected after impl', type: 'SyntaxError' },
    ],
    go: [
      { regex: /\bfunc\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bfmt\.Println\s*$/, message: 'Arguments expected', type: 'SyntaxError' },
      { regex: /\bpackage\s*$/, message: 'Package name expected', type: 'SyntaxError' },
      { regex: /\bvar\s+\w+\s*$/, message: 'Type or value expected', type: 'SyntaxError' },
      { regex: /:=\s*$/, message: 'Value expected after :=', type: 'SyntaxError' },
    ],
    ruby: [
      { regex: /\bdef\s*$/, message: 'Method name expected', type: 'SyntaxError' },
      { regex: /\bputs\s*$/, message: 'Argument expected', type: 'SyntaxError' },
      { regex: /\bclass\s*$/, message: 'Class name expected', type: 'SyntaxError' },
      { regex: /\brequire\s*$/, message: 'File path expected', type: 'SyntaxError' },
    ],
    php: [
      { regex: /\bfunction\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\becho\s*$/, message: 'Expression expected after echo', type: 'SyntaxError' },
      { regex: /\$\s*=/, message: 'Variable name expected before =', type: 'SyntaxError' },
      { regex: /<\?(?!php)/, message: 'Use <?php instead of short tags', type: 'Warning' },
    ],
    swift: [
      { regex: /\bfunc\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bvar\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
      { regex: /\blet\s*$/, message: 'Constant name expected', type: 'SyntaxError' },
      { regex: /\bguard\s*$/, message: 'Condition expected after guard', type: 'SyntaxError' },
    ],
    kotlin: [
      { regex: /\bfun\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bval\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
      { regex: /\bvar\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
      { regex: /\bwhen\s*$/, message: 'Expression expected after when', type: 'SyntaxError' },
    ],
    csharp: [
      { regex: /\bConsole\.Write(?!Line)/, message: 'Did you mean Console.WriteLine()?', type: 'Warning' },
      { regex: /\bstatic\s+void\s+Main\s*\(\s*\)/, message: 'Main requires string[] args parameter', type: 'SyntaxError' },
      { regex: /\bnamespace\s*$/, message: 'Namespace name expected', type: 'SyntaxError' },
    ],
    dart: [
      { regex: /\bvoid\s+main\s*\(\s*\)\s*[^{]/, message: 'Opening brace expected', type: 'SyntaxError' },
      { regex: /\bprint\s*$/, message: 'Arguments expected for print()', type: 'SyntaxError' },
      { regex: /\bvar\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
    ],
    scala: [
      { regex: /\bdef\s*$/, message: 'Method name expected', type: 'SyntaxError' },
      { regex: /\bval\s*$/, message: 'Value name expected', type: 'SyntaxError' },
      { regex: /\bobject\s*$/, message: 'Object name expected', type: 'SyntaxError' },
    ],
    haskell: [
      { regex: /\bmodule\s*$/, message: 'Module name expected', type: 'SyntaxError' },
      { regex: /\bimport\s*$/, message: 'Module name expected after import', type: 'SyntaxError' },
      { regex: /\bwhere\s*$/, message: 'Declarations expected after where', type: 'SyntaxError' },
    ],
    lua: [
      { regex: /\bfunction\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\blocal\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
      { regex: /\bprint\s*$/, message: 'Arguments expected', type: 'SyntaxError' },
    ],
    perl: [
      { regex: /\bsub\s*$/, message: 'Subroutine name expected', type: 'SyntaxError' },
      { regex: /\bmy\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
      { regex: /\bprint\s*$/, message: 'Expression expected after print', type: 'SyntaxError' },
    ],
    elixir: [
      { regex: /\bdef\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bdefmodule\s*$/, message: 'Module name expected', type: 'SyntaxError' },
    ],
    julia: [
      { regex: /\bfunction\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bprintln\s*$/, message: 'Arguments expected', type: 'SyntaxError' },
    ],
    fortran: [
      { regex: /\bprogram\s*$/, message: 'Program name expected', type: 'SyntaxError' },
      { regex: /\bsubroutine\s*$/, message: 'Subroutine name expected', type: 'SyntaxError' },
    ],
    zig: [
      { regex: /\bfn\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bconst\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
    ],
    nim: [
      { regex: /\bproc\s*$/, message: 'Proc name expected', type: 'SyntaxError' },
      { regex: /\bvar\s*$/, message: 'Variable name expected', type: 'SyntaxError' },
    ],
    solidity: [
      { regex: /\bcontract\s*$/, message: 'Contract name expected', type: 'SyntaxError' },
      { regex: /\bfunction\s*$/, message: 'Function name expected', type: 'SyntaxError' },
    ],
  };

  // Get compiler command string for display
  const getCompilerName = useCallback((lang: string): string => {
    const l = lang.toLowerCase();
    if (l === 'c') return 'gcc';
    if (l.includes('c++') || l.includes('cpp')) return 'g++';
    if (l.includes('python')) return 'python3';
    if (l.includes('java') && !l.includes('javascript')) return 'javac';
    if (l.includes('javascript') || l.includes('node')) return 'node';
    if (l.includes('typescript')) return 'tsc';
    if (l.includes('rust')) return 'rustc';
    if (l.includes('go')) return 'go build';
    if (l.includes('ruby')) return 'ruby';
    if (l.includes('php')) return 'php';
    if (l.includes('swift')) return 'swiftc';
    if (l.includes('kotlin')) return 'kotlinc';
    if (l.includes('c#') || l.includes('csharp')) return 'dotnet build';
    if (l.includes('r')) return 'Rscript';
    if (l.includes('perl')) return 'perl';
    if (l.includes('scala')) return 'scalac';
    if (l.includes('haskell')) return 'ghc';
    if (l.includes('lua')) return 'lua';
    if (l.includes('dart')) return 'dart analyze';
    return lang.toLowerCase();
  }, []);

  // Format error in compiler style
  const formatCompilerError = useCallback((error: CodeError, lang: string): string => {
    const l = lang.toLowerCase();
    const file = l === 'c' ? 'main.c' : l.includes('c++') || l.includes('cpp') ? 'main.cpp' : 
                 l.includes('python') ? 'main.py' : l.includes('java') && !l.includes('javascript') ? 'Main.java' :
                 l.includes('javascript') || l.includes('node') ? 'main.js' : l.includes('typescript') ? 'main.ts' :
                 l.includes('rust') ? 'main.rs' : l.includes('go') ? 'main.go' : l.includes('ruby') ? 'main.rb' :
                 l.includes('php') ? 'main.php' : l.includes('swift') ? 'main.swift' : l.includes('kotlin') ? 'main.kt' :
                 l.includes('c#') || l.includes('csharp') ? 'Program.cs' : 'source';

    if (l === 'c' || l.includes('c++') || l.includes('cpp')) {
      return `${file}:${error.line}:${error.column}: ${error.severity}: ${error.message}`;
    }
    if (l.includes('python')) {
      return `File "${file}", line ${error.line}\n    ${error.wrongCode || ''}\n    ^\n${error.type}: ${error.message}`;
    }
    if (l.includes('java') && !l.includes('javascript')) {
      return `${file}:${error.line}: error: ${error.message}`;
    }
    if (l.includes('rust')) {
      return `error[E0308]: ${error.message}\n --> ${file}:${error.line}:${error.column}`;
    }
    if (l.includes('go')) {
      return `./${file}:${error.line}:${error.column}: ${error.message}`;
    }
    return `${file}:${error.line}:${error.column}: ${error.severity}: ${error.message}`;
  }, []);

  // LOCAL error detection - Tree-sitter (primary) + regex fallback (works offline, instant)
  const detectErrorsLocal = useCallback(async (codeText: string) => {
    const startTime = performance.now();
    setIsDetecting(true);
    
    const detectedErrors: CodeError[] = [];
    const codeLines = codeText.split('\n');

    // === TREE-SITTER INCREMENTAL PARSING (primary, ~0.5ms) ===
    let treeSitterUsed = false;
    if (treeSitterReady) {
      const langNorm = language.toLowerCase().replace(/\s+/g, '');
      const tsLang = langNorm === 'auto-detect' ? '' : langNorm;
      
      if (tsLang && treeSitterService.isLanguageSupported(tsLang)) {
        // Load grammar if language changed
        if (treeSitterLangRef.current !== tsLang) {
          const loaded = await treeSitterService.loadLanguage(tsLang);
          if (loaded) {
            treeSitterLangRef.current = tsLang;
          }
        }
        
        if (treeSitterLangRef.current === tsLang) {
          const tsErrors = treeSitterService.parse(codeText, tsLang);
          treeSitterUsed = true;
          
          tsErrors.forEach(tsErr => {
            detectedErrors.push({
              line: tsErr.line,
              column: tsErr.column,
              message: tsErr.message,
              severity: tsErr.severity,
              type: tsErr.type,
              wrongCode: tsErr.wrongCode,
              suggestion: tsErr.suggestion,
            });
          });
        }
      }
    }
    
    // Only run regex fallback if Tree-sitter didn't handle it
    if (!treeSitterUsed) {
    
    // Determine language patterns to use
    let patterns = errorPatterns.js;
    const lang = language.toLowerCase();
    if (lang.includes('python')) patterns = errorPatterns.python;
    else if (lang.includes('java') && !lang.includes('javascript')) patterns = errorPatterns.java;
    else if (lang.includes('c++') || lang.includes('cpp') || lang === 'c') patterns = errorPatterns.cpp;
    else if (lang.includes('html') || lang.includes('css')) patterns = errorPatterns.html;
    else if (lang.includes('sql')) patterns = errorPatterns.sql;
    else if (lang.includes('rust')) patterns = errorPatterns.rust;
    else if (lang.includes('go')) patterns = errorPatterns.go;
    else if (lang.includes('ruby')) patterns = errorPatterns.ruby;
    else if (lang.includes('php')) patterns = errorPatterns.php;
    else if (lang.includes('swift')) patterns = errorPatterns.swift;
    else if (lang.includes('kotlin')) patterns = errorPatterns.kotlin;
    else if (lang.includes('c#') || lang.includes('csharp')) patterns = errorPatterns.csharp;
    else if (lang.includes('dart')) patterns = errorPatterns.dart;
    else if (lang.includes('scala')) patterns = errorPatterns.scala;
    else if (lang.includes('haskell')) patterns = errorPatterns.haskell;
    else if (lang.includes('lua')) patterns = errorPatterns.lua;
    else if (lang.includes('perl')) patterns = errorPatterns.perl;
    else if (lang.includes('elixir')) patterns = errorPatterns.elixir;
    else if (lang.includes('julia')) patterns = errorPatterns.julia;
    else if (lang.includes('fortran')) patterns = errorPatterns.fortran;
    else if (lang.includes('zig')) patterns = errorPatterns.zig;
    else if (lang.includes('nim')) patterns = errorPatterns.nim;
    else if (lang.includes('solidity')) patterns = errorPatterns.solidity;

    let parenBalance = 0;
    let bracketBalance = 0;
    let braceBalance = 0;
    let singleQuoteOpen = false;
    let doubleQuoteOpen = false;
    let templateLiteralOpen = false;

    const compiler = getCompilerName(language);

    codeLines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || 
          trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        return;
      }

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

        if (parenBalance < 0) {
          detectedErrors.push({
            line: lineNum, column: i + 1,
            message: `unexpected closing parenthesis ")"`,
            severity: 'error', type: 'SyntaxError',
            suggestion: 'Remove the extra ) or add matching ('
          });
          parenBalance = 0;
        }
        if (bracketBalance < 0) {
          detectedErrors.push({
            line: lineNum, column: i + 1,
            message: `unexpected closing bracket "]"`,
            severity: 'error', type: 'SyntaxError',
            suggestion: 'Remove the extra ] or add matching ['
          });
          bracketBalance = 0;
        }
        if (braceBalance < 0) {
          detectedErrors.push({
            line: lineNum, column: i + 1,
            message: `unexpected closing brace "}"`,
            severity: 'error', type: 'SyntaxError',
            suggestion: 'Remove the extra } or add matching {'
          });
          braceBalance = 0;
        }
      }

      if (singleQuoteOpen && line.includes("'")) {
        const quoteCount = (line.match(/'/g) || []).length;
        if (quoteCount % 2 !== 0) {
          detectedErrors.push({
            line: lineNum, column: line.lastIndexOf("'") + 1,
            message: 'unclosed string literal (single quote)',
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
            message: 'unclosed string literal (double quote)',
            severity: 'error', type: 'SyntaxError',
            suggestion: 'Add closing " at the end of string'
          });
        }
      }

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
        'incldue': 'include', 'inlcude': 'include',
        'stdoi': 'stdio', 'stidio': 'stdio',
        'prnitf': 'printf', 'prinft': 'printf',
        'scnaf': 'scanf', 'sacnf': 'scanf',
        'mian': 'main', 'mainn': 'main',
        'viod': 'void',
        'sturct': 'struct', 'strcut': 'struct',
        'assing': 'assign', 'asign': 'assign',
      };

      Object.entries(typos).forEach(([typo, correct]) => {
        const typoRegex = new RegExp(`\\b${typo}\\b`, 'gi');
        const match = line.match(typoRegex);
        if (match) {
          detectedErrors.push({
            line: lineNum,
            column: line.search(typoRegex) + 1,
            message: `'${match[0]}' should be '${correct}'`,
            severity: 'error',
            type: 'SpellingError',
            wrongCode: match[0],
            correctCode: correct,
            suggestion: `Replace "${match[0]}" with "${correct}"`
          });
        }
      });

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
            message: 'expected \';\' at end of statement',
            severity: 'warning',
            type: 'Warning',
            suggestion: 'Add ; at the end of the statement'
          });
        }
      }
    });

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

    } // end regex fallback

    // Build corrected code from typo fixes
    if (detectedErrors.length > 0) {
      let corrected = codeText;
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
        'incldue': 'include', 'inlcude': 'include',
        'prnitf': 'printf', 'prinft': 'printf',
        'mian': 'main', 'mainn': 'main',
        'viod': 'void',
      }).forEach(([typo, correct]) => {
        corrected = corrected.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correct);
      });
      setCorrectedCode(corrected);
    } else {
      setCorrectedCode('');
    }

    setErrors(detectedErrors);
    const endTime = performance.now();
    setDetectionTime(endTime - startTime);
    setIsDetecting(false);
  }, [language, getCompilerName, treeSitterReady]);

  // AI-powered deep error detection (runs with delay, replaces local errors when available)
  const detectErrorsAI = useCallback(async (codeText: string) => {
    if (!codeText.trim() || codeText.length < 5) return;
    // Skip if code hasn't changed since last AI check
    if (codeText === lastAiCodeRef.current) return;
    lastAiCodeRef.current = codeText;

    setIsAiDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-code', {
        body: { code: codeText, language, mode: 'live_error_detect' }
      });

      if (error) throw error;

      if (data?.errors && Array.isArray(data.errors)) {
        const mappedErrors: CodeError[] = data.errors.map((e: any) => ({
          line: e.line || 1,
          column: e.column || 1,
          message: e.compilerOutput || e.message || 'Unknown error',
          severity: e.severity === 'warning' ? 'warning' as const : 'error' as const,
          type: e.type || 'Error',
          wrongCode: e.wrongCode,
          correctCode: e.correctCode,
          suggestion: e.suggestion,
        }));

        // Merge AI errors with local errors (AI takes priority, add unique local errors)
        setAiErrors(mappedErrors);
        if (data.correctedCode) {
          setAiCorrectedCode(data.correctedCode);
        }

        // Replace local errors with AI-detected ones (more accurate)
        setErrors(mappedErrors);
        if (data.correctedCode) {
          setCorrectedCode(data.correctedCode);
        }
      }
    } catch {
      // AI failed - keep local errors (offline fallback)
      console.log('AI error detection unavailable, using local detection');
    } finally {
      setIsAiDetecting(false);
    }
  }, [language]);

  // Instant local detection (5ms debounce)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (code.trim()) {
      debounceRef.current = setTimeout(() => {
        detectErrorsLocal(code);
      }, 5);
    } else {
      setErrors([]);
      setCorrectedCode('');
      setAiErrors([]);
      setAiCorrectedCode('');
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [code, language, detectErrorsLocal]);

  // AI deep detection (1.5s debounce - like typing pause)
  useEffect(() => {
    if (aiDetectRef.current) clearTimeout(aiDetectRef.current);
    if (code.trim() && code.length >= 10 && navigator.onLine) {
      aiDetectRef.current = setTimeout(() => {
        detectErrorsAI(code);
      }, 1500);
    }
    return () => { if (aiDetectRef.current) clearTimeout(aiDetectRef.current); };
  }, [code, language, detectErrorsAI]);

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
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for environments where clipboard API is not available
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast({ title: "✅ Copied!", description: "Code copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard", variant: "destructive" });
    }
  };

  const clearEditor = () => {
    setCode('');
    setErrors([]);
    setCorrectedCode('');
    setExecutionResult(null);
    setComplexityAnalysis(null);
    setBestSolution(null);
    toast({ title: "Cleared", description: "Editor content cleared" });
  };

  const saveFile = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "💾 Saved!", description: "File saved as code.txt" });
  };


  const applyErrorFix = (error: CodeError) => {
    if (error.wrongCode && error.correctCode) {
      const codeLines = code.split('\n');
      const lineIndex = error.line - 1;
      if (lineIndex >= 0 && lineIndex < codeLines.length) {
        codeLines[lineIndex] = codeLines[lineIndex].replace(error.wrongCode, error.correctCode);
        setCode(codeLines.join('\n'));
        toast({
          title: "✅ Fix Applied",
          description: `Replaced "${error.wrongCode}" with "${error.correctCode}" on line ${error.line}`,
        });
      }
    } else if (correctedCode) {
      setCode(correctedCode);
      setCorrectedCode('');
      setErrors([]);
      toast({ 
        title: "✅ Fix Applied", 
        description: "Corrected code has been applied to the editor" 
      });
    }
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

  // Detect if code requires user input
  const codeRequiresInput = (codeText: string): boolean => {
    const inputPatterns = [
      /scanf\s*\(/i, /gets\s*\(/i, /getchar\s*\(/i, /fgets\s*\(/i,
      /cin\s*>>/i, /getline\s*\(/i,
      /input\s*\(/i, /raw_input\s*\(/i,
      /Scanner\s*\(/i, /nextLine\s*\(/i, /nextInt\s*\(/i, /next\s*\(/i,
      /readline\s*\(/i, /prompt\s*\(/i,
      /Console\.ReadLine/i, /Console\.Read\b/i,
      /gets\.chomp/i, /STDIN/i,
      /read\s*\(\s*\*/i, /readln/i,
    ];
    return inputPatterns.some(p => p.test(codeText));
  };

  // Execute code via AI backend (like online compiler)
  const executeCodeViaAI = async (codeText: string, lang: string, stdin: string = '') => {
    const { data, error } = await supabase.functions.invoke('analyze-code', {
      body: {
        code: codeText,
        language: lang,
        mode: 'execute_code',
        userInput: stdin
      }
    });

    if (error) throw error;
    return data;
  };

  // Analyze complexity via AI
  const analyzeComplexity = async () => {
    if (!code.trim()) return;
    setIsAnalyzingComplexity(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-code', {
        body: { code, language, mode: 'complexity_analysis' }
      });
      if (error) throw error;

      if (data?.timeComplexity) {
        setComplexityAnalysis({
          timeComplexity: data.timeComplexity || 'N/A',
          spaceComplexity: data.spaceComplexity || 'N/A',
          explanation: data.complexityExplanation || ''
        });
      }
      if (data?.bestSolution) {
        setBestSolution({
          code: data.bestSolution,
          timeComplexity: data.bestTimeComplexity || 'O(n)',
          spaceComplexity: data.bestSpaceComplexity || 'O(1)',
          explanation: data.bestExplanation || 'Optimized solution with better complexity'
        });
      }
    } catch {
      const lowerCode = code.toLowerCase();
      let timeEst = 'O(n)', spaceEst = 'O(1)';
      if (lowerCode.includes('for') && lowerCode.split('for').length > 2) timeEst = 'O(n²)';
      if (lowerCode.includes('sort')) timeEst = 'O(n log n)';
      setComplexityAnalysis({ timeComplexity: timeEst, spaceComplexity: spaceEst, explanation: 'Estimated (run AI for precise results)' });
    } finally {
      setIsAnalyzingComplexity(false);
    }
  };

  // Handle input submission for stdin
  const handleInputSubmit = async () => {
    setWaitingForInput(false);
    setIsAnalyzing(true);
    const startTime = performance.now();

    try {
      const result = await executeCodeViaAI(code, language, userInput);
      const executionTime = performance.now() - startTime;

      setExecutionResult({
        output: result?.hasError ? '' : (result?.output || 'No output'),
        error: result?.hasError ? (result?.errorMessage || 'Compilation error') : undefined,
        executionTime
      });
      analyzeComplexity();
      toast({
        title: result?.hasError ? "⚠️ Compilation Error" : "✅ Execution Complete",
        description: result?.hasError ? "Check errors in output" : `Executed in ${executionTime.toFixed(2)}ms`,
      });
    } catch (error: any) {
      setExecutionResult({ output: '', error: error.message || 'Execution failed', executionTime: 0 });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Execute code and show output
  const runCode = async () => {
    if (!code.trim()) {
      toast({ title: "No code", description: "Please enter some code to run", variant: "destructive" });
      return;
    }

    // Check if code needs input
    if (codeRequiresInput(code)) {
      setWaitingForInput(true);
      setInputPrompt('Enter input for your program:');
      setUserInput('');
      setExecutionResult({
        output: '> Waiting for input...\n> Enter your input below and press Enter',
        executionTime: 0
      });
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    // Execute directly without input
    setIsAnalyzing(true);
    const startTime = performance.now();

    try {
      const result = await executeCodeViaAI(code, language, '');
      const executionTime = performance.now() - startTime;

      if (result?.requiresInput) {
        setWaitingForInput(true);
        setInputPrompt(result.inputPrompt || 'Enter input:');
        setUserInput('');
        setExecutionResult({
          output: (result.inputPrompt || 'Program requires input...') + '\n> Enter input below:',
          executionTime
        });
        setTimeout(() => inputRef.current?.focus(), 100);
        return;
      }

      setExecutionResult({
        output: result?.hasError ? '' : (result?.output || 'No output'),
        error: result?.hasError ? (result?.errorMessage || 'Compilation error') : undefined,
        executionTime
      });
      analyzeComplexity();
      toast({
        title: result?.hasError ? "⚠️ Compilation Error" : "✅ Execution Complete",
        description: result?.hasError ? "Check errors below" : `Executed in ${executionTime.toFixed(2)}ms`,
      });
    } catch (error: any) {
      setExecutionResult({ output: '', error: error.message || 'Unknown execution error', executionTime: 0 });
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
            Run Code
          </label>
          <Button 
            onClick={runCode} 
            disabled={isAnalyzing}
            className="w-full gap-2 neon-glow"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
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
                <Zap className="w-3 h-3" /> Local...
              </span>
            )}
            {isAiDetecting && (
              <span className="text-xs text-purple-400 animate-pulse flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Analyzing...
              </span>
            )}
            {detectionTime > 0 && !isDetecting && !isAiDetecting && (
              <span className="text-xs text-green-400">
                ⚡ {detectionTime.toFixed(2)}ms {treeSitterReady && treeSitterLangRef.current ? '🌳 Tree-sitter' : '⚙️ Regex'} {aiErrors.length > 0 ? '• AI ✓' : ''}
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
            <Button variant="ghost" size="sm" onClick={saveFile} className="h-8 px-2 text-gray-400 hover:text-white hover:bg-[#0f3460]" title="Save">
              <Save className="w-4 h-4" />
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
        <div className="flex relative" style={{ height: '400px' }}>
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

      {/* Output Console - Sky Blue Box with Structured Output */}
      {(executionResult || waitingForInput) && (
        <div className="bg-[#1a1a2e] border-2 border-sky-400/50 rounded-xl overflow-hidden shadow-lg shadow-sky-500/10">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-500/30 to-sky-600/20 border-b border-sky-400/50">
            <span className="text-sm font-bold text-sky-300 flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              🔵 OUTPUT CONSOLE {language.toLowerCase().includes('sql') ? '(SQL Command Prompt)' : ''}
            </span>
            <span className="text-xs text-sky-200">
              {executionResult?.executionTime ? `Execution time: ${executionResult.executionTime.toFixed(2)}ms` : 'Waiting...'}
            </span>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {executionResult?.error ? (
              <div className="text-red-400 font-mono text-sm whitespace-pre-wrap">
                <div className="flex items-center gap-2 mb-2 text-red-500 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  Compilation Error:
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-1">
                  {executionResult.error}
                </div>
              </div>
            ) : (
              <div>
                {/* SQL-style structured output */}
                {language.toLowerCase().includes('sql') && executionResult?.output ? (
                  <div className="space-y-2">
                    <div className="text-xs text-sky-400 font-mono mb-2">
                      mysql{'>'} {code.split('\n')[0]?.substring(0, 80)}
                    </div>
                    <div className="bg-[#0d1117] border border-sky-500/30 rounded-lg overflow-x-auto">
                      <pre className="text-sky-200 font-mono text-sm p-4 whitespace-pre">
{executionResult.output}
                      </pre>
                    </div>
                    <div className="text-xs text-sky-400/70 font-mono mt-1">
                      Query OK. Rows returned in {executionResult.executionTime?.toFixed(2)}ms
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0d1117] border border-sky-500/20 rounded-lg p-4">
                    {/* Compiler header */}
                    <div className="text-xs text-sky-500/80 font-mono mb-2 pb-2 border-b border-sky-500/10">
                      {language === 'Auto-Detect' ? '$ auto-detect' : 
                       language.toLowerCase().includes('c++') || language.toLowerCase().includes('cpp') ? '$ g++ main.cpp -o main && ./main' :
                       language.toLowerCase() === 'c' ? '$ gcc main.c -o main && ./main' :
                       language.toLowerCase().includes('java') ? '$ javac Main.java && java Main' :
                       language.toLowerCase().includes('python') ? '$ python3 main.py' :
                       language.toLowerCase().includes('javascript') || language.toLowerCase().includes('node') ? '$ node main.js' :
                       language.toLowerCase().includes('rust') ? '$ rustc main.rs && ./main' :
                       language.toLowerCase().includes('go') ? '$ go run main.go' :
                       language.toLowerCase().includes('ruby') ? '$ ruby main.rb' :
                       language.toLowerCase().includes('php') ? '$ php main.php' :
                       language.toLowerCase().includes('swift') ? '$ swift main.swift' :
                       language.toLowerCase().includes('kotlin') ? '$ kotlinc main.kt -include-runtime -d main.jar && java -jar main.jar' :
                       language.toLowerCase().includes('c#') || language.toLowerCase().includes('csharp') ? '$ dotnet run' :
                       language.toLowerCase().includes('typescript') ? '$ ts-node main.ts' :
                       `$ run ${language.toLowerCase()}`}
                    </div>
                    <pre className="text-sky-100 font-mono text-sm whitespace-pre-wrap leading-relaxed">
{executionResult?.output}
                    </pre>
                    <div className="text-xs text-sky-500/60 font-mono mt-3 pt-2 border-t border-sky-500/10">
                      Process exited with code 0 • {executionResult?.executionTime?.toFixed(2)}ms
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Input prompt with blinking cursor */}
            {waitingForInput && (
              <div className="mt-3 border-t border-sky-400/30 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-400 font-mono text-sm">{'>'}</span>
                  <span className="text-yellow-300 text-sm font-mono">{inputPrompt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-mono animate-pulse">{'▊'}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInputSubmit();
                    }}
                    placeholder="Type your input here and press Enter..."
                    className="flex-1 bg-transparent border-b border-sky-400/30 text-sky-100 font-mono text-sm outline-none placeholder:text-sky-600 caret-green-400"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleInputSubmit}
                    disabled={isAnalyzing}
                    className="h-7 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs"
                  >
                    {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Run ▶'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Console Output Panels */}
      <div className="space-y-4">
        {/* Compiler-Style Error Console */}
        {errors.length > 0 && (
          <div className="bg-[#0d1117] border-2 border-red-500/50 rounded-xl overflow-hidden shadow-lg shadow-red-500/10">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-900/40 to-[#0d1117] border-b border-red-500/30">
              <span className="text-sm font-bold text-red-400 flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                🔴 {getCompilerName(language).toUpperCase()} COMPILER OUTPUT ({errors.length} issue{errors.length !== 1 ? 's' : ''})
              </span>
              <span className="text-xs text-red-300/70">
                {aiErrors.length > 0 ? '🤖 AI-Powered' : treeSitterReady && treeSitterLangRef.current ? '🌳 Tree-sitter' : '⚡ Local'} | {language} | {!navigator.onLine ? '📴 Offline Mode' : 'Live'}
              </span>
            </div>
            
            {/* Compiler output style - monospace terminal */}
            <div className="p-3 max-h-[350px] overflow-y-auto font-mono text-xs bg-[#0d1117]">
              {/* Compiler invocation line */}
              <div className="text-gray-500 mb-2 pb-2 border-b border-gray-800">
                $ {language.toLowerCase() === 'c' ? 'gcc -Wall -Wextra main.c -o main' :
                   language.toLowerCase().includes('c++') || language.toLowerCase().includes('cpp') ? 'g++ -Wall -Wextra main.cpp -o main' :
                   language.toLowerCase().includes('python') ? 'python3 -c "import py_compile; py_compile.compile(\'main.py\')"' :
                   language.toLowerCase().includes('java') && !language.toLowerCase().includes('javascript') ? 'javac Main.java' :
                   language.toLowerCase().includes('rust') ? 'rustc main.rs' :
                   language.toLowerCase().includes('go') ? 'go build main.go' :
                   `${getCompilerName(language)} source`}
              </div>

              {errors.map((error, index) => (
                <div key={index} className="mb-3">
                  {/* Compiler-style error line */}
                  <div className={`${error.severity === 'warning' ? 'text-yellow-400' : 'text-red-400'} leading-relaxed`}>
                    {formatCompilerError(error, language)}
                  </div>
                  
                  {/* Source code context */}
                  {error.wrongCode && (
                    <div className="mt-1 ml-4">
                      <span className="text-gray-500">{error.line} | </span>
                      <span className="text-red-300">{error.wrongCode}</span>
                      <div className="text-green-400">
                        <span className="text-gray-500">{'  '} | </span>
                        <span className="text-green-400">^ {error.correctCode ? `fix: ${error.correctCode}` : error.suggestion}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Fix button */}
                  {(error.correctCode || error.suggestion) && (
                    <div className="mt-1 ml-4 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => applyErrorFix(error)}
                        className="h-6 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 text-xs font-mono"
                      >
                        <ArrowRight className="w-3 h-3 mr-1" />
                        Apply Fix
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {/* Summary line */}
              <div className="mt-2 pt-2 border-t border-gray-800 text-gray-400">
                {errorCount > 0 ? `${errorCount} error${errorCount !== 1 ? 's' : ''}` : ''}
                {errorCount > 0 && warningCount > 0 ? ' and ' : ''}
                {warningCount > 0 ? `${warningCount} warning${warningCount !== 1 ? 's' : ''}` : ''}
                {' '}generated.
              </div>
            </div>
          </div>
        )}

        {/* Corrected Code Console - Green (Apply All) */}
        {correctedCode && correctedCode !== code && (
          <div className="bg-[#1a1a2e] border-2 border-green-500/50 rounded-xl overflow-hidden shadow-lg shadow-green-500/10">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500/30 to-green-600/20 border-b border-green-500/50">
              <span className="text-sm font-bold text-green-400 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                🟢 CORRECTED CODE (All Fixes)
              </span>
              <Button 
                variant="default" 
                size="sm" 
                onClick={applyCorrectedCode}
                className="h-8 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Apply All Fixes
              </Button>
            </div>
            <div className="p-4 max-h-[200px] overflow-y-auto">
              <pre 
                className="text-sm text-green-300 font-mono whitespace-pre-wrap leading-relaxed"
                style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}
              >
                {correctedCode}
              </pre>
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

        {/* Orange Box - Time & Space Complexity */}
        {complexityAnalysis && (
          <div className="bg-[#1a1a2e] border-2 border-orange-500/50 rounded-xl overflow-hidden shadow-lg shadow-orange-500/10">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500/30 to-orange-600/20 border-b border-orange-500/50">
              <span className="text-sm font-bold text-orange-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                🟠 COMPLEXITY ANALYSIS
              </span>
              {isAnalyzingComplexity && (
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              )}
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-orange-500/10 rounded-lg p-3 text-center border border-orange-500/20">
                  <p className="text-xs text-orange-300 mb-1">⏱️ Time Complexity</p>
                  <p className="text-2xl font-bold text-orange-400 font-mono">{complexityAnalysis.timeComplexity}</p>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-3 text-center border border-orange-500/20">
                  <p className="text-xs text-orange-300 mb-1">💾 Space Complexity</p>
                  <p className="text-2xl font-bold text-orange-400 font-mono">{complexityAnalysis.spaceComplexity}</p>
                </div>
              </div>
              {complexityAnalysis.explanation && (
                <p className="text-sm text-orange-300/80 italic">{complexityAnalysis.explanation}</p>
              )}
            </div>
          </div>
        )}

        {/* Black Box - World Best Solution */}
        {bestSolution && (
          <div className="bg-[#0a0a0a] border-2 border-gray-600/50 rounded-xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-600/50">
              <span className="text-sm font-bold text-gray-200 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                ⬛ WORLD BEST OPTIMIZED SOLUTION
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Time: {bestSolution.timeComplexity}</span>
                <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Space: {bestSolution.spaceComplexity}</span>
              </div>
            </div>
            <div className="p-4">
              <pre 
                className="text-sm text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[250px] overflow-y-auto bg-[#111] p-3 rounded-lg"
                style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}
              >
                {bestSolution.code}
              </pre>
              <p className="text-xs text-gray-500 mt-3 italic">{bestSolution.explanation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCodeIDE;
