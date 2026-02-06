import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Play, Image, Wand2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';
import LanguageSelector from '@/components/LanguageSelector';
import EnhancedCodeEditor from '@/components/EnhancedCodeEditor';
import { getStoredAPIKey } from '@/hooks/useUserAPIKey';

interface CodeInputProps {
  onAnalysisComplete: (data: any) => void;
  persistedCode?: string;
  onCodeChange?: (code: string) => void;
}

const CodeInput = ({ onAnalysisComplete, persistedCode = '', onCodeChange }: CodeInputProps) => {
  const [code, setCode] = useState(persistedCode);
  const [language, setLanguage] = useState('Auto-Detect');
  const [files, setFiles] = useState<File[]>([]);
  const [universalImages, setUniversalImages] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  // Sync with persisted code when it changes
  useEffect(() => {
    if (persistedCode && persistedCode !== code) {
      setCode(persistedCode);
    }
  }, [persistedCode]);

  // Notify parent of code changes for persistence
  useEffect(() => {
    if (onCodeChange && code !== persistedCode) {
      onCodeChange(code);
    }
  }, [code, onCodeChange, persistedCode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...uploadedFiles]);
    toast({
      title: "Files uploaded",
      description: `${uploadedFiles.length} file(s) added`,
    });
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    // Check if any dropped files are images
    const imageFiles = droppedFiles.filter(f => f.type.startsWith('image/'));
    const otherFiles = droppedFiles.filter(f => !f.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      toast({
        title: "📸 Image detected!",
        description: "Click 'Extract Code from Image' to extract code using AI",
      });
    }
    
    setFiles((prev) => [...prev, ...droppedFiles]);
    
    if (otherFiles.length > 0) {
      toast({
        title: "Files uploaded",
        description: `${otherFiles.length} file(s) added`,
      });
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Extract code from images using Gemini 3
  const extractCodeFromImages = async () => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "No images",
        description: "Please upload image files to extract code from",
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);
    let extractedCodes: string[] = [];

    try {
      for (const file of imageFiles) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke('extract-code-from-image', {
          body: { imageBase64: base64, language, userApiKey: getStoredAPIKey() }
        });

        if (error) {
          console.error('Extraction error:', error);
          toast({
            title: `❌ Failed to extract from ${file.name}`,
            description: error.message,
            variant: "destructive",
          });
          continue;
        }

        if (data?.code) {
          extractedCodes.push(`// Extracted from: ${file.name}\n${data.code}`);
        }
      }

      if (extractedCodes.length > 0) {
        const combinedCode = extractedCodes.join('\n\n// -------------------\n\n');
        setCode(prev => prev ? `${prev}\n\n${combinedCode}` : combinedCode);
        toast({
          title: "✅ Code Extracted!",
          description: `Extracted code from ${extractedCodes.length} image(s)`,
        });
      }
    } catch (error: any) {
      console.error('Extraction error:', error);
      toast({
        title: "❌ Extraction Failed",
        description: error.message || "Failed to extract code from images",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
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
          fileData: fileData,
          userApiKey: getStoredAPIKey()
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
            description: "All results are ready.",
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

  const hasImages = files.some(f => f.type.startsWith('image/'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">Select Language/Context (1600+ Languages)</label>
          <LanguageSelector 
            value={language} 
            onChange={setLanguage}
            placeholder="Auto-Detect"
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
          Manual Code/Text Editor (Notepad Style)
        </label>
        <EnhancedCodeEditor
          value={code}
          onChange={setCode}
          placeholder={"// Paste or type your code here...\n// Supports up to 300,000 lines\n// Features: Line numbers, auto-indent, bracket matching\n// Press Tab for indentation, Shift+Tab to unindent\n// Auto-closes: () [] {} '' \"\" ``"}
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
        <p className="text-xs text-primary mt-2">📸 Drop images to extract code using Gemini 3 AI</p>
        <input
          type="file"
          id="code-file-input"
          className="hidden"
          multiple
          onChange={handleFileUpload}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {files.map((file, index) => (
              <div key={index} className="bg-card p-3 rounded-lg border border-border relative">
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs"
                >
                  ×
                </button>
                {file.type.startsWith('image/') && (
                  <Image className="w-4 h-4 text-primary absolute top-2 left-2" />
                )}
                <p className="text-sm truncate font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ))}
          </div>

          {hasImages && (
            <Button
              onClick={extractCodeFromImages}
              disabled={extracting}
              variant="outline"
              className="w-full gap-2 border-primary/50 hover:bg-primary/10"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting Code from Images...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Extract Code from Images (Gemini 3 AI)
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Universal Image to Code Box */}
      <div className="border-2 border-dashed border-purple-500/50 rounded-xl p-6 text-center bg-purple-500/5">
        <div className="flex flex-col items-center">
          <Sparkles className="w-10 h-10 mb-3 text-purple-400" />
          <h3 className="text-lg font-semibold mb-2 text-purple-300">Universal Image → Code Generator</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drop images of <span className="text-purple-400">trees, plants, landscapes, objects</span> and generate code to recreate them
          </p>
          
          <div
            className="w-full border border-purple-500/30 rounded-lg p-4 cursor-pointer hover:bg-purple-500/10 transition-all"
            onDrop={(e) => {
              e.preventDefault();
              const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
              if (droppedFiles.length > 0) {
                setUniversalImages(prev => [...prev, ...droppedFiles]);
                toast({
                  title: "🖼️ Images added!",
                  description: `${droppedFiles.length} image(s) ready for code generation`,
                });
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('universal-image-input')?.click()}
          >
            <Image className="w-8 h-8 mx-auto mb-2 text-purple-400" />
            <p className="text-sm text-purple-300">Click or drop universal images here</p>
            <input
              type="file"
              id="universal-image-input"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                setUniversalImages(prev => [...prev, ...selected]);
                if (selected.length > 0) {
                  toast({
                    title: "🖼️ Images added!",
                    description: `${selected.length} image(s) ready for code generation`,
                  });
                }
              }}
            />
          </div>

          {universalImages.length > 0 && (
            <div className="mt-4 w-full">
              <div className="flex flex-wrap gap-2 mb-3">
                {universalImages.map((file, index) => (
                  <div key={index} className="relative bg-purple-500/20 px-3 py-1 rounded-full text-sm text-purple-300 flex items-center gap-2">
                    <Image className="w-3 h-3" />
                    {file.name.substring(0, 15)}...
                    <button
                      onClick={() => setUniversalImages(prev => prev.filter((_, i) => i !== index))}
                      className="text-purple-400 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={async () => {
                  if (universalImages.length === 0) return;
                  setGeneratingCode(true);
                  
                  try {
                    // Convert first image to base64
                    const file = universalImages[0];
                    const base64 = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = (e) => resolve(e.target?.result as string);
                      reader.readAsDataURL(file);
                    });

                    const { data, error } = await supabase.functions.invoke('extract-code-from-image', {
                      body: { 
                        imageBase64: base64, 
                        language,
                        mode: 'generate_code_for_image',
                        userApiKey: getStoredAPIKey()
                      }
                    });

                    if (error) {
                      toast({
                        title: "❌ Generation Failed",
                        description: error.message,
                        variant: "destructive",
                      });
                    } else if (data?.code) {
                      setCode(prev => prev ? `${prev}\n\n// Generated code for: ${file.name}\n${data.code}` : data.code);
                      toast({
                        title: "✅ Code Generated!",
                        description: `Generated ${language} code to recreate the image`,
                      });
                    }
                  } catch (error: any) {
                    toast({
                      title: "❌ Error",
                      description: error.message,
                      variant: "destructive",
                    });
                  } finally {
                    setGeneratingCode(false);
                  }
                }}
                disabled={generatingCode}
                className="gap-2 bg-purple-500 hover:bg-purple-600"
              >
                {generatingCode ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Code with Gemini 3...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Code for Image
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
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
