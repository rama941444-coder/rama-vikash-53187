import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Image, Download, RefreshCw, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import LanguageSelector from '@/components/LanguageSelector';

interface ImageOutputProps {
  code?: string;
  language?: string;
  draggedImage?: string; // base64 of dragged image from Slide 2
}

const ImageOutput = ({ code = '', language = 'Auto-Detect', draggedImage }: ImageOutputProps) => {
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [localImage, setLocalImage] = useState<string>(draggedImage || '');
  const { toast } = useToast();

  const generateImageFromCode = async () => {
    if (!code.trim()) {
      toast({
        title: "No code provided",
        description: "Please write code in Slide 2 or Slide 5 notepad first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-code-from-image', {
        body: { code, language }
      });

      if (error) {
        toast({ title: "❌ Generation Failed", description: error.message || "Could not generate image", variant: "destructive" });
        return;
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast({ title: "✅ Image Generated!", description: "Your code has been visualized" });
      } else if (data?.error === 'RATE_LIMIT_EXCEEDED') {
        toast({ title: "⚠️ Rate Limit", description: "Too many requests. Please wait.", variant: "destructive" });
      } else if (data?.error === 'PAYMENT_REQUIRED') {
        toast({ title: "⚠️ Credits Required", description: "Add credits to enable AI features.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "❌ Generation Failed", description: error.message || "Network error", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    const imgSrc = generatedImage || localImage;
    if (!imgSrc) return;
    
    const link = document.createElement('a');
    link.href = imgSrc;
    link.download = `code-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle local image drop for visualization
  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLocalImage(ev.target?.result as string);
        toast({ title: "🖼️ Image loaded!", description: "Image ready for visualization" });
      };
      reader.readAsDataURL(files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold neon-text flex items-center justify-center gap-3">
          <Image className="w-8 h-8 text-purple-500" />
          Code to Image Generator
        </h2>
        <p className="text-muted-foreground mt-2">
          Generate beautiful code visualizations using Gemini 3 AI
        </p>
      </div>

      {/* Drag & Drop Image Area */}
      <div
        className="border-2 border-dashed border-purple-500/50 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-500/5 transition-all"
        onDrop={handleImageDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById('slide8-image-input')?.click()}
      >
        <Upload className="w-10 h-10 mx-auto mb-3 text-purple-400" />
        <p className="text-lg font-medium text-purple-300">Drop image here to view / compare</p>
        <p className="text-sm text-muted-foreground">Or click to upload an image for reference</p>
        <input
          type="file"
          id="slide8-image-input"
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => setLocalImage(ev.target?.result as string);
              reader.readAsDataURL(file);
            }
          }}
        />
      </div>

      {/* Dragged/Uploaded Image Display */}
      {(localImage || draggedImage) && (
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-300 flex items-center gap-2 mb-4">
            🖼️ Original Image (from Slide 2 / Upload)
          </h3>
          <div className="flex justify-center">
            <img
              src={localImage || draggedImage}
              alt="Original uploaded image"
              className="max-w-full max-h-[400px] rounded-lg shadow-2xl border border-blue-500/30"
            />
          </div>
        </div>
      )}

      {/* Code Preview */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">📝 Code from Notepad</h3>
        {code ? (
          <pre className="bg-[#1a1a2e] p-4 rounded-lg text-sm font-mono text-gray-300 max-h-[200px] overflow-auto">
            {code.substring(0, 1000)}{code.length > 1000 ? '...' : ''}
          </pre>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No code available. Please write code in Slide 2 or Slide 5 notepad.</p>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div className="flex justify-center">
        <Button onClick={generateImageFromCode} disabled={isGenerating || !code.trim()} className="gap-2 neon-glow px-8" size="lg">
          {isGenerating ? (
            <><Loader2 className="w-5 h-5 animate-spin" />Generating with Gemini 3...</>
          ) : (
            <><Image className="w-5 h-5" />Generate Image from Code</>
          )}
        </Button>
      </div>

      {/* Generated Image Display */}
      {generatedImage && (
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">🎨 Generated Image</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generateImageFromCode} disabled={isGenerating} className="gap-1">
                <RefreshCw className="w-4 h-4" />Regenerate
              </Button>
              <Button variant="default" size="sm" onClick={downloadImage} className="gap-1 bg-purple-500 hover:bg-purple-600">
                <Download className="w-4 h-4" />Download
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <img src={generatedImage} alt="Generated code visualization" className="max-w-full max-h-[500px] rounded-lg shadow-2xl border border-purple-500/30" />
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="font-semibold mb-2 flex items-center gap-2">💡 How it works</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Write code in Slide 2 or Slide 5 notepad</li>
          <li>• Navigate to this slide (Slide 8)</li>
          <li>• Click "Generate Image from Code"</li>
          <li>• AI creates a beautiful code visualization</li>
          <li>• Drop images from Slide 2 to compare original vs generated</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageOutput;
