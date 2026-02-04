import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink, Copy, Maximize2, Minimize2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';

interface WebPreviewProps {
  htmlCode?: string;
  cssCode?: string;
  jsCode?: string;
  combinedCode?: string;
}

const WebPreview = ({ htmlCode = '', cssCode = '', jsCode = '', combinedCode = '' }: WebPreviewProps) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);
  const { toast } = useToast();

  // Combine all code into a single HTML document
  const previewContent = useMemo(() => {
    let html = combinedCode || htmlCode;
    
    // If we have separate CSS/JS, inject them
    if (cssCode && !combinedCode) {
      if (html.includes('</head>')) {
        html = html.replace('</head>', `<style>${cssCode}</style></head>`);
      } else if (html.includes('<body')) {
        html = html.replace('<body', `<style>${cssCode}</style><body`);
      } else {
        html = `<style>${cssCode}</style>${html}`;
      }
    }
    
    if (jsCode && !combinedCode) {
      if (html.includes('</body>')) {
        html = html.replace('</body>', `<script>${jsCode}</script></body>`);
      } else {
        html = `${html}<script>${jsCode}</script>`;
      }
    }

    // Sanitize the HTML for safe rendering
    const sanitized = DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['style', 'link', 'script'],
      ADD_ATTR: ['target', 'rel', 'onclick', 'onload'],
      FORCE_BODY: true,
    });

    return sanitized;
  }, [htmlCode, cssCode, jsCode, combinedCode]);

  const getViewportWidth = () => {
    switch (viewMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop': return '100%';
      default: return '100%';
    }
  };

  const refreshPreview = () => {
    setKey(prev => prev + 1);
    toast({
      title: "Preview Refreshed",
      description: "The preview has been reloaded",
    });
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(previewContent);
      toast({
        title: "Copied!",
        description: "HTML code copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        variant: "destructive",
      });
    }
  };

  if (!previewContent.trim()) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-[#1a1a2e] rounded-xl border-2 border-dashed border-gray-600">
        <div className="text-center text-gray-400">
          <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No Web Code to Preview</h3>
          <p className="text-sm">Write HTML/CSS/JavaScript code in Slide 2 or Slide 5</p>
          <p className="text-sm mt-2">and click "Run & Analyze" to see the preview here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-4' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#16213e] to-[#1a1a2e] rounded-t-xl border border-[#0f3460]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            🌐 LIVE WEB PREVIEW
          </span>
        </div>

        {/* View Mode Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0f3460] rounded-lg p-1 gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('desktop')}
              className={`h-8 px-3 ${viewMode === 'desktop' ? 'bg-cyan-500/30 text-cyan-300' : 'text-gray-400 hover:text-white'}`}
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('tablet')}
              className={`h-8 px-3 ${viewMode === 'tablet' ? 'bg-cyan-500/30 text-cyan-300' : 'text-gray-400 hover:text-white'}`}
            >
              <Tablet className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('mobile')}
              className={`h-8 px-3 ${viewMode === 'mobile' ? 'bg-cyan-500/30 text-cyan-300' : 'text-gray-400 hover:text-white'}`}
            >
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={refreshPreview}
            className="h-8 px-3 text-gray-400 hover:text-white hover:bg-[#0f3460]"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyHtml}
            className="h-8 px-3 text-gray-400 hover:text-white hover:bg-[#0f3460]"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 px-3 text-gray-400 hover:text-white hover:bg-[#0f3460]"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Preview Container */}
      <div className="bg-white rounded-b-xl overflow-hidden border-2 border-t-0 border-[#0f3460]" 
           style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '600px' }}>
        <div 
          className="mx-auto transition-all duration-300 h-full bg-white"
          style={{ maxWidth: getViewportWidth() }}
        >
          <iframe
            key={key}
            srcDoc={previewContent}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Web Preview"
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-cyan-500 to-[#0f3460] text-white text-xs rounded-lg">
        <div className="flex items-center gap-4">
          <span className="font-medium flex items-center gap-1">
            <Monitor className="w-3 h-3" />
            {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View
          </span>
          <span className="opacity-50">|</span>
          <span>{previewContent.length.toLocaleString()} characters</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="bg-white/20 px-2 py-0.5 rounded">HTML/CSS/JS</span>
          <span>Live Preview</span>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-sm text-cyan-300">
        <h4 className="font-bold mb-2 flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          💡 Tips for Web Development Preview
        </h4>
        <ul className="space-y-1 text-xs opacity-80">
          <li>• Write complete HTML documents with &lt;html&gt;, &lt;head&gt;, and &lt;body&gt; tags</li>
          <li>• Include CSS within &lt;style&gt; tags or inline styles</li>
          <li>• Add JavaScript within &lt;script&gt; tags</li>
          <li>• Use responsive design techniques for all device sizes</li>
          <li>• Toggle between Desktop, Tablet, and Mobile views to test responsiveness</li>
        </ul>
      </div>
    </div>
  );
};

export default WebPreview;
