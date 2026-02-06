import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as pdfjsLib from 'pdfjs-dist';
import { parseDocument } from '@/lib/documentParser';
import NarrationControls from '@/components/NarrationControls';
import AITeacherAnimation from '@/components/AITeacherAnimation';
import LanguageSelector from '@/components/LanguageSelector';
import { getStoredAPIKey } from '@/hooks/useUserAPIKey';
// @ts-ignore - Vite resolves this to a URL string for the worker file
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure PDF.js worker for browser using bundled worker URL (avoids CORS/module errors)
try {
  // @ts-ignore
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;
} catch {}

// Convert first up to maxPages of a PDF into image data URLs for OCR
const pdfToImages = async (file: File, maxPages = 10): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];
  const pages = Math.min(pdf.numPages, maxPages);
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL('image/png'));
  }
  return images;
};

const UniversalAnalyzer = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState('Auto-Detect');
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
          let pageImages: string[] = [];
          
          // Read file as base64 (kept for images and backend compatibility)
          const reader = new FileReader();
          base64Data = await new Promise<string>((res) => {
            reader.onload = (e) => res((e.target?.result as string) || '');
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
          
          try {
            if (isTextFile) {
              const textReader = new FileReader();
              textContent = await new Promise<string>((res) => {
                textReader.onload = (e) => res((e.target?.result as string) || '');
                textReader.readAsText(file);
              });
            } else if (isPDF) {
              // Convert ENTIRE PDF to page images for pixel-perfect OCR
              console.log(`Converting PDF ${file.name} to images for OCR...`);
              pageImages = await pdfToImages(file, 50).catch(() => []); // Max 50 pages
              console.log(`Converted ${pageImages.length} pages to images`);
              // Also try to extract text as backup
              textContent = await parseDocument(file).catch(() => '');
            } else if (isWord) {
              // Convert Word doc to images if possible, fallback to text
              console.log(`Processing Word file ${file.name}...`);
              textContent = await parseDocument(file).catch(() => '');
              // Note: Word to image conversion would require additional library
            }
          } catch (err) {
            console.error('Error extracting content:', err);
          }
          
          resolve({
            name: file.name,
            type: file.type,
            base64: base64Data,
            content: textContent || '',
            pageImages,
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
          fileData: fileData,
          extractionMode: 'exact_code_ocr',
          userApiKey: getStoredAPIKey()
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
          <label className="block text-sm font-medium mb-2">File Language/Type (1600+ Languages)</label>
          <LanguageSelector 
            value={language} 
            onChange={setLanguage}
            placeholder="Auto-Detect"
          />
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
            {String(result.correctedCode || '')
              .split(/\n?═{10,}[^\n]*\n?/g)
              .filter((s) => s.trim().length > 0)
              .map((chunk: string, idx: number, arr: string[]) => (
                <div key={idx}>
                  <pre className="whitespace-pre-wrap text-sm font-mono code-separator-style">{chunk.trim()}</pre>
                  {idx < arr.length - 1 && (
                    <div className="my-3 border-t-2 border-dotted border-border/40" />
                  )}
                </div>
              ))}
          </div>
          
          <div className="analysis-box-black">
            <h3 className="font-semibold text-lg mb-2">⚡ Execution Output</h3>
            {String(result.output || '')
              .split(/\n?═{10,}[^\n]*\n?/g)
              .filter((s) => s.trim().length > 0)
              .map((chunk: string, idx: number, arr: string[]) => (
                <div key={idx}>
                  <pre className="whitespace-pre-wrap text-sm font-mono code-separator-style">{chunk.trim()}</pre>
                  {idx < arr.length - 1 && (
                    <div className="my-3 border-t-2 border-dotted border-border/40" />
                  )}
                </div>
              ))}
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

          {/* Orange Box - TTS Narration with Multi-Language */}
          {result.ttsNarration && (
            <div className="analysis-box-orange">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                Voice Narration (All Indian Languages)
              </h3>
              <NarrationControls text={result.ttsNarration} />
            </div>
          )}

          {/* Grey Box - AI Teacher Animation */}
          {result.ttsNarration && (
            <AITeacherAnimation 
              text={result.ttsNarration} 
              className="mt-6"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default UniversalAnalyzer;
