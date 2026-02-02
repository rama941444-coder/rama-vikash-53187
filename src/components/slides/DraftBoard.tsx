import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Pen, Download, Trash2, Undo, Redo, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';

interface DraftBoardProps {
  onOpenLiveCode?: () => void;
}

const DraftBoard = ({ onOpenLiveCode }: DraftBoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#6366f1');
  const [thickness, setThickness] = useState(5);
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = Math.max(container.clientHeight, 25000);
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveToHistory();
    }
  }, []);

  const getCanvasPoint = useCallback((e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = getCanvasPoint(e);
    lastPointRef.current = point;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = getCanvasPoint(e);
    lastPointRef.current = point;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = getCanvasPoint(e);
    drawLine(point);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = getCanvasPoint(e);
    drawLine(point);
  };

  const drawLine = useCallback((point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx && lastPointRef.current) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = thickness;
      
      if (mode === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
      } else {
        ctx.globalCompositeOperation = 'destination-out';
      }
      
      // Smooth line drawing with quadratic curve
      const midX = (lastPointRef.current.x + point.x) / 2;
      const midY = (lastPointRef.current.y + point.y) / 2;
      
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      
      lastPointRef.current = point;
    }
  }, [thickness, mode, color]);

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      saveToHistory();
    }
  };

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    stopDrawing();
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataURL = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataURL);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = new Image();
      img.src = history[historyStep - 1];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      setHistoryStep(historyStep - 1);
      toast({
        title: "Undo",
        description: "Reverted to previous state",
      });
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = new Image();
      img.src = history[historyStep + 1];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      setHistoryStep(historyStep + 1);
      toast({
        title: "Redo",
        description: "Restored to next state",
      });
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveToHistory();
      toast({
        title: "Canvas cleared",
        description: "Draft board has been cleared",
      });
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'draft-board.png';
    link.href = dataURL;
    link.click();

    toast({
      title: "Draft saved",
      description: "Your draft has been downloaded",
    });
  };

  const saveToPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`draft-board-${Date.now()}.pdf`);

      toast({
        title: "PDF saved!",
        description: "Your draft has been exported to PDF",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not save PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Code Button - Top Right */}
      {onOpenLiveCode && (
        <div className="flex justify-end">
          <Button 
            onClick={onOpenLiveCode}
            className="gap-2 neon-glow"
            size="lg"
          >
            <Code className="w-5 h-5" />
            Live Code IDE
          </Button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-1/4 bg-card p-6 rounded-xl border border-border space-y-4">
          <h3 className="text-xl font-semibold mb-4">Canvas Tools</h3>

          <div>
            <label className="block text-sm font-medium mb-2">Drawing Mode</label>
            <div className="flex gap-2">
              <Button
                onClick={() => setMode('pen')}
                variant={mode === 'pen' ? 'default' : 'outline'}
                className="flex-1 gap-2"
              >
                <Pen className="w-4 h-4" />
                Pen
              </Button>
              <Button
                onClick={() => setMode('eraser')}
                variant={mode === 'eraser' ? 'default' : 'outline'}
                className="flex-1 gap-2"
              >
                <Eraser className="w-4 h-4" />
                Eraser
              </Button>
            </div>
          </div>

          {mode === 'pen' && (
            <div>
              <label className="block text-sm font-medium mb-2">Pen Color</label>
              <div className="flex gap-2">
                {['#6366f1', '#f59e0b', '#10b981', '#000000'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-4 ring-primary ring-offset-2 ring-offset-background' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              {mode === 'pen' ? 'Pen' : 'Eraser'} Thickness: {thickness}px
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={thickness}
              onChange={(e) => setThickness(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex gap-2">
              <Button 
                onClick={undo} 
                variant="outline" 
                className="flex-1 gap-2"
                disabled={historyStep <= 0}
              >
                <Undo className="w-4 h-4" />
                Undo
              </Button>
              <Button 
                onClick={redo} 
                variant="outline" 
                className="flex-1 gap-2"
                disabled={historyStep >= history.length - 1}
              >
                <Redo className="w-4 h-4" />
                Redo
              </Button>
            </div>
            <Button onClick={clearCanvas} variant="destructive" className="w-full gap-2">
              <Trash2 className="w-4 h-4" />
              Clear Draft
            </Button>
            <Button onClick={downloadCanvas} variant="outline" className="w-full gap-2">
              <Download className="w-4 h-4" />
              Save Draft
            </Button>
            <Button onClick={saveToPDF} className="w-full gap-2 neon-glow">
              <Download className="w-4 h-4" />
              Save to PDF
            </Button>
          </div>
        </div>

        <div className="lg:w-3/4 border-2 border-primary/50 rounded-xl overflow-hidden neon-glow">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair"
            style={{ touchAction: 'none', backgroundColor: '#ffffff' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawingTouch}
            onTouchMove={drawTouch}
            onTouchEnd={stopDrawingTouch}
            onTouchCancel={stopDrawingTouch}
          />
        </div>
      </div>
    </div>
  );
};

export default DraftBoard;
