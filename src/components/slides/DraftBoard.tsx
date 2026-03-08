import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Pen, Download, Trash2, Undo, Redo, Code, Square, Circle, Minus, Move, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DraftBoardProps {
  onOpenLiveCode?: () => void;
}

// Flowchart shape definitions
interface FlowShape {
  id: string;
  name: string;
  icon: string;
  desc: string;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, text: string) => void;
}

const FLOWCHART_SHAPES: FlowShape[] = [
  {
    id: 'oval', name: 'Terminator', icon: '⬭', desc: 'Start / End',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'Start/End', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'parallelogram', name: 'Input/Output', icon: '▱', desc: 'Read / Display data',
    draw: (ctx, x, y, w, h, color, text) => {
      const skew = w * 0.2;
      ctx.beginPath();
      ctx.moveTo(x + skew, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - skew, y + h); ctx.lineTo(x, y + h); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'I/O', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'rectangle', name: 'Process', icon: '▭', desc: 'Calculation / Assignment',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#000'; ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'Process', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'diamond', name: 'Decision', icon: '◇', desc: 'If-else / True-False',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'Condition?', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'predefined', name: 'Predefined Process', icon: '⊞', desc: 'Function / Subroutine',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      // Double vertical lines
      const inset = 12;
      ctx.beginPath(); ctx.moveTo(x + inset, y); ctx.lineTo(x + inset, y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w - inset, y); ctx.lineTo(x + w - inset, y + h); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.font = '13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'Function()', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'cylinder', name: 'Database', icon: '⛁', desc: 'Store / Retrieve data',
    draw: (ctx, x, y, w, h, color, text) => {
      const ry = 12;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      // Body
      ctx.beginPath(); ctx.moveTo(x, y + ry); ctx.lineTo(x, y + h - ry); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w, y + ry); ctx.lineTo(x + w, y + h - ry); ctx.stroke();
      // Top ellipse
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      // Bottom ellipse
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
      // Fill body
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(x + 1, y + ry, w - 2, h - 2 * ry);
      ctx.fillStyle = '#000'; ctx.font = '13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'Database', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'hexagon', name: 'Preparation', icon: '⬡', desc: 'Initialization (i = 0)',
    draw: (ctx, x, y, w, h, color, text) => {
      const inset = w * 0.15;
      ctx.beginPath();
      ctx.moveTo(x + inset, y); ctx.lineTo(x + w - inset, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w - inset, y + h); ctx.lineTo(x + inset, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'Init', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'connector', name: 'On-Page Connector', icon: '●', desc: 'Connect parts on same page',
    draw: (ctx, x, y, w, h, color, text) => {
      const r = Math.min(w, h) / 2;
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'A', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'offpage', name: 'Off-Page Connector', icon: '⌂', desc: 'Connect to different page',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.65); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h * 0.65); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || '1', x + w / 2, y + h * 0.4);
    }
  },
  {
    id: 'document', name: 'Document', icon: '📄', desc: 'Printed report / Log',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.85);
      ctx.bezierCurveTo(x + w * 0.75, y + h * 0.75, x + w * 0.25, y + h * 1.05, x, y + h * 0.85);
      ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'Document', x + w / 2, y + h * 0.4);
    }
  },
  {
    id: 'arrow_down', name: 'Arrow Down', icon: '↓', desc: 'Flow direction',
    draw: (ctx, x, y, w, h, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = color;
      const cx = x + w / 2;
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 8, y + h * 0.65); ctx.lineTo(cx, y + h); ctx.lineTo(cx + 8, y + h * 0.65); ctx.fill();
    }
  },
  {
    id: 'arrow_right', name: 'Arrow Right', icon: '→', desc: 'Flow direction',
    draw: (ctx, x, y, w, h, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = color;
      const cy = y + h / 2;
      ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w * 0.7, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * 0.65, cy - 8); ctx.lineTo(x + w, cy); ctx.lineTo(x + w * 0.65, cy + 8); ctx.fill();
    }
  },
];

