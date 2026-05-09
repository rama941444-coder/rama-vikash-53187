import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Maximize2, Minimize2, RefreshCw, Rocket, CheckCircle2, AlertTriangle, Play, Trash2, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { splitMixedWebCode } from '@/lib/webCodeExtractor';

interface HtmlPreviewFrameProps {
  html: string;        // raw input — may be a full HTML doc OR mixed text with fenced blocks
  title?: string;
  minHeight?: number;
  showConsole?: boolean;
}

interface LogEntry { level: 'log' | 'warn' | 'error' | 'info' | 'alert'; text: string; t: number; }

const HtmlPreviewFrame = ({ html, title = 'Rendered Result', minHeight = 480, showConsole = true }: HtmlPreviewFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; msg: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { toast } = useToast();

  const split = useMemo(() => splitMixedWebCode(html || ''), [html]);

  // Build the HTML doc + inject probe + console hook.
  const augmented = useMemo(() => {
    if (!split.combined) return '';
    const probe = `
<script>
(function(){
  try {
    var origLog = console.log, origWarn = console.warn, origErr = console.error, origInfo = console.info;
    function send(level, args){
      try{
        var text = Array.prototype.slice.call(args).map(function(a){
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === 'object') { try { return JSON.stringify(a); } catch(_) { return String(a); } }
          return String(a);
        }).join(' ');
        parent.postMessage({__lovablePreviewLog:true, level:level, text:text, t:Date.now()}, '*');
      }catch(e){}
    }
    console.log  = function(){ send('log', arguments);  origLog.apply(console, arguments); };
    console.info = function(){ send('info', arguments); origInfo.apply(console, arguments); };
    console.warn = function(){ send('warn', arguments); origWarn.apply(console, arguments); };
    console.error= function(){ send('error',arguments); origErr.apply(console, arguments); };
    var origAlert = window.alert;
    window.alert = function(m){ send('alert', [m]); try{ origAlert(m); }catch(e){} };
    window.addEventListener('error', function(ev){ send('error', [ev.message + ' @ ' + (ev.filename||'') + ':' + (ev.lineno||'')]); });
    window.addEventListener('unhandledrejection', function(ev){ send('error', ['Unhandled: ' + (ev.reason && ev.reason.message ? ev.reason.message : ev.reason)]); });
    function probe(){
      try{
        var nodes = document.querySelectorAll('button,a,[onclick],input[type=button],input[type=submit],[role=button]');
        var blocked = 0;
        nodes.forEach(function(el){ var s = window.getComputedStyle(el); if (s.pointerEvents==='none'||s.display==='none'||s.visibility==='hidden') blocked++; });
        parent.postMessage({__lovablePreviewCheck:true, count:nodes.length, blocked:blocked}, '*');
      }catch(e){}
    }
    if (document.readyState === 'complete') setTimeout(probe, 200);
    else window.addEventListener('load', function(){ setTimeout(probe, 200); });
  } catch(e) {}
})();
</script>`;
    if (/<\/body>/i.test(split.combined)) return split.combined.replace(/<\/body>/i, probe + '</body>');
    return split.combined + probe;
  }, [split.combined]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (!d) return;
      if (d.__lovablePreviewCheck) {
        if (d.count === 0) setCheck({ ok: true, msg: 'Static preview rendered (no interactive elements detected).' });
        else if (d.blocked === d.count && d.count > 0) setCheck({ ok: false, msg: `Found ${d.count} controls but all are non-interactive.` });
        else setCheck({ ok: true, msg: `${d.count} interactive control(s) clickable, ${d.blocked} blocked.` });
      } else if (d.__lovablePreviewLog) {
        setLogs(prev => [...prev.slice(-199), { level: d.level, text: d.text, t: d.t }]);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const run = () => {
    setLogs([]);
    setCheck(null);
    setReloadKey(k => k + 1);
  };

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

  const levelColor = (l: LogEntry['level']) =>
    l === 'error' ? 'text-red-400' : l === 'warn' ? 'text-amber-400' : l === 'alert' ? 'text-cyan-400' : l === 'info' ? 'text-blue-300' : 'text-gray-200';

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-background p-4 flex flex-col' : 'space-y-2'}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-foreground">{title}</span>
          {check ? (
            check.ok ? (
              <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="w-4 h-4" />{check.msg}</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-4 h-4" />{check.msg}</span>
            )
          ) : (
            <span className="text-muted-foreground">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={run} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
            <Play className="w-4 h-4 mr-1" />Run
          </Button>
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

      {showConsole && (
        <div className="rounded-lg border bg-zinc-950 text-zinc-100 font-mono text-xs">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
            <span className="flex items-center gap-2 text-zinc-300"><Terminal className="w-3.5 h-3.5" />Console ({logs.length})</span>
            <Button size="sm" variant="ghost" onClick={() => setLogs([])} className="h-6 px-2 text-zinc-400 hover:text-white">
              <Trash2 className="w-3.5 h-3.5 mr-1" />Clear
            </Button>
          </div>
          <div className="max-h-48 overflow-auto p-3 space-y-1">
            {logs.length === 0 ? (
              <div className="text-zinc-500">No logs yet. Use console.log / alert / throw inside your code, then click Run.</div>
            ) : logs.map((l, i) => (
              <div key={i} className={`whitespace-pre-wrap break-words ${levelColor(l.level)}`}>
                <span className="text-zinc-500 mr-2">[{l.level}]</span>{l.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HtmlPreviewFrame;
