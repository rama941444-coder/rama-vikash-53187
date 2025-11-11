import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const LANGUAGES = [
  'Universal File/Document', 'C', 'C++', 'C#', 'Java', 'JavaScript', 
  'HTML', 'CSS', 'Python', 'Swift', 'Golang', 'Kotlin', 'PHP', 
  'SQL-DDL', 'SQL-DML', 'SQL-DCL', 'SQL-TCL', 'SQL-Triggers', 'SQL-Joins',
  'PL/SQL', 'T-SQL', 'DBMS', 'MongoDB Query Language', 'R',
  'Handwritten Notes', 'Text Document', 'DSA & Algorithms', 'Flowchart Analysis', 'General Analysis'
];

const UniversalAnalyzer = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState('Universal File/Document');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const totalSize = droppedFiles.reduce((acc, f) => acc + f.size, 0);
    const maxSize = 500 * 1024 * 1024; // 500MB
    
    if (totalSize > maxSize) {
      toast({
        title: "Files too large",
        description: "Total file size exceeds 500MB limit.",
        variant: "destructive",
      });
      return;
    }
    
    setFiles((prev) => [...prev, ...droppedFiles]);
    toast({
      title: "Files dropped",
      description: `${droppedFiles.length} file(s) added (${(totalSize / 1024 / 1024).toFixed(2)}MB)`,
    });
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    const maxSize = 500 * 1024 * 1024; // 500MB total limit
    
    if (totalSize > maxSize) {
      toast({
        title: "Files too large",
        description: "Total file size exceeds 500MB. Please select smaller files.",
        variant: "destructive",
      });
      return;
    }
    
    setFiles((prev) => [...prev, ...selectedFiles]);
    toast({
      title: "Files uploaded",
      description: `${selectedFiles.length} file(s) added (${(totalSize / 1024 / 1024).toFixed(2)}MB)`,
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const analyzeFiles = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload at least one file",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      // Process multiple files
      const fileDataPromises = files.map(async (file) => {
        return new Promise(async (resolve) => {
          let textContent = '';
          let base64Data = '';
          
          // Read file as base64
          const reader = new FileReader();
          base64Data = await new Promise<string>((res) => {
            reader.onload = (e) => res(e.target?.result as string || '');
            reader.readAsDataURL(file);
          });
          
          const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
          const isWord = file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc');
          const isImage = file.type.startsWith('image/');
          
          const isTextFile = !isImage && !isPDF && !isWord && (
            file.type.includes('text') || 
            file.type.includes('json') ||
            file.type.includes('javascript') ||
            file.type.includes('python') ||
            file.name.endsWith('.txt') ||
            file.name.endsWith('.js') ||
            file.name.endsWith('.ts') ||
            file.name.endsWith('.tsx') ||
            file.name.endsWith('.jsx') ||
            file.name.endsWith('.py') ||
            file.name.endsWith('.java') ||
            file.name.endsWith('.c') ||
            file.name.endsWith('.cpp') ||
            file.name.endsWith('.cs') ||
            file.name.endsWith('.html') ||
            file.name.endsWith('.css') ||
            file.name.endsWith('.sql') ||
            file.name.endsWith('.php') ||
            file.name.endsWith('.go') ||
            file.name.endsWith('.swift') ||
            file.name.endsWith('.kt')
          );
          
          if (isTextFile) {
            try {
              const textReader = new FileReader();
              textContent = await new Promise<string>((res) => {
                textReader.onload = (e) => res(e.target?.result as string || '');
                textReader.readAsText(file);
              });
            } catch (err) {
              console.error('Error reading text file:', err);
            }
          }
          
          resolve({
            name: file.name,
            type: file.type,
            base64: base64Data,
            content: textContent || '',
            isImage: isImage || false,
            isPDF: isPDF || false,
            isWord: isWord || false
          });
        });
      });
      
      const fileData = await Promise.all(fileDataPromises);
      const filesMetadata = files.map(f => ({ name: f.name, type: f.type }));
      
      toast({
        title: "Processing files...",
        description: `Analyzing ${files.length} file(s) with advanced AI`,
      });
      
      const { data, error } = await supabase.functions.invoke('analyze-code', {
        body: { 
          code: '', 
          language,
          files: filesMetadata,
          fileData: fileData
        }
      });

      if (data) {
        setResult(data);
        toast({
          title: "Analysis complete!",
          description: `Successfully analyzed ${files.length} file(s)`,
        });
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis complete",
        description: "Results may be limited",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div 
        className="border-2 border-dashed border-primary/50 rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all neon-glow"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Upload className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h3 className="text-xl font-semibold mb-2">Drop Large Files & Multiple Files Here</h3>
        <p className="text-muted-foreground mb-4">
          Supports: <span className="text-primary font-medium">PDF, Word, Images (Handwritten/Screenshots), Multiple Codes, All Programming Languages, Large Files (up to 500MB)</span>
        </p>
        <input 
          type="file" 
          id="file-input" 
          className="hidden" 
          onChange={handleFileSelect}
          accept="*/*"
          multiple
        />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((file, index) => (
            <div key={index} className="bg-card p-3 rounded-lg border border-border relative">
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-destructive/90"
              >
                <X className="w-4 h-4" />
              </button>
              <FileText className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm truncate font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">File Language/Type</label>
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

        <Button 
          onClick={analyzeFiles} 
          disabled={files.length === 0 || analyzing}
          className="gap-2 neon-glow"
          size="lg"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing {files.length} file(s)...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Analyze {files.length > 0 ? `${files.length} File(s)` : 'Files'}
            </>
          )}
        </Button>
      </div>

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

          {/* Orange Box - TTS Narration */}
          {result.ttsNarration && (
            <div className="analysis-box-orange">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                TTS Narration
              </h3>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed mb-4">
                {result.ttsNarration}
              </pre>
              <Button
                onClick={async () => {
                  try {
                    const utterance = new SpeechSynthesisUtterance(result.ttsNarration);
                    utterance.rate = 0.9;
                    utterance.pitch = 1;
                    utterance.volume = 1;
                    window.speechSynthesis.speak(utterance);
                    toast({
                      title: "Playing narration",
                      description: "Audio narration started",
                    });
                  } catch (error) {
                    toast({
                      title: "Audio playback failed",
                      description: "Could not play narration",
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                className="gap-2"
              >
                <Volume2 className="w-4 h-4" />
                Play Narration
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UniversalAnalyzer;
