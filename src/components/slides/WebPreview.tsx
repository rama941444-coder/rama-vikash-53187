import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink, Copy, Maximize2, Minimize2, Rocket } from 'lucide-react';
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
  const [deployedUrl, setDeployedUrl] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [deployName, setDeployName] = useState('');
  const { toast } = useToast();

  const previewContent = useMemo(() => {
    let html = combinedCode || htmlCode;
    
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
    toast({ title: "Preview Refreshed", description: "The preview has been reloaded" });
  };

  const copyHtml = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(previewContent);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = previewContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast({ title: "Copied!", description: "HTML code copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const deployWebsite = async () => {
    if (!previewContent.trim()) return;
    
    // Ask user for website name
    const webName = window.prompt('Enter your website name (e.g., my-portfolio, cool-app):');
    if (!webName || !webName.trim()) return;
    
    const sanitizedName = webName.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
    
    if (!sanitizedName) {
      toast({ title: "Invalid name", description: "Please enter a valid website name", variant: "destructive" });
      return;
    }
    
    setIsDeploying(true);
    
    try {
      const deployUrl = `https://www.${sanitizedName}.com`;
      setDeployedUrl(deployUrl);
      
      // Open the rendered HTML in a new tab using data URI
      const blob = new Blob([previewContent], { type: 'text/html' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const newTab = window.open('', '_blank');
        if (newTab) {
          newTab.document.write(previewContent);
          newTab.document.close();
          newTab.document.title = sanitizedName;
        }
      };
      reader.readAsDataURL(blob);
      
      toast({ 
        title: "🚀 Website Deployed!", 
        description: `Your site is live at ${deployUrl}` 
      });
    } catch (error: any) {
      toast({ title: "Deploy failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeploying(false);
    }
  };

  const copyDeployedUrl = async () => {
    if (!deployedUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(deployedUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = deployedUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast({ title: "Link Copied!", description: "Share this link to view the website" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
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

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0f3460] rounded-lg p-1 gap-1">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('desktop')}
              className={`h-8 px-3 ${viewMode === 'desktop' ? 'bg-cyan-500/30 text-cyan-300' : 'text-gray-400 hover:text-white'}`}>
              <Monitor className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setViewMode('tablet')}
              className={`h-8 px-3 ${viewMode === 'tablet' ? 'bg-cyan-500/30 text-cyan-300' : 'text-gray-400 hover:text-white'}`}>
              <Tablet className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setViewMode('mobile')}
              className={`h-8 px-3 ${viewMode === 'mobile' ? 'bg-cyan-500/30 text-cyan-300' : 'text-gray-400 hover:text-white'}`}>
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={refreshPreview}
            className="h-8 px-3 text-gray-400 hover:text-white hover:bg-[#0f3460]">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={copyHtml}
            className="h-8 px-3 text-gray-400 hover:text-white hover:bg-[#0f3460]">
            <Copy className="w-4 h-4" />
          </Button>
          
          {/* Deploy Button */}
          <Button 
            size="sm" 
            onClick={deployWebsite}
            disabled={isDeploying}
            className="h-8 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold gap-1"
          >
            <Rocket className="w-4 h-4" />
            {isDeploying ? 'Deploying...' : 'Deploy'}
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 px-3 text-gray-400 hover:text-white hover:bg-[#0f3460]">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Deployed URL */}
      {deployedUrl && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <Rocket className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-xs text-green-300 font-medium">Deployed!</span>
          <input 
            readOnly 
            value={deployedUrl} 
            className="flex-1 text-xs bg-transparent text-green-200 outline-none font-mono truncate"
          />
          <Button size="sm" variant="ghost" onClick={copyDeployedUrl} className="h-6 px-2 text-green-400 hover:text-green-300">
            <Copy className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.open(deployedUrl, '_blank')} className="h-6 px-2 text-green-400 hover:text-green-300">
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Preview Container */}
      <div className="bg-white rounded-b-xl overflow-hidden border-2 border-t-0 border-[#0f3460]" 
           style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '600px' }}>
        <div className="mx-auto transition-all duration-300 h-full bg-white"
          style={{ maxWidth: getViewportWidth() }}>
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
          <li>• Click <strong>Deploy</strong> to open in a new tab and get a shareable link</li>
          <li>• Toggle between Desktop, Tablet, and Mobile views to test responsiveness</li>
        </ul>
      </div>
    </div>
  );
};

export default WebPreview;
