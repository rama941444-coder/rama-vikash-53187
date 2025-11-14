import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CodeInputProps {
  onAnalysisComplete: (data: any) => void;
}

const LANGUAGES = [
  'Python', 'JavaScript', 'C', 'C++', 'Java', 'HTML', 'CSS',
  'SQL-DDL', 'SQL-DML', 'SQL-DCL', 'SQL-TCL', 'SQL-Triggers', 'SQL-Joins',
  'PL/SQL', 'T-SQL', 'MongoDB Query Language', 'R', 
  'Swift', 'Kotlin', 'PHP', 'DBMS', 'DSA & Algorithms', 'Flowchart Analysis', 'General Document'
];

const CodeInput = ({ onAnalysisComplete }: CodeInputProps) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('Python');
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to analyze code",
          variant: "destructive",
        });
        setAnalyzing(false);
        return;
      }
      const filesData = files.map((f) => ({ name: f.name, type: f.type }));
      
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
          language,
          files: filesData,
          fileData: fileData
        }
      });

      if (error) {
        console.error('Function invocation error:', error);
        if (error.message?.includes('402') || error.message?.includes('PAYMENT_REQUIRED')) {
          toast({
            title: "⚠️ Credits Required",
            description: "Add credits in Settings → Workspace → Usage to enable AI analysis.",
            variant: "destructive",
            duration: 6000,
          });
        } else if (error.message?.includes('401')) {
          toast({
            title: "Authentication Failed",
            description: "Please log in again to use AI analysis.",
            variant: "destructive",
          });
        } else if (error.message?.includes('429')) {
          toast({
            title: "⚠️ Rate Limit",
            description: "Too many requests. Please wait and try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "❌ Analysis Failed",
            description: "Failed to connect to analysis service. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }

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
            description: "All results are ready. Lovable AI powered analysis.",
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
          <label className="block text-sm font-medium mb-2">Select Language/Context</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>{lang}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your code or document text here. The AI will analyze this code and provide dynamic output..."
          rows={12}
          className="font-mono text-sm"
        />
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
                  srcDoc={result.correctedCode}
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
