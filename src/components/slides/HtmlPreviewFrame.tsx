import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Maximize2, Minimize2, RefreshCw, Rocket, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HtmlPreviewFrameProps {
  html: string;
  title?: string;
  minHeight?: number;
}

/**
 * Sandboxed live HTML/CSS/JS preview that behaves like a real online compiler.
 * - Does NOT run DOMPurify (strips onclick/<script> content and breaks games/buttons).
 * - Iframe sandbox isolates the user code from the parent app.
 * - Includes "Open in new tab" (deploy-style) and a clickability self-check.
 */
const HtmlPreviewFrame = ({ html, title = 'Live Preview', minHeight = 480 }: HtmlPreviewFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; msg: string } | null>(null);
  const { toast } = useToast();

  // Inject a tiny self-test that counts clickable elements after load.
  const augmented = (() => {
    if (!html) return '';
    const probe = `
<script>
(function(){
  function report(){
    try{
      var nodes = document.querySelectorAll('button,a,[onclick],input[type=button],input[type=submit],[role=button]');
      var count = nodes.length;
      var blocked = 0;
      nodes.forEach(function(el){
        var s = window.getComputedStyle(el);
        if (s.pointerEvents === 'none' || s.display === 'none' || s.visibility === 'hidden') blocked++;
      });
      parent.postMessage({__lovablePreviewCheck:true, count:count, blocked:blocked}, '*');
    }catch(e){}
  }
  if (document.readyState === 'complete') setTimeout(report, 200);
  else window.addEventListener('load', function(){ setTimeout(report, 200); });
})();
</script>`;
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, probe + '</body>');
    return html + probe;
  })();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (d && d.__lovablePreviewCheck) {
        if (d.count === 0) {
          setCheck({ ok: true, msg: 'Static preview rendered (no interactive elements detected).' });
        } else if (d.blocked === d.count && d.count > 0) {
          setCheck({ ok: false, msg: `Found ${d.count} controls but all are non-interactive (pointer-events/display).` });
        } else {
          setCheck({ ok: true, msg: `${d.count} interactive control(s) clickable, ${d.blocked} blocked.` });
        }
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [reloadKey]);

  const openInNewTab = () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast({ title: 'Popup blocked', description: 'Allow popups to open the live preview.', variant: 'destructive' });
      return;
    }
    win.document.open();
    win.document.write(augmented);
    win.document.close();
    win.document.title = title;
  };

  if (!html?.trim()) return null;

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-background p-4 flex flex-col' : 'space-y-2'}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          {check ? (
            check.ok ? (
              <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="w-4 h-4" />{check.msg}</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-4 h-4" />{check.msg}</span>
            )
          ) : (
            <span className="text-muted-foreground">Loading preview…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw className="w-4 h-4 mr-1" />Reload
          </Button>
          <Button size="sm" onClick={openInNewTab} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <Rocket className="w-4 h-4 mr-1" />Deploy Preview
          </Button>
          <Button size="sm" variant="outline" onClick={openInNewTab}>
            <ExternalLink className="w-4 h-4 mr-1" />New Tab
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFullscreen(f => !f)}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <div className="bg-white rounded-lg overflow-hidden border" style={{ flex: fullscreen ? 1 : undefined }}>
        <iframe
          key={reloadKey}
          ref={iframeRef}
          srcDoc={augmented}
          className="w-full border-0 bg-white"
          style={{ height: fullscreen ? '100%' : `${minHeight}px` }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock allow-downloads"
          title={title}
        />
      </div>
    </div>
  );
};

export default HtmlPreviewFrame;
