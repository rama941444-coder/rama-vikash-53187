import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';
import LanguageSelector from '@/components/LanguageSelector';
import EnhancedCodeEditor from '@/components/EnhancedCodeEditor';
import VoiceControls from '@/components/VoiceControls';
import { detectLanguage } from '@/lib/programmingLanguages';

interface CodeInputProps {
  onAnalysisComplete: (data: any) => void;
}

const CodeInput = ({ onAnalysisComplete }: CodeInputProps) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('Auto-Detect');
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  // Auto-detect language when code changes
  useEffect(() => {
    if (language === 'Auto-Detect' && code.trim().length > 50) {
      const detected = detectLanguage(code);
      if (detected !== 'Auto-Detect') {
        // Show detection but don't auto-change to preserve user choice
      }
    }
  }, [code, language]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...uploadedFiles]);
    toast({
      title: "Files uploaded",
      description: `${uploadedFiles.length} file(s) added`,
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
    toast({
      title: "Files uploaded",
      description: `${droppedFiles.length} file(s) added`,
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVoiceInput = (transcript: string) => {
    setCode(prev => prev + ' ' + transcript);
  };

  const runAnalysis = async () => {
    if (!code && files.length === 0) {
      toast({
        title: "No input provided",
        description: "Please enter code or upload files",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const filesData = files.map((f) => ({ name: f.name, type: f.type }));
      
      // Determine actual language for analysis
      let analysisLanguage = language;
      if (language === 'Auto-Detect' && code.trim()) {
        const detected = detectLanguage(code);
        if (detected !== 'Auto-Detect') {
          analysisLanguage = detected;
        }
      }
      
      // Read file contents properly based on type
      const fileDataPromises = files.map(async (file) => {
        return new Promise((resolve) => {
          const isImage = file.type.startsWith('image/');
          const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
          const isWord = file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc');
          
          const isTextFile = file.type.includes('text') || 
            file.type.includes('json') ||
            file.type.includes('javascript') ||
            file.name.endsWith('.js') ||
            file.name.endsWith('.py') ||
            file.name.endsWith('.java') ||
            file.name.endsWith('.c') ||
            file.name.endsWith('.cpp') ||
            file.name.endsWith('.html') ||
            file.name.endsWith('.css') ||
            file.name.endsWith('.sql');

          if (isTextFile) {
            const textReader = new FileReader();
            textReader.onload = (e) => {
              const textContent = e.target?.result as string;
              const base64Reader = new FileReader();
              base64Reader.onload = (e2) => {
                resolve({
                  name: file.name,
                  type: file.type,
                  base64: e2.target?.result as string,
                  content: textContent,
                  isImage: false,
                  isPDF: false,
                  isWord: false
                });
              };
              base64Reader.readAsDataURL(file);
            };
            textReader.readAsText(file);
          } else {
            // For images, PDFs, Word docs - send as base64
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                name: file.name,
                type: file.type,
                base64: e.target?.result as string,
                content: '',
                isImage: isImage || false,
                isPDF: isPDF || false,
                isWord: isWord || false
              });
            };
            reader.readAsDataURL(file);
          }
        });
      });
      
      const fileData = await Promise.all(fileDataPromises);
      
      const { data, error } = await supabase.functions.invoke('analyze-code', {
        body: {
          code: code || '',
          language: analysisLanguage,
          files: filesData,
          fileData: fileData
        }
      });

      if (data) {
        // Check for specific error types
        if (data.error === 'RATE_LIMIT_EXCEEDED') {
          setResult(data);
          onAnalysisComplete(data);
          toast({
            title: "⚠️ Rate Limit Exceeded",
            description: "Too many requests. Please wait a moment and try again.",
            variant: "destructive",
          });
        } else if (data.error === 'PAYMENT_REQUIRED') {
          setResult(data);
          onAnalysisComplete(data);
          toast({
            title: "⚠️ Credits Required",
            description: "Add credits in Settings → Workspace → Usage to enable AI analysis.",
            variant: "destructive",
          });
        } else if (data.error) {
          setResult(data);
          onAnalysisComplete(data);
          toast({
            title: "⚠️ Analysis Error",
            description: "An error occurred. Check the results for details.",
            variant: "destructive",
          });
        } else {
          setResult(data);
          onAnalysisComplete(data);
          toast({
            title: "✅ Analysis Complete!",
            description: `Analyzed as ${analysisLanguage}. Results ready.`,
          });
        }
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "❌ Analysis Failed",
        description: error.message || "Network error. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">Select Language/Context (1600+ Languages)</label>
          <LanguageSelector 
            value={language} 
            onChange={setLanguage}
            code={code}
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">Initiate Analysis</label>
          <Button 
            onClick={runAnalysis} 
            disabled={analyzing}
            className="w-full gap-2 neon-glow"
            size="lg"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Analyze & Run
              </>
            )}
          </Button>
        </div>
      </div>

      <div>
        <label className="block text-lg font-semibold mb-2">
          Manual Code/Text Editor
        </label>
        <EnhancedCodeEditor
          value={code}
          onChange={setCode}
          placeholder="Paste your code or document text here. The AI will analyze this code and provide dynamic output..."
          minHeight="350px"
        />
        
        {/* Voice Input */}
        <div className="mt-4">
          <VoiceControls 
            text={code} 
            onVoiceInput={handleVoiceInput}
            showInput={true}
          />
        </div>
      </div>

      <div
        className="border-2 border-dashed border-primary/50 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById('code-file-input')?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-3 text-primary" />
        <p className="text-lg font-medium mb-2">Drag & Drop Files (Images, PDF, Word, Code)</p>
        <p className="text-sm text-muted-foreground">Supports handwritten text, screenshots, and multiple code snippets</p>
        <input
          type="file"
          id="code-file-input"
          className="hidden"
          multiple
          onChange={handleFileUpload}
        />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((file, index) => (
            <div key={index} className="bg-card p-3 rounded-lg border border-border relative">
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs"
              >
                ×
              </button>
              <p className="text-sm truncate font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="grid gap-4 mt-8">
          <div className="analysis-box-red">
            <h3 className="font-semibold text-lg mb-2">Analysis Report</h3>
            <pre className="whitespace-pre-wrap text-sm">{result.analysis}</pre>
          </div>
          
          <div className="analysis-box-green">
            <h3 className="font-semibold text-lg mb-2">✅ Corrected Code</h3>
            <pre className="whitespace-pre-wrap text-sm font-mono code-separator-style">{result.correctedCode}</pre>
          </div>
          
          <div className="analysis-box-black">
            <h3 className="font-semibold text-lg mb-2">⚡ Execution Output</h3>
            <pre className="whitespace-pre-wrap text-sm font-mono code-separator-style">{result.output}</pre>
          </div>

          {result.flowchart && (
            <div className="analysis-box-blue">
              <h3 className="font-semibold text-lg mb-2">Flowchart / Logic Diagram</h3>
              <pre className="whitespace-pre-wrap text-sm">{result.flowchart}</pre>
            </div>
          )}

          {result.dsa && (
            <div className="analysis-box-purple">
              <h3 className="font-semibold text-lg mb-2">DSA Analysis (Data Structures & Algorithms)</h3>
              <pre className="whitespace-pre-wrap text-sm">{result.dsa}</pre>
            </div>
          )}
          
          {language === 'HTML' && result.correctedCode && (
            <div className="analysis-box-dark">
              <h3 className="font-semibold text-lg mb-2">HTML Preview</h3>
              <div className="bg-white rounded-lg p-4">
                <iframe 
                  srcDoc={DOMPurify.sanitize(result.correctedCode, { 
                    WHOLE_DOCUMENT: true,
                    ADD_TAGS: ['style', 'link'],
                    ADD_ATTR: ['target', 'rel']
                  })}
                  className="w-full min-h-[400px] border-0 rounded"
                  sandbox="allow-scripts"
                  title="HTML Preview"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeInput;