interface PlacedShape {
  shapeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
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
  const [activeTab, setActiveTab] = useState('draw');
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [placedShapes, setPlacedShapes] = useState<PlacedShape[]>([]);
  const [editingShapeIdx, setEditingShapeIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
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

  // Redraw shapes on canvas whenever placedShapes changes
  useEffect(() => {
    redrawShapes();
  }, [placedShapes]);

  const redrawShapes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Restore base canvas from history first
    if (history.length > 0 && historyStep >= 0) {
      const img = new Image();
      img.src = history[historyStep];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        // Draw all shapes on top
        placedShapes.forEach((s, idx) => {
          const shape = FLOWCHART_SHAPES.find(fs => fs.id === s.shapeId);
          if (shape) {
            ctx.save();
            shape.draw(ctx, s.x, s.y, s.w, s.h, s.color, s.text);
            ctx.restore();
          }
        });
      };
    }
  };

  const getCanvasPoint = useCallback((e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab === 'flowchart' && selectedShape) {
      // Place shape at click position
      const point = getCanvasPoint(e);
      const shapeDef = FLOWCHART_SHAPES.find(s => s.id === selectedShape);
      if (!shapeDef) return;
      const isArrow = selectedShape.startsWith('arrow_');
      const w = isArrow ? 30 : 140;
      const h = isArrow ? 50 : (selectedShape === 'diamond' ? 80 : selectedShape === 'connector' ? 40 : 60);
      const text = isArrow ? '' : prompt(`Enter text for ${shapeDef.name}:`, shapeDef.name) || shapeDef.name;
      const newShape: PlacedShape = { shapeId: selectedShape, x: point.x - w / 2, y: point.y - h / 2, w, h, text, color };
      setPlacedShapes(prev => [...prev, newShape]);
      // Draw immediately
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          shapeDef.draw(ctx, newShape.x, newShape.y, newShape.w, newShape.h, color, text);
          ctx.restore();
        }
      }
      saveToHistory();
      toast({ title: `${shapeDef.icon} ${shapeDef.name} placed!` });
      return;
    }

    setIsDrawing(true);
    const point = getCanvasPoint(e);
    lastPointRef.current = point;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.beginPath(); ctx.moveTo(point.x, point.y); }
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (activeTab === 'flowchart' && selectedShape) {
      const point = getCanvasPoint(e);
      const shapeDef = FLOWCHART_SHAPES.find(s => s.id === selectedShape);
      if (!shapeDef) return;
      const isArrow = selectedShape.startsWith('arrow_');
      const w = isArrow ? 30 : 140;
      const h = isArrow ? 50 : (selectedShape === 'diamond' ? 80 : selectedShape === 'connector' ? 40 : 60);
      const text = isArrow ? '' : shapeDef.name;
      const newShape: PlacedShape = { shapeId: selectedShape, x: point.x - w / 2, y: point.y - h / 2, w, h, text, color };
      setPlacedShapes(prev => [...prev, newShape]);
      saveToHistory();
      return;
    }
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    lastPointRef.current = point;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.beginPath(); ctx.moveTo(point.x, point.y); }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const point = getCanvasPoint(e);
    drawLine(point);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const point = getCanvasPoint(e);
    drawLine(point);
  };

  const drawLine = useCallback((point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx && lastPointRef.current) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = thickness;
      if (mode === 'pen') { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; }
      else { ctx.globalCompositeOperation = 'destination-out'; }
      const midX = (lastPointRef.current.x + point.x) / 2;
      const midY = (lastPointRef.current.y + point.y) / 2;
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke(); ctx.beginPath(); ctx.moveTo(midX, midY);
      lastPointRef.current = point;
    }
  }, [thickness, mode, color]);

  const stopDrawing = () => {
    if (isDrawing) { setIsDrawing(false); lastPointRef.current = null; saveToHistory(); }
  };

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); stopDrawing(); };

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
      img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
      setHistoryStep(historyStep - 1);
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
      img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
      setHistoryStep(historyStep + 1);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setPlacedShapes([]);
      saveToHistory();
      toast({ title: "Canvas cleared" });
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'draft-board.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: "Draft saved" });
  };

  const saveToPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`draft-board-${Date.now()}.pdf`);
      toast({ title: "PDF saved!" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {onOpenLiveCode && (
        <div className="flex justify-end">
          <Button onClick={onOpenLiveCode} className="gap-2 neon-glow" size="lg">
            <Code className="w-5 h-5" /> Live Code IDE
          </Button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-1/4 bg-card p-4 rounded-xl border border-border space-y-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="draw">🖊️ Draw</TabsTrigger>
              <TabsTrigger value="flowchart">📐 Flowchart</TabsTrigger>
            </TabsList>

            <TabsContent value="draw" className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-medium mb-2">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => setMode('pen')} variant={mode === 'pen' ? 'default' : 'outline'} className="gap-1 text-xs">
                    <Pen className="w-3 h-3" /> Pen
                  </Button>
                  <Button onClick={() => setMode('eraser')} variant={mode === 'eraser' ? 'default' : 'outline'} className="gap-1 text-xs">
                    <Eraser className="w-3 h-3" /> Eraser
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2">Color</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['#6366f1', '#f59e0b', '#10b981', '#000000', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'].map((c) => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Thickness: {thickness}px</label>
                <input type="range" min="1" max="100" value={thickness} onChange={(e) => setThickness(parseInt(e.target.value))} className="w-full" />
              </div>
            </TabsContent>

            <TabsContent value="flowchart" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">Select a shape, then click on the canvas to place it. You'll be prompted to enter text.</p>
              <div>
                <label className="block text-xs font-medium mb-2">Color</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['#6366f1', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map((c) => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-[350px] overflow-y-auto pr-1">
                {FLOWCHART_SHAPES.map(shape => (
                  <button
                    key={shape.id}
                    onClick={() => setSelectedShape(selectedShape === shape.id ? null : shape.id)}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-xs transition-all ${
                      selectedShape === shape.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                  >
                    <span className="text-lg">{shape.icon}</span>
                    <span className="font-medium text-[10px] leading-tight text-center">{shape.name}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight text-center">{shape.desc}</span>
                  </button>
                ))}
              </div>
              {selectedShape && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-2 text-xs text-center">
                  ✅ Click on canvas to place <b>{FLOWCHART_SHAPES.find(s => s.id === selectedShape)?.name}</b>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex gap-2">
              <Button onClick={undo} variant="outline" className="flex-1 gap-1 text-xs" disabled={historyStep <= 0}>
                <Undo className="w-3 h-3" /> Undo
              </Button>
              <Button onClick={redo} variant="outline" className="flex-1 gap-1 text-xs" disabled={historyStep >= history.length - 1}>
                <Redo className="w-3 h-3" /> Redo
              </Button>
            </div>
            <Button onClick={clearCanvas} variant="destructive" className="w-full gap-2 text-xs">
              <Trash2 className="w-3 h-3" /> Clear
            </Button>
            <Button onClick={downloadCanvas} variant="outline" className="w-full gap-2 text-xs">
              <Download className="w-3 h-3" /> Save PNG
            </Button>
            <Button onClick={saveToPDF} className="w-full gap-2 neon-glow text-xs">
              <Download className="w-3 h-3" /> Save PDF
            </Button>
          </div>
        </div>

        <div className="lg:w-3/4 border-2 border-primary/50 rounded-xl overflow-hidden neon-glow">
          <canvas
            ref={canvasRef}
            className={`w-full h-full ${activeTab === 'flowchart' && selectedShape ? 'cursor-cell' : 'cursor-crosshair'}`}
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
