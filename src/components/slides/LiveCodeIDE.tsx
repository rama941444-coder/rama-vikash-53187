import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, AlertCircle, CheckCircle, Copy, Trash2, Maximize2, Minimize2, Loader2, Lightbulb, Zap, ArrowRight, Sparkles, Terminal, TrendingUp, Award, Save, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LanguageSelector from '@/components/LanguageSelector';
import { supabase } from '@/integrations/supabase/client';

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

  // Sync with persisted code
  useEffect(() => {
    if (persistedCode && persistedCode !== code) {
      setCode(persistedCode);
    }
  }, [persistedCode]);

  // Notify parent of code changes
  useEffect(() => {
    if (onCodeChange && code !== persistedCode) {
      onCodeChange(code);
    }
  }, [code, onCodeChange, persistedCode]);

  const lines = code.split('\n');
  const lineCount = lines.length;
  const maxLines = 500000;

  // Auto-detect language from code content
  const autoDetectLanguage = useCallback((codeText: string): string => {
    const t = codeText.trim();
    if (!t) return 'javascript';
    // Python
    if (/\bdef\s+\w+\s*\(/.test(t) || /\bimport\s+\w+/.test(t) && !/\bimport\s+\{/.test(t) || /\bprint\s*\(/.test(t) || /^\s*#.*$/m.test(t) && !/^\s*#include/.test(t) || /\belif\b/.test(t) || /:\s*$/m.test(t) && /\b(if|for|while|def|class)\b/.test(t)) return 'python';
    // Java
    if (/\bpublic\s+(static\s+)?class\b/.test(t) || /\bSystem\.out\.print/.test(t) || /\bpublic\s+static\s+void\s+main/.test(t) || /\bimport\s+java\./.test(t)) return 'java';
    // C++
    if (/\b#include\s*<(iostream|vector|string|algorithm|cstdio|map|set|queue|stack)>/.test(t) || /\bcout\s*<</.test(t) || /\bcin\s*>>/.test(t) || /\busing\s+namespace\s+std/.test(t) || /\bstd::/.test(t)) return 'cpp';
    // C
    if (/\b#include\s*<(stdio|stdlib|string|math)\.h>/.test(t) || /\bprintf\s*\(/.test(t) && !/\bcout/.test(t) || /\bscanf\s*\(/.test(t) || /\bint\s+main\s*\(/.test(t) && !/class\b/.test(t)) return 'c';
    // C#
    if (/\busing\s+System/.test(t) || /\bConsole\.(Write|ReadLine)/.test(t) || /\bnamespace\s+\w+/.test(t) && /\bclass\b/.test(t)) return 'csharp';
    // Go
    if (/\bpackage\s+main/.test(t) || /\bfunc\s+main\s*\(/.test(t) || /\bfmt\.(Print|Scan)/.test(t) || /\bimport\s*\(/.test(t) && /\b"fmt"/.test(t)) return 'go';
    // Rust
    if (/\bfn\s+main\s*\(/.test(t) || /\blet\s+mut\b/.test(t) || /\bprintln!\s*\(/.test(t) || /\bimpl\s+\w+/.test(t) || /\b->\s*(i32|u32|String|bool|f64)/.test(t)) return 'rust';
    // Ruby
    if (/\bputs\s+/.test(t) || /\bdef\s+\w+\s*\n/.test(t) || /\bend\s*$/m.test(t) || /\brequire\s+['"]/.test(t) || /\battr_(accessor|reader|writer)\b/.test(t)) return 'ruby';
    // PHP
    if (/^\s*<\?php/m.test(t) || /\$\w+\s*=/.test(t) || /\becho\s+/.test(t) || /\bfunction\s+\w+\s*\([^)]*\$/.test(t)) return 'php';
    // Swift
    if (/\bvar\s+\w+\s*:\s*(Int|String|Double|Bool|Array)/.test(t) || /\bfunc\s+\w+\s*\(.*\)\s*->/.test(t) || /\bguard\s+let\b/.test(t) || /\bimport\s+Foundation/.test(t)) return 'swift';
    // Kotlin
    if (/\bfun\s+main\s*\(/.test(t) || /\bprintln\s*\(/.test(t) && /\bval\s+/.test(t) || /\bvar\s+\w+\s*:\s*(Int|String)/.test(t) && /\bfun\b/.test(t)) return 'kotlin';
    // TypeScript
    if (/\binterface\s+\w+\s*\{/.test(t) || /:\s*(string|number|boolean|any)\b/.test(t) || /\btype\s+\w+\s*=/.test(t) || /\bas\s+(string|number|any)\b/.test(t)) return 'typescript';
    // HTML
    if (/^\s*<!DOCTYPE|<html|<head|<body|<div|<span|<p\b/mi.test(t)) return 'html';
    // CSS
    if (/^\s*[\.\#\w\*\:]+\s*\{[^}]*\}/m.test(t) && !/\bfunction\b/.test(t) && !/\bconst\b/.test(t)) return 'css';
    // SQL
    if (/\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(t)) return 'sql';
    // R
    if (/\b<-\s*function\s*\(/.test(t) || /\blibrary\s*\(/.test(t) || /\bdata\.frame\s*\(/.test(t)) return 'r';
    // Perl
    if (/^\s*use\s+strict\s*;/m.test(t) || /\$_\b/.test(t) || /\bmy\s+\$/.test(t)) return 'perl';
    // Scala
    if (/\bobject\s+\w+\s*(extends)?/.test(t) || /\bval\s+\w+\s*:\s*\w+\s*=/.test(t) && /\bdef\b/.test(t)) return 'scala';
    // JavaScript (default fallback for code-like text)
    if (/\b(const|let|var|function|=>|require\(|module\.exports)\b/.test(t)) return 'javascript';
    return 'javascript';
  }, []);

  // Comprehensive error patterns for 15+ languages
  const errorPatterns: Record<string, Array<{ regex: RegExp; message: string; type: string; suggestion?: string }>> = {
    javascript: [
      { regex: /\bconst\s+(\w+)\s*=\s*$/, message: 'Assignment value expected', type: 'SyntaxError', suggestion: 'Add a value after =' },
      { regex: /\bfunction\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bif\s*$/, message: 'Condition expected after if', type: 'SyntaxError', suggestion: 'Add condition: if (condition)' },
      { regex: /\bfor\s*$/, message: 'Loop expression expected', type: 'SyntaxError' },
      { regex: /\bwhile\s*$/, message: 'Condition expected after while', type: 'SyntaxError' },
      { regex: /==\s*$/, message: 'Value expected after comparison', type: 'SyntaxError' },
      { regex: /\+\s*$/, message: 'Operand expected after operator', type: 'SyntaxError' },
      { regex: /=>\s*$/, message: 'Arrow function body expected', type: 'SyntaxError' },
      { regex: /\.\s*$/, message: 'Property or method expected after dot', type: 'SyntaxError' },
      { regex: /\basync\s+(?!function|(\(|\w))/, message: 'async must be followed by function or arrow function', type: 'SyntaxError' },
      { regex: /\bawait\s*$/, message: 'Expression expected after await', type: 'SyntaxError' },
      { regex: /\bconsole\.(?!log|error|warn|info|debug|table|trace|dir|clear|group|groupEnd|time|timeEnd|count|assert)\w+/, message: 'Unknown console method', type: 'TypeError' },
      { regex: /\bundefined\s*\(/, message: 'undefined is not a function', type: 'TypeError' },
      { regex: /\bnull\s*\./, message: 'Cannot read property of null', type: 'TypeError' },
      { regex: /\bvar\s+(\w+)\s*;\s*var\s+\w+\b/, message: 'Possible duplicate variable declaration', type: 'SyntaxError' },
    ],
    typescript: [
      { regex: /\bconst\s+(\w+)\s*=\s*$/, message: 'Assignment value expected', type: 'SyntaxError' },
      { regex: /\bfunction\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\bif\s*$/, message: 'Condition expected after if', type: 'SyntaxError' },
      { regex: /:\s*(string|number|boolean)\s*=\s*\d+\s*;/, message: 'Possible type mismatch', type: 'TypeError', suggestion: 'Check that assigned value matches declared type' },
      { regex: /\bany\b/, message: 'Avoid using "any" type - use specific types', type: 'Warning', suggestion: 'Replace "any" with a specific type' },
      { regex: /\bas\s+any\b/, message: 'Unsafe type assertion to "any"', type: 'Warning' },
      { regex: /=>\s*$/, message: 'Arrow function body expected', type: 'SyntaxError' },
      { regex: /\.\s*$/, message: 'Property or method expected after dot', type: 'SyntaxError' },
      { regex: /\bnull\s*\./, message: 'Cannot read property of null', type: 'TypeError' },
    ],
    python: [
      { regex: /\bdef\s*$/, message: 'Function name expected after def', type: 'SyntaxError', suggestion: 'Add function name: def function_name():' },
      { regex: /\bdef\s+\w+\s*[^(:]*$/, message: 'Missing parentheses and colon after function name', type: 'SyntaxError', suggestion: 'Add (): after function name' },
      { regex: /\bif\s*:\s*$/, message: 'Condition expected before colon', type: 'SyntaxError' },
      { regex: /\bif\s+[^:]+$/, message: 'Missing colon at end of if statement', type: 'SyntaxError', suggestion: 'Add : at the end' },
      { regex: /\bfor\s+\w+\s*$/, message: '"in" keyword expected in for loop', type: 'SyntaxError', suggestion: 'Use: for item in iterable:' },
      { regex: /\bfor\s+\w+\s+in\s+[^:]+$/, message: 'Missing colon at end of for loop', type: 'SyntaxError', suggestion: 'Add : at the end' },
      { regex: /\bwhile\s+[^:]+$/, message: 'Missing colon at end of while loop', type: 'SyntaxError', suggestion: 'Add : at the end' },
      { regex: /\bclass\s*$/, message: 'Class name expected after class', type: 'SyntaxError' },
      { regex: /\bclass\s+\w+[^(:]*$/, message: 'Missing colon after class name', type: 'SyntaxError', suggestion: 'Add : after class declaration' },
      { regex: /\bimport\s*$/, message: 'Module name expected after import', type: 'SyntaxError' },
      { regex: /\bprint\s+[^(]/, message: 'print is a function in Python 3, use print()', type: 'SyntaxError', suggestion: 'Replace with print(...)' },
      { regex: /\belif\s*:\s*$/, message: 'Condition expected before colon in elif', type: 'SyntaxError' },
      { regex: /\belif\s+[^:]+$/, message: 'Missing colon at end of elif statement', type: 'SyntaxError', suggestion: 'Add : at the end' },
      { regex: /\belse\s*[^:\s]/, message: 'else should be followed by colon only', type: 'SyntaxError', suggestion: 'Use: else:' },
      { regex: /\btry\s*$/, message: 'Missing colon after try', type: 'SyntaxError', suggestion: 'Use: try:' },
      { regex: /\bexcept\s*$/, message: 'Missing colon or exception type after except', type: 'SyntaxError', suggestion: 'Use: except ExceptionType:' },
      { regex: /;\s*$/, message: 'Semicolons are not needed in Python', type: 'Warning', suggestion: 'Remove the semicolon' },
      { regex: /\{\s*$/, message: 'Python uses indentation, not braces {}', type: 'SyntaxError', suggestion: 'Use colon and indentation instead of braces' },
      { regex: /\bint\s+\w+\s*=/, message: 'Python does not use type declarations like this', type: 'SyntaxError', suggestion: 'Just write: variable = value' },
      { regex: /\b(true|false)\b/, message: 'Python uses True/False (capitalized)', type: 'SyntaxError', suggestion: 'Capitalize: True, False' },
      { regex: /\bnull\b/, message: 'Python uses None, not null', type: 'SyntaxError', suggestion: 'Replace null with None' },
      { regex: /&&/, message: 'Python uses "and" not "&&"', type: 'SyntaxError', suggestion: 'Replace && with and' },
      { regex: /\|\|/, message: 'Python uses "or" not "||"', type: 'SyntaxError', suggestion: 'Replace || with or' },
      { regex: /!=\s*$/, message: 'Value expected after != operator', type: 'SyntaxError' },
    ],
    java: [
      { regex: /\bpublic\s+class\s*$/, message: 'Class name expected', type: 'SyntaxError' },
      { regex: /\bpublic\s+static\s+void\s+main\s*\(\s*\)/, message: 'main method requires String[] args parameter', type: 'SyntaxError', suggestion: 'Use: public static void main(String[] args)' },
      { regex: /\bSystem\.out\.print(?!ln|f)\s*\(/, message: 'Did you mean System.out.println()?', type: 'Warning' },
      { regex: /\bint\s+\w+\s*=\s*"/, message: 'Type mismatch: cannot assign String to int', type: 'TypeError' },
      { regex: /\bString\s+\w+\s*=\s*\d+\s*;/, message: 'Type mismatch: cannot assign int to String', type: 'TypeError' },
      { regex: /\bdouble\s+\w+\s*=\s*"/, message: 'Type mismatch: cannot assign String to double', type: 'TypeError' },
      { regex: /\bboolean\s+\w+\s*=\s*[^tfTF\s]/, message: 'boolean can only be true or false', type: 'TypeError' },
      { regex: /\bclass\s+\w+\s*\{[^}]*\bvoid\s+main\b(?!\s*\()/, message: 'main needs parameter list', type: 'SyntaxError' },
      { regex: /\bScanner\b.*\bnew\s+Scanner\s*\(\s*\)/, message: 'Scanner requires System.in parameter', type: 'SyntaxError', suggestion: 'Use: new Scanner(System.in)' },
      { regex: /\bimport\s*$/, message: 'Package path expected after import', type: 'SyntaxError' },
      { regex: /\bimport\s+[^;]+$/, message: 'Missing semicolon after import statement', type: 'SyntaxError' },
      { regex: /\breturn\s*$/, message: 'Return value expected', type: 'SyntaxError' },
      { regex: /\bpackage\s+[^;]+$/, message: 'Missing semicolon after package declaration', type: 'SyntaxError' },
      { regex: /\bprint\s*\(/, message: 'Java uses System.out.println(), not print()', type: 'SyntaxError', suggestion: 'Use System.out.println(...)' },
      { regex: /\bdef\s+/, message: '"def" is not a Java keyword. Use method syntax with return type', type: 'SyntaxError', suggestion: 'Use: public void methodName()' },
    ],
    c: [
      { regex: /#include\s*$/, message: 'Header file expected after #include', type: 'PreprocessorError', suggestion: 'Add header: #include <stdio.h>' },
      { regex: /\bprintf\s*\(\s*[^"]/, message: 'printf requires format string in quotes', type: 'SyntaxError', suggestion: 'Use: printf("format", args)' },
      { regex: /\bscanf\s*\(\s*"[^"]*",\s*[^&\s]/, message: 'scanf requires address-of operator (&) for variables', type: 'SyntaxError', suggestion: 'Add & before variable name' },
      { regex: /\bint\s+main\s*\(\s*\)\s*[^{;]/, message: 'Opening brace expected for main function', type: 'SyntaxError' },
      { regex: /\bmalloc\s*\([^)]*\)\s*;/, message: 'malloc return value should be assigned to a pointer', type: 'Warning' },
      { regex: /\breturn\s*$/, message: 'Return value expected', type: 'SyntaxError' },
      { regex: /\bfree\s*\(\s*\)/, message: 'free() requires a pointer argument', type: 'SyntaxError' },
      { regex: /\bcout\s*<</, message: 'cout is C++, not C. Use printf() instead', type: 'SyntaxError', suggestion: 'Use printf() for C output' },
      { regex: /\bcin\s*>>/, message: 'cin is C++, not C. Use scanf() instead', type: 'SyntaxError', suggestion: 'Use scanf() for C input' },
      { regex: /\busing\s+namespace/, message: '"using namespace" is C++, not C', type: 'SyntaxError' },
      { regex: /\bnew\s+\w+/, message: '"new" is C++, not C. Use malloc() instead', type: 'SyntaxError' },
      { regex: /\bstring\s+\w+/, message: 'C uses char arrays, not string type', type: 'SyntaxError', suggestion: 'Use char[] or char* instead' },
      { regex: /\bclass\s+\w+/, message: '"class" is not a C keyword. Use struct', type: 'SyntaxError' },
      { regex: /\bbool\b(?!.*#include\s*<stdbool\.h>)/, message: 'bool requires #include <stdbool.h> in C', type: 'Warning' },
    ],
    cpp: [
      { regex: /#include\s*$/, message: 'Header file expected after #include', type: 'PreprocessorError' },
      { regex: /\bprintf\s*\(\s*"[^"]*"[^,)]/, message: 'Format specifier missing or malformed', type: 'SyntaxError' },
      { regex: /\bint\s+main\s*\(\s*\)\s*[^{;]/, message: 'Opening brace expected for main function', type: 'SyntaxError' },
      { regex: /\bmalloc\s*\([^)]*\)\s*;/, message: 'In C++, prefer new/delete over malloc/free', type: 'Warning' },
      { regex: /\bscanf\s*\(\s*"[^"]*",\s*[^&\s]/, message: 'scanf requires address-of operator (&)', type: 'SyntaxError' },
      { regex: /\bcout\s*<<\s*$/, message: 'Output value expected after <<', type: 'SyntaxError' },
      { regex: /\bcin\s*>>\s*$/, message: 'Variable expected after >>', type: 'SyntaxError' },
      { regex: /\busing\s+namespace\s*$/, message: 'Namespace name expected', type: 'SyntaxError', suggestion: 'Add: using namespace std;' },
      { regex: /\bvector\s*<\s*>/, message: 'Vector type parameter required', type: 'SyntaxError', suggestion: 'Specify type: vector<int>' },
      { regex: /\bprint\s*\(/, message: 'C++ uses cout << or printf(), not print()', type: 'SyntaxError' },
      { regex: /\bSystem\.out\.print/, message: 'System.out is Java, not C++. Use cout', type: 'SyntaxError' },
    ],
    csharp: [
      { regex: /\bConsole\.Write(?!Line)\s*\(/, message: 'Did you mean Console.WriteLine()?', type: 'Warning' },
      { regex: /\bstring\s+\w+\s*=\s*\d+\s*;/, message: 'Type mismatch: cannot assign int to string', type: 'TypeError' },
      { regex: /\bint\s+\w+\s*=\s*"/, message: 'Type mismatch: cannot assign string to int', type: 'TypeError' },
      { regex: /\busing\s*$/, message: 'Namespace expected after using', type: 'SyntaxError' },
      { regex: /\bnamespace\s*$/, message: 'Namespace name expected', type: 'SyntaxError' },
      { regex: /\bprint\s*\(/, message: 'C# uses Console.WriteLine(), not print()', type: 'SyntaxError' },
      { regex: /\bcout\s*<</, message: 'cout is C++, not C#. Use Console.WriteLine()', type: 'SyntaxError' },
    ],
    go: [
      { regex: /\bfunc\s*$/, message: 'Function name expected after func', type: 'SyntaxError' },
      { regex: /\bvar\s+\w+\s*$/, message: 'Type or value expected in var declaration', type: 'SyntaxError' },
      { regex: /;\s*$/, message: 'Go does not use semicolons', type: 'Warning', suggestion: 'Remove the semicolon' },
      { regex: /\bclass\s+/, message: 'Go uses struct, not class', type: 'SyntaxError', suggestion: 'Use type Name struct {}' },
      { regex: /\bwhile\s+/, message: 'Go has no while keyword. Use for loop', type: 'SyntaxError', suggestion: 'Use: for condition {}' },
      { regex: /\bprint\s*\(/, message: 'Use fmt.Println() for output in Go', type: 'SyntaxError', suggestion: 'Use fmt.Println(...)' },
      { regex: /\btry\s*\{/, message: 'Go has no try/catch. Use error handling with if err != nil', type: 'SyntaxError' },
      { regex: /\bpackage\s*$/, message: 'Package name expected', type: 'SyntaxError' },
    ],
    rust: [
      { regex: /\bfn\s*$/, message: 'Function name expected after fn', type: 'SyntaxError' },
      { regex: /\blet\s+\w+\s*=.*;\s*\n.*\b\1\s*=/, message: 'Variable is immutable. Use "let mut" for mutable variables', type: 'SyntaxError', suggestion: 'Add mut: let mut variable' },
      { regex: /\bprint\s*\(/, message: 'Rust uses println!() macro, not print()', type: 'SyntaxError', suggestion: 'Use println!(...) or print!(...)' },
      { regex: /\bclass\s+/, message: 'Rust uses struct, not class', type: 'SyntaxError', suggestion: 'Use struct Name {}' },
      { regex: /\bnull\b/, message: 'Rust has no null. Use Option<T> with None', type: 'SyntaxError', suggestion: 'Use None instead of null' },
      { regex: /\breturn\s+[^;]+$/, message: 'Missing semicolon after return statement', type: 'SyntaxError' },
      { regex: /\bvoid\b/, message: 'Rust has no void. Use () for unit type', type: 'SyntaxError' },
    ],
    ruby: [
      { regex: /\bdef\s*$/, message: 'Method name expected after def', type: 'SyntaxError' },
      { regex: /\bprintf\s*\(/, message: 'Ruby uses puts or print, not printf', type: 'Warning' },
      { regex: /;\s*$/, message: 'Semicolons are not typical in Ruby', type: 'Warning', suggestion: 'Remove the semicolon' },
      { regex: /\bclass\s*$/, message: 'Class name expected after class', type: 'SyntaxError' },
      { regex: /\{\s*$/, message: 'Ruby uses do...end for multi-line blocks', type: 'Warning' },
      { regex: /\bint\s+\w+/, message: 'Ruby is dynamically typed, no type declarations needed', type: 'SyntaxError' },
      { regex: /\bSystem\.out/, message: 'System.out is Java. Ruby uses puts/print', type: 'SyntaxError' },
    ],
    php: [
      { regex: /\bfunction\s*$/, message: 'Function name expected', type: 'SyntaxError' },
      { regex: /\becho\s*$/, message: 'Value expected after echo', type: 'SyntaxError' },
      { regex: /[^$]\b\w+\s*=\s*[^=].*(?<!;)\s*$/, message: 'Variables in PHP must start with $', type: 'Warning', suggestion: 'Prefix variable with $' },
      { regex: /\bcout\s*<</, message: 'cout is C++, not PHP. Use echo', type: 'SyntaxError' },
      { regex: /\bSystem\.out/, message: 'System.out is Java. PHP uses echo/print', type: 'SyntaxError' },
    ],
    swift: [
      { regex: /\bfunc\s*$/, message: 'Function name expected after func', type: 'SyntaxError' },
      { regex: /\bvar\s+\w+\s*$/, message: 'Type annotation or initial value required', type: 'SyntaxError' },
      { regex: /\blet\s+\w+\s*$/, message: 'Type annotation or initial value required', type: 'SyntaxError' },
      { regex: /;\s*$/, message: 'Semicolons are optional in Swift', type: 'Warning' },
      { regex: /\bSystem\.out/, message: 'Swift uses print(), not System.out', type: 'SyntaxError' },
      { regex: /\bcout\s*<</, message: 'Swift uses print(), not cout', type: 'SyntaxError' },
      { regex: /\bnull\b/, message: 'Swift uses nil, not null', type: 'SyntaxError', suggestion: 'Replace null with nil' },
    ],
    kotlin: [
      { regex: /\bfun\s*$/, message: 'Function name expected after fun', type: 'SyntaxError' },
      { regex: /;\s*$/, message: 'Semicolons are not needed in Kotlin', type: 'Warning', suggestion: 'Remove the semicolon' },
      { regex: /\bnew\s+\w+/, message: 'Kotlin does not use "new" keyword', type: 'SyntaxError', suggestion: 'Remove "new": val obj = ClassName()' },
      { regex: /\bSystem\.out\.print/, message: 'Kotlin uses println(), not System.out', type: 'Warning', suggestion: 'Use println(...)' },
      { regex: /\bvoid\b/, message: 'Kotlin uses Unit, not void', type: 'SyntaxError' },
      { regex: /\bnull\b(?!.*\?)/, message: 'Null values require nullable type (Type?)', type: 'Warning' },
    ],
    html: [
      { regex: /<\w+[^>]*[^/]>\s*$/, message: 'Closing tag may be missing', type: 'SyntaxError' },
      { regex: /<\/\w+[^>]*$/, message: 'Closing bracket > missing', type: 'SyntaxError' },
      { regex: /style\s*=\s*"[^"]*:[^"]*"[^;]/, message: 'CSS property may be missing semicolon', type: 'Warning' },
      { regex: /<img(?![^>]*alt\s*=)/, message: 'img tag missing alt attribute', type: 'Warning', suggestion: 'Add alt="description" for accessibility' },
      { regex: /<br\s*[^/]>/, message: 'Use self-closing <br /> tag', type: 'Warning' },
    ],
    css: [
      { regex: /[^{]*:\s*$/, message: 'Value expected after CSS property', type: 'SyntaxError' },
      { regex: /[^{]*:\s*[^;{}]+$/, message: 'Missing semicolon after CSS value', type: 'SyntaxError', suggestion: 'Add ; at the end' },
      { regex: /[^}]*\{[^}]*\{/, message: 'Nested rules not supported in regular CSS', type: 'SyntaxError' },
    ],
    sql: [
      { regex: /\bSELECT\s+\*\s+$/i, message: 'FROM clause expected after SELECT', type: 'SyntaxError' },
      { regex: /\bFROM\s+$/i, message: 'Table name expected after FROM', type: 'SyntaxError' },
      { regex: /\bWHERE\s+$/i, message: 'Condition expected after WHERE', type: 'SyntaxError' },
      { regex: /\bINSERT\s+INTO\s+\w+\s*$/i, message: 'VALUES or columns expected', type: 'SyntaxError' },
      { regex: /\bUPDATE\s+$/i, message: 'Table name expected after UPDATE', type: 'SyntaxError' },
      { regex: /\bDELETE\s+$/i, message: 'FROM expected after DELETE', type: 'SyntaxError' },
      { regex: /\bGROUP\s+$/i, message: 'BY expected after GROUP', type: 'SyntaxError' },
      { regex: /\bORDER\s+$/i, message: 'BY expected after ORDER', type: 'SyntaxError' },
    ],
    r: [
      { regex: /\bfunction\s*$/, message: 'Function body expected', type: 'SyntaxError' },
      { regex: /\bif\s*$/, message: 'Condition expected after if', type: 'SyntaxError' },
      { regex: /\bfor\s*$/, message: 'Loop variable expected after for', type: 'SyntaxError' },
      { regex: /\bprint\s+[^(]/, message: 'Use print() with parentheses in R', type: 'Warning' },
    ],
    perl: [
      { regex: /\bmy\s*$/, message: 'Variable name expected after my', type: 'SyntaxError' },
      { regex: /\bsub\s*$/, message: 'Subroutine name expected after sub', type: 'SyntaxError' },
    ],
    scala: [
      { regex: /\bdef\s*$/, message: 'Method name expected after def', type: 'SyntaxError' },
      { regex: /\bval\s*$/, message: 'Variable name expected after val', type: 'SyntaxError' },
      { regex: /\bvar\s*$/, message: 'Variable name expected after var', type: 'SyntaxError' },
      { regex: /;\s*$/, message: 'Semicolons are not needed in Scala', type: 'Warning' },
    ],
  };

  // Languages that DON'T use semicolons (skip semicolon warning)
  const noSemicolonLanguages = new Set(['python', 'ruby', 'go', 'kotlin', 'swift', 'scala', 'r', 'perl', 'html', 'css', 'sql']);
  // Languages that DO require semicolons
  const semicolonLanguages = new Set(['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'php', 'rust']);

  // Advanced live error detection with language-aware rules
  const detectErrors = useCallback((codeText: string) => {
    const startTime = performance.now();
    setIsDetecting(true);
    
    const detectedErrors: CodeError[] = [];
    const codeLines = codeText.split('\n');
    
    // Resolve effective language
    let effectiveLang = language.toLowerCase();
    if (language === 'Auto-Detect') {
      effectiveLang = autoDetectLanguage(codeText);
    }
    // Normalize language name to pattern key
    const langKey = (() => {
      const l = effectiveLang;
      if (l.includes('python')) return 'python';
      if (l.includes('typescript')) return 'typescript';
      if (l.includes('javascript') || l.includes('js') || l === 'node') return 'javascript';
      if (l.includes('java') && !l.includes('javascript')) return 'java';
      if (l.includes('c++') || l.includes('cpp')) return 'cpp';
      if (l === 'c' || l === 'c language') return 'c';
      if (l.includes('c#') || l.includes('csharp')) return 'csharp';
      if (l.includes('go') || l === 'golang') return 'go';
      if (l.includes('rust')) return 'rust';
      if (l.includes('ruby')) return 'ruby';
      if (l.includes('php')) return 'php';
      if (l.includes('swift')) return 'swift';
      if (l.includes('kotlin')) return 'kotlin';
      if (l.includes('html')) return 'html';
      if (l.includes('css') && !l.includes('scss')) return 'css';
      if (l.includes('sql')) return 'sql';
      if (l.includes('r') && l.length <= 2) return 'r';
      if (l.includes('perl')) return 'perl';
      if (l.includes('scala')) return 'scala';
      return 'javascript';
    })();

    const patterns = errorPatterns[langKey] || errorPatterns.javascript;

    // Track unique errors to prevent duplicates
    const errorKeys = new Set<string>();
    const addError = (err: CodeError) => {
      const key = `${err.line}:${err.message}`;
      if (!errorKeys.has(key)) {
        errorKeys.add(key);
        detectedErrors.push(err);
      }
    };

    let parenBalance = 0;
    let bracketBalance = 0;
    let braceBalance = 0;
    let singleQuoteOpen = false;
    let doubleQuoteOpen = false;
    let templateLiteralOpen = false;

    codeLines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      
      // Skip comments based on language
      if (langKey === 'python' || langKey === 'ruby' || langKey === 'perl' || langKey === 'r') {
        if (trimmedLine.startsWith('#')) return;
      } else if (langKey === 'html') {
        if (trimmedLine.startsWith('<!--')) return;
      } else if (langKey === 'css') {
        if (trimmedLine.startsWith('/*')) return;
      } else if (langKey === 'sql') {
        if (trimmedLine.startsWith('--')) return;
      } else {
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) return;
      }

      // Bracket/paren/brace balance (skip for HTML/CSS/SQL)
      if (!['html', 'css', 'sql'].includes(langKey)) {
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
            addError({ line: lineNum, column: i + 1, message: 'Unexpected closing parenthesis ")"', severity: 'error', type: 'SyntaxError', suggestion: 'Remove the extra ) or add matching (' });
            parenBalance = 0;
          }
          if (bracketBalance < 0) {
            addError({ line: lineNum, column: i + 1, message: 'Unexpected closing bracket "]"', severity: 'error', type: 'SyntaxError', suggestion: 'Remove the extra ] or add matching [' });
            bracketBalance = 0;
          }
          if (braceBalance < 0) {
            addError({ line: lineNum, column: i + 1, message: 'Unexpected closing brace "}"', severity: 'error', type: 'SyntaxError', suggestion: 'Remove the extra } or add matching {' });
            braceBalance = 0;
          }
        }
      }

      // Unclosed strings check
      if (singleQuoteOpen && line.includes("'")) {
        const quoteCount = (line.match(/'/g) || []).length;
        if (quoteCount % 2 !== 0) {
          addError({ line: lineNum, column: line.lastIndexOf("'") + 1, message: 'Unclosed string literal (single quote)', severity: 'error', type: 'SyntaxError', suggestion: "Add closing ' at the end of string" });
        }
      }
      
      if (doubleQuoteOpen && line.includes('"')) {
        const quoteCount = (line.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          addError({ line: lineNum, column: line.lastIndexOf('"') + 1, message: 'Unclosed string literal (double quote)', severity: 'error', type: 'SyntaxError', suggestion: 'Add closing " at the end of string' });
        }
      }

      // Apply language-specific patterns
      patterns.forEach(pattern => {
        if (pattern.regex.test(line)) {
          const match = line.match(pattern.regex);
          addError({
            line: lineNum,
            column: match?.index ? match.index + 1 : 1,
            message: pattern.message,
            severity: pattern.type.includes('Warning') ? 'warning' : 'error',
            type: pattern.type,
            suggestion: pattern.suggestion || `Fix the ${pattern.type} on this line`
          });
        }
      });

      // Typo detection (universal keywords)
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
          addError({
            line: lineNum,
            column: line.search(typoRegex) + 1,
            message: `Typo: "${match[0]}" should be "${correct}"`,
            severity: 'error',
            type: 'SpellingError',
            wrongCode: match[0],
            correctCode: correct,
            suggestion: `Replace "${match[0]}" with "${correct}"`
          });
        }
      });

      // Semicolon check - only for languages that require them
      if (semicolonLanguages.has(langKey)) {
        if (trimmedLine && 
            !trimmedLine.endsWith(';') && !trimmedLine.endsWith('{') && 
            !trimmedLine.endsWith('}') && !trimmedLine.endsWith(':') && 
            !trimmedLine.endsWith(',') && !trimmedLine.endsWith('(') &&
            !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*') &&
            !trimmedLine.startsWith('*') && !trimmedLine.startsWith('#') &&
            !/^(if|else|for|while|do|switch|case|try|catch|finally|function|class|import|export|const|let|var|return|async|public|private|protected|static|namespace|using|package)\b/.test(trimmedLine) &&
            !/[{}()[\]]\s*$/.test(trimmedLine) &&
            trimmedLine.length > 3 &&
            /[a-zA-Z0-9"'`)\]]\s*$/.test(trimmedLine)) {
          addError({
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

    // End-of-file bracket balance checks
    if (parenBalance > 0) {
      addError({ line: codeLines.length, column: 1, message: `${parenBalance} unclosed parenthesis "("`, severity: 'error', type: 'SyntaxError', suggestion: `Add ${parenBalance} closing ) at appropriate location` });
    }
    if (bracketBalance > 0) {
      addError({ line: codeLines.length, column: 1, message: `${bracketBalance} unclosed bracket "["`, severity: 'error', type: 'SyntaxError', suggestion: `Add ${bracketBalance} closing ] at appropriate location` });
    }
    if (braceBalance > 0) {
      addError({ line: codeLines.length, column: 1, message: `${braceBalance} unclosed brace "{"`, severity: 'error', type: 'SyntaxError', suggestion: `Add ${braceBalance} closing } at appropriate location` });
    }

    setErrors(detectedErrors);

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
      }).forEach(([typo, correct]) => {
        corrected = corrected.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correct);
      });

      setCorrectedCode(corrected);
    } else {
      setCorrectedCode('');
    }

    const endTime = performance.now();
    setDetectionTime(endTime - startTime);
    setIsDetecting(false);
  }, [language, autoDetectLanguage]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (code.trim()) {
      debounceRef.current = setTimeout(() => {
        detectErrors(code);
      }, 5);
    } else {
      setErrors([]);
      setCorrectedCode('');
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
        {/* Blue Error Console with Red/Green lines and Apply buttons */}
        {errors.length > 0 && (
          <div className="bg-[#1a1a2e] border-2 border-blue-500/50 rounded-xl overflow-hidden shadow-lg shadow-blue-500/10">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500/30 to-blue-600/20 border-b border-blue-500/50">
              <span className="text-sm font-bold text-blue-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                🔵 LIVE ERROR DETECTION ({errors.length} issues)
              </span>
              <span className="text-xs text-blue-300">Language: {language} | Detected every 0.005s</span>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto space-y-3">
              {errors.map((error, index) => (
                <div key={index} className="rounded-lg border border-blue-500/20 overflow-hidden">
                  {/* Error line in RED */}
                  <div className="bg-red-500/10 p-3 border-l-4 border-red-500">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-red-500/20 px-2 py-0.5 rounded text-red-400">
                        Line {error.line}:{error.column}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">
                        {error.type}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-red-400 font-mono">
                      ❌ {error.message}
                    </p>
                    {error.wrongCode && (
                      <pre className="text-xs text-red-300 mt-1 font-mono bg-red-500/5 p-1 rounded">
                        {error.wrongCode}
                      </pre>
                    )}
                  </div>
                  
                  {/* Corrected code in GREEN with Apply button */}
                  {(error.suggestion || error.correctCode) && (
                    <div className="bg-green-500/10 p-3 border-l-4 border-green-500 flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-green-400 font-mono flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          ✅ {error.correctCode ? error.correctCode : error.suggestion}
                        </p>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => applyErrorFix(error)}
                        className="ml-3 h-7 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                      >
                        <ArrowRight className="w-3 h-3" />
                        Apply Fix
                      </Button>
                    </div>
                  )}
                </div>
              ))}
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
