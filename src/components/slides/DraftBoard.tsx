import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Pen, Download, Trash2, Undo, Redo, Code, Copy, Clipboard, MousePointer, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DraftBoardProps {
  onOpenLiveCode?: () => void;
}

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
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, text || 'Start/End', x + w / 2, y + h / 2, w - 20);
    }
  },
  {
    id: 'parallelogram', name: 'Input/Output', icon: '▱', desc: 'Read / Display data',
    draw: (ctx, x, y, w, h, color, text) => {
      const skew = w * 0.2;
      ctx.beginPath(); ctx.moveTo(x + skew, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - skew, y + h); ctx.lineTo(x, y + h); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, text || 'I/O', x + w / 2, y + h / 2, w - 40);
    }
  },
  {
    id: 'rectangle', name: 'Process', icon: '▭', desc: 'Calculation / Assignment',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#000'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, text || 'Process', x + w / 2, y + h / 2, w - 16);
    }
  },
  {
    id: 'diamond', name: 'Decision', icon: '◇', desc: 'If-else / True-False',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, text || 'Condition?', x + w / 2, y + h / 2, w * 0.5);
    }
  },
  {
    id: 'predefined', name: 'Predefined Process', icon: '⊞', desc: 'Function / Subroutine',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      const inset = 12;
      ctx.beginPath(); ctx.moveTo(x + inset, y); ctx.lineTo(x + inset, y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w - inset, y); ctx.lineTo(x + w - inset, y + h); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, text || 'Function()', x + w / 2, y + h / 2, w - 30);
    }
  },
  {
    id: 'cylinder', name: 'Database', icon: '⛁', desc: 'Store / Retrieve data',
    draw: (ctx, x, y, w, h, color, text) => {
      const ry = 12;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + ry); ctx.lineTo(x, y + h - ry); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w, y + ry); ctx.lineTo(x + w, y + h - ry); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(x + 1, y + ry, w - 2, h - 2 * ry);
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, text || 'Database', x + w / 2, y + h / 2, w - 16);
    }
  },
  {
    id: 'hexagon', name: 'Preparation', icon: '⬡', desc: 'Initialization (i = 0)',
    draw: (ctx, x, y, w, h, color, text) => {
      const inset = w * 0.15;
      ctx.beginPath(); ctx.moveTo(x + inset, y); ctx.lineTo(x + w - inset, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w - inset, y + h); ctx.lineTo(x + inset, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, text || 'Init', x + w / 2, y + h / 2, w - 30);
    }
  },
  {
    id: 'connector', name: 'On-Page Connector', icon: '●', desc: 'Connect parts on same page',
    draw: (ctx, x, y, w, h, color, text) => {
      const r = Math.min(w, h) / 2;
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || 'A', x + w / 2, y + h / 2);
    }
  },
  {
    id: 'offpage', name: 'Off-Page Connector', icon: '⌂', desc: 'Connect to different page',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.65); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h * 0.65); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text || '1', x + w / 2, y + h * 0.4);
    }
  },
  {
    id: 'document', name: 'Document', icon: '📄', desc: 'Printed report / Log',
    draw: (ctx, x, y, w, h, color, text) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.85);
      ctx.bezierCurveTo(x + w * 0.75, y + h * 0.75, x + w * 0.25, y + h * 1.05, x, y + h * 0.85); ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, text || 'Document', x + w / 2, y + h * 0.4, w - 16);
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
  {
    id: 'arrow_left', name: 'Arrow Left', icon: '←', desc: 'Flow direction',
    draw: (ctx, x, y, w, h, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = color;
      const cy = y + h / 2;
      ctx.beginPath(); ctx.moveTo(x + w, cy); ctx.lineTo(x + w * 0.3, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * 0.35, cy - 8); ctx.lineTo(x, cy); ctx.lineTo(x + w * 0.35, cy + 8); ctx.fill();
    }
  },
  {
    id: 'arrow_up', name: 'Arrow Up', icon: '↑', desc: 'Flow direction',
    draw: (ctx, x, y, w, h, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = color;
      const cx = x + w / 2;
      ctx.beginPath(); ctx.moveTo(cx, y + h); ctx.lineTo(cx, y + h * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 8, y + h * 0.35); ctx.lineTo(cx, y); ctx.lineTo(cx + 8, y + h * 0.35); ctx.fill();
    }
  },
];

// Helper: wrap text inside shape
function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxWidth: number) {
  const lineHeight = 16;
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    const words = para.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine || '');
  }
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lineHeight);
  });
}

interface PlacedShape {
  shapeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
}

interface ConnectionLine {
  fromIdx: number;
  toIdx: number;
  color: string;
  label: string;
}

const HANDLE_SIZE = 8;
const CONNECTION_PORT_SIZE = 7;

const DraftBoard = ({ onOpenLiveCode }: DraftBoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
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
  const [selectedShapeIdx, setSelectedShapeIdx] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{ type: 'move' | 'resize' | 'port_drag'; corner?: string; offsetX: number; offsetY: number; fromIdx?: number } | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const [clipboard, setClipboard] = useState<PlacedShape | null>(null);
  const [connections, setConnections] = useState<ConnectionLine[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<number | null>(null);
  const [flowTool, setFlowTool] = useState<'select' | 'shape' | 'connect'>('select');
  const [multiSelect, setMultiSelect] = useState<number[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [portDragFrom, setPortDragFrom] = useState<{ shapeIdx: number; portSide: string } | null>(null);
  const { toast } = useToast();

  // Undo/Redo history for shapes
  const [shapeHistory, setShapeHistory] = useState<{ shapes: PlacedShape[]; conns: ConnectionLine[] }[]>([]);
  const [shapeHistoryStep, setShapeHistoryStep] = useState(-1);

  // Base drawing layer (pen/eraser strokes only, no shapes)
  const baseImageRef = useRef<string | null>(null);

  const saveShapeSnapshot = useCallback(() => {
    setShapeHistory(prev => {
      const newHist = prev.slice(0, shapeHistoryStep + 1);
      newHist.push({ shapes: JSON.parse(JSON.stringify(placedShapes)), conns: JSON.parse(JSON.stringify(connections)) });
      return newHist;
    });
    setShapeHistoryStep(prev => prev + 1);
  }, [placedShapes, connections, shapeHistoryStep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = Math.max(container.clientHeight, 5000);
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveBaseImage();
      saveToHistory();
    }
  }, []);

  useEffect(() => {
    redrawAll();
  }, [placedShapes, selectedShapeIdx, connections, connectFrom, multiSelect, mousePos, portDragFrom]);

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y redo, Ctrl+D/Delete delete, Ctrl+C copy, Ctrl+V paste
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle shortcuts when editing text
      if (editingIdx !== null) return;

      // Ctrl+Z = Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Ctrl+Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Ctrl+C = Copy selected shape
      if (e.ctrlKey && e.key === 'c' && selectedShapeIdx !== null) {
        e.preventDefault();
        setClipboard({ ...placedShapes[selectedShapeIdx] });
        toast({ title: "Shape copied" });
        return;
      }
      // Ctrl+V = Paste shape
      if (e.ctrlKey && e.key === 'v' && clipboard) {
        e.preventDefault();
        const newShape = { ...clipboard, x: clipboard.x + 30, y: clipboard.y + 30 };
        setPlacedShapes(prev => [...prev, newShape]);
        setSelectedShapeIdx(placedShapes.length);
        saveShapeSnapshot();
        toast({ title: "Shape pasted" });
        return;
      }
      // Ctrl+A = Select all
      if (e.ctrlKey && e.key === 'a' && activeTab === 'flowchart') {
        e.preventDefault();
        setMultiSelect(placedShapes.map((_, i) => i));
        return;
      }
      // Delete or Ctrl+D = delete selected shape(s)
      if (e.key === 'Delete' || (e.ctrlKey && e.key === 'd')) {
        e.preventDefault();
        if (multiSelect.length > 0) {
          const toDelete = new Set(multiSelect);
          setPlacedShapes(prev => prev.filter((_, i) => !toDelete.has(i)));
          setConnections(prev => prev.filter(c => !toDelete.has(c.fromIdx) && !toDelete.has(c.toIdx)));
          setMultiSelect([]);
          setSelectedShapeIdx(null);
          saveShapeSnapshot();
          toast({ title: `${toDelete.size} shapes deleted` });
        } else if (selectedShapeIdx !== null) {
          const idx = selectedShapeIdx;
          setPlacedShapes(prev => prev.filter((_, i) => i !== idx));
          setConnections(prev => prev.filter(c => c.fromIdx !== idx && c.toIdx !== idx).map(c => ({
            ...c,
            fromIdx: c.fromIdx > idx ? c.fromIdx - 1 : c.fromIdx,
            toIdx: c.toIdx > idx ? c.toIdx - 1 : c.toIdx,
          })));
          setSelectedShapeIdx(null);
          saveShapeSnapshot();
          toast({ title: "Shape deleted" });
        }
        return;
      }
      // Escape = deselect
      if (e.key === 'Escape') {
        setSelectedShapeIdx(null);
        setMultiSelect([]);
        setConnectFrom(null);
        setConnectMode(false);
        setFlowTool('select');
        setSelectedShape(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedShapeIdx, editingIdx, clipboard, placedShapes, connections, multiSelect, activeTab, shapeHistoryStep, shapeHistory]);

  const handleUndo = () => {
    if (shapeHistoryStep > 0) {
      const prev = shapeHistory[shapeHistoryStep - 1];
      setPlacedShapes(JSON.parse(JSON.stringify(prev.shapes)));
      setConnections(JSON.parse(JSON.stringify(prev.conns)));
      setShapeHistoryStep(s => s - 1);
      setSelectedShapeIdx(null);
    }
    undo();
  };

  const handleRedo = () => {
    if (shapeHistoryStep < shapeHistory.length - 1) {
      const next = shapeHistory[shapeHistoryStep + 1];
      setPlacedShapes(JSON.parse(JSON.stringify(next.shapes)));
      setConnections(JSON.parse(JSON.stringify(next.conns)));
      setShapeHistoryStep(s => s + 1);
      setSelectedShapeIdx(null);
    }
    redo();
  };

  const saveBaseImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    baseImageRef.current = canvas.toDataURL();
  };

  const getShapeCenter = (s: PlacedShape) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });

  const getConnectionPorts = (s: PlacedShape) => [
    { x: s.x + s.w / 2, y: s.y, side: 'top' },          // top
    { x: s.x + s.w, y: s.y + s.h / 2, side: 'right' },    // right
    { x: s.x + s.w / 2, y: s.y + s.h, side: 'bottom' },   // bottom
    { x: s.x, y: s.y + s.h / 2, side: 'left' },           // left
  ];

  const drawConnectionPorts = (ctx: CanvasRenderingContext2D, s: PlacedShape, highlight: boolean) => {
    const ports = getConnectionPorts(s);
    ports.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, CONNECTION_PORT_SIZE, 0, Math.PI * 2);
      ctx.fillStyle = highlight ? '#3b82f6' : 'rgba(100,116,139,0.6)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Inner dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });
  };

  const hitTestPort = (px: number, py: number): { shapeIdx: number; portSide: string } | null => {
    for (let i = placedShapes.length - 1; i >= 0; i--) {
      const ports = getConnectionPorts(placedShapes[i]);
      for (const port of ports) {
        const dist = Math.sqrt((px - port.x) ** 2 + (py - port.y) ** 2);
        if (dist <= CONNECTION_PORT_SIZE + 4) {
          return { shapeIdx: i, portSide: port.side };
        }
      }
    }
    return null;
  };

  const drawArrowLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lineColor: string, label: string, isDotted: boolean = true) => {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash(isDotted ? [8, 5] : []);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 14;
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Label
    if (label) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(midX - tw / 2, midY - 8, tw, 16);
      ctx.fillStyle = '#000';
      ctx.fillText(label, midX, midY);
    }
  };

  // Get the nearest port point between two shapes for connection
  const getNearestPorts = (from: PlacedShape, to: PlacedShape) => {
    const fromPorts = getConnectionPorts(from);
    const toPorts = getConnectionPorts(to);
    let minDist = Infinity;
    let bestFrom = fromPorts[0];
    let bestTo = toPorts[0];
    for (const fp of fromPorts) {
      for (const tp of toPorts) {
        const d = Math.sqrt((fp.x - tp.x) ** 2 + (fp.y - tp.y) ** 2);
        if (d < minDist) { minDist = d; bestFrom = fp; bestTo = tp; }
      }
    }
    return { from: bestFrom, to: bestTo };
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (baseImageRef.current) {
      const img = new Image();
      img.src = baseImageRef.current;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Draw connection lines using nearest ports (dotted with arrows)
        connections.forEach(conn => {
          if (conn.fromIdx < placedShapes.length && conn.toIdx < placedShapes.length) {
            const ports = getNearestPorts(placedShapes[conn.fromIdx], placedShapes[conn.toIdx]);
            drawArrowLine(ctx, ports.from.x, ports.from.y, ports.to.x, ports.to.y, conn.color, conn.label, true);
          }
        });

        // Draw all shapes
        placedShapes.forEach((s, idx) => {
          const shape = FLOWCHART_SHAPES.find(fs => fs.id === s.shapeId);
          if (shape) {
            ctx.save();
            shape.draw(ctx, s.x, s.y, s.w, s.h, s.color, s.text);
            ctx.restore();
          }
          // Always show connection ports on all shapes in flowchart tab
          if (activeTab === 'flowchart') {
            const isHighlighted = idx === selectedShapeIdx || idx === connectFrom || (portDragFrom?.shapeIdx === idx);
            drawConnectionPorts(ctx, s, isHighlighted);
          }
          // Draw selection handles
          if (idx === selectedShapeIdx || multiSelect.includes(idx)) {
            drawSelectionHandles(ctx, s, multiSelect.includes(idx));
          }
        });

        // Draw port drag preview (dotted line with arrow following cursor)
        if (portDragFrom && mousePos) {
          const fromShape = placedShapes[portDragFrom.shapeIdx];
          const ports = getConnectionPorts(fromShape);
          const fromPort = ports.find(p => p.side === portDragFrom.portSide) || ports[0];
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 5]);
          ctx.beginPath();
          ctx.moveTo(fromPort.x, fromPort.y);
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.stroke();
          ctx.setLineDash([]);
          // Arrowhead at cursor
          const angle = Math.atan2(mousePos.y - fromPort.y, mousePos.x - fromPort.x);
          const headLen = 12;
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.moveTo(mousePos.x, mousePos.y);
          ctx.lineTo(mousePos.x - headLen * Math.cos(angle - Math.PI / 6), mousePos.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(mousePos.x - headLen * Math.cos(angle + Math.PI / 6), mousePos.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }

        // Draw connecting line preview following cursor (click-connect mode)
        if (connectFrom !== null && (connectMode || flowTool === 'connect') && mousePos && !portDragFrom) {
          const fromShape = placedShapes[connectFrom];
          const fromCenter = getShapeCenter(fromShape);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 5]);
          ctx.beginPath();
          ctx.moveTo(fromCenter.x, fromCenter.y);
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.stroke();
          ctx.setLineDash([]);
          const angle = Math.atan2(mousePos.y - fromCenter.y, mousePos.x - fromCenter.x);
          const headLen = 12;
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.moveTo(mousePos.x, mousePos.y);
          ctx.lineTo(mousePos.x - headLen * Math.cos(angle - Math.PI / 6), mousePos.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(mousePos.x - headLen * Math.cos(angle + Math.PI / 6), mousePos.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      };
    }
  };

  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, s: PlacedShape, isMulti: boolean) => {
    ctx.strokeStyle = isMulti ? '#8b5cf6' : '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8);
    ctx.setLineDash([]);
    const corners = [
      { x: s.x - 4, y: s.y - 4 },
      { x: s.x + s.w - 4, y: s.y - 4 },
      { x: s.x - 4, y: s.y + s.h - 4 },
      { x: s.x + s.w - 4, y: s.y + s.h - 4 },
    ];
    corners.forEach(c => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c.x, c.y, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeStyle = isMulti ? '#8b5cf6' : '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x, c.y, HANDLE_SIZE, HANDLE_SIZE);
    });
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

  const hitTestShape = (px: number, py: number): number | null => {
    for (let i = placedShapes.length - 1; i >= 0; i--) {
      const s = placedShapes[i];
      if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return i;
    }
    return null;
  };

  const hitTestHandle = (px: number, py: number, s: PlacedShape): string | null => {
    const handles: Record<string, { x: number; y: number }> = {
      'tl': { x: s.x - 4, y: s.y - 4 },
      'tr': { x: s.x + s.w - 4, y: s.y - 4 },
      'bl': { x: s.x - 4, y: s.y + s.h - 4 },
      'br': { x: s.x + s.w - 4, y: s.y + s.h - 4 },
    };
    for (const [key, h] of Object.entries(handles)) {
      if (px >= h.x && px <= h.x + HANDLE_SIZE && py >= h.y && py <= h.y + HANDLE_SIZE) return key;
    }
    return null;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // Check if clicking on a connection port to drag-connect
    if (activeTab === 'flowchart') {
      const portHit = hitTestPort(point.x, point.y);
      if (portHit) {
        setPortDragFrom(portHit);
        setDragState({ type: 'port_drag', offsetX: point.x, offsetY: point.y, fromIdx: portHit.shapeIdx });
        setMousePos(point);
        return;
      }
    }

    // Connect mode: click shapes to connect them
    if (flowTool === 'connect' || connectMode) {
      const hitIdx = hitTestShape(point.x, point.y);
      if (hitIdx !== null) {
        if (connectFrom === null) {
          setConnectFrom(hitIdx);
          toast({ title: "Now click the target shape to connect" });
        } else if (hitIdx !== connectFrom) {
          const label = '';
          setConnections(prev => [...prev, { fromIdx: connectFrom, toIdx: hitIdx, color, label }]);
          setConnectFrom(null);
          setConnectMode(false);
          setFlowTool('select');
          saveShapeSnapshot();
          toast({ title: "Shapes connected!" });
        }
      } else {
        setConnectFrom(null);
      }
      return;
    }

    // Flowchart mode: placing new shape
    if (activeTab === 'flowchart' && selectedShape) {
      const shapeDef = FLOWCHART_SHAPES.find(s => s.id === selectedShape);
      if (!shapeDef) return;
      const isArrow = selectedShape.startsWith('arrow_');
      const w = isArrow ? 30 : 140;
      const h = isArrow ? 50 : (selectedShape === 'diamond' ? 100 : selectedShape === 'connector' ? 40 : 60);
      const text = isArrow ? '' : shapeDef.name;
      const newShape: PlacedShape = { shapeId: selectedShape, x: point.x - w / 2, y: point.y - h / 2, w, h, text, color };
      setPlacedShapes(prev => [...prev, newShape]);
      setSelectedShapeIdx(placedShapes.length);
      setSelectedShape(null);
      setFlowTool('select');
      saveShapeSnapshot();
      toast({ title: `${shapeDef.icon} ${shapeDef.name} placed! Double-click to edit.` });
      return;
    }

    // Check if clicking on a selected shape's resize handle
    if (selectedShapeIdx !== null) {
      const s = placedShapes[selectedShapeIdx];
      const handle = hitTestHandle(point.x, point.y, s);
      if (handle) {
        setDragState({ type: 'resize', corner: handle, offsetX: point.x, offsetY: point.y });
        return;
      }
    }

    // Check if clicking on any shape to select/move
    const hitIdx = hitTestShape(point.x, point.y);
    if (hitIdx !== null) {
      // Shift+click for multi-select
      if (e.shiftKey) {
        setMultiSelect(prev => prev.includes(hitIdx) ? prev.filter(i => i !== hitIdx) : [...prev, hitIdx]);
        return;
      }
      setMultiSelect([]);
      setSelectedShapeIdx(hitIdx);
      const s = placedShapes[hitIdx];
      setDragState({ type: 'move', offsetX: point.x - s.x, offsetY: point.y - s.y });
      return;
    }

    // Clicked empty area: deselect
    setSelectedShapeIdx(null);
    setMultiSelect([]);
    if (editingIdx !== null) {
      commitEdit();
    }

    // Start drawing with pen/eraser
    if (activeTab === 'draw') {
      setIsDrawing(true);
      lastPointRef.current = point;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.beginPath(); ctx.moveTo(point.x, point.y); }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // Port drag: track mouse for preview line
    if (portDragFrom && dragState?.type === 'port_drag') {
      setMousePos(point);
      return;
    }

    // Always track mouse position for connect preview line
    if ((connectMode || flowTool === 'connect') && connectFrom !== null) {
      setMousePos(point);
    }

    // Dragging a shape
    if (dragState && selectedShapeIdx !== null) {
      setPlacedShapes(prev => {
        const updated = [...prev];
        const s = { ...updated[selectedShapeIdx] };
        if (dragState.type === 'move') {
          s.x = point.x - dragState.offsetX;
          s.y = point.y - dragState.offsetY;
        } else if (dragState.type === 'resize' && dragState.corner) {
          const minSize = 30;
          if (dragState.corner === 'br') {
            s.w = Math.max(minSize, point.x - s.x);
            s.h = Math.max(minSize, point.y - s.y);
          } else if (dragState.corner === 'bl') {
            const newW = Math.max(minSize, s.x + s.w - point.x);
            s.x = s.x + s.w - newW;
            s.w = newW;
            s.h = Math.max(minSize, point.y - s.y);
          } else if (dragState.corner === 'tr') {
            s.w = Math.max(minSize, point.x - s.x);
            const newH = Math.max(minSize, s.y + s.h - point.y);
            s.y = s.y + s.h - newH;
            s.h = newH;
          } else if (dragState.corner === 'tl') {
            const newW = Math.max(minSize, s.x + s.w - point.x);
            const newH = Math.max(minSize, s.y + s.h - point.y);
            s.x = s.x + s.w - newW;
            s.y = s.y + s.h - newH;
            s.w = newW;
            s.h = newH;
          }
        }
        updated[selectedShapeIdx] = s;
        return updated;
      });
      return;
    }

    // Drawing pen/eraser
    if (!isDrawing) return;
    drawLine(point);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Port drag complete: check if released on another shape
    if (portDragFrom && dragState?.type === 'port_drag') {
      const point = getCanvasPoint(e);
      const targetIdx = hitTestShape(point.x, point.y);
      if (targetIdx !== null && targetIdx !== portDragFrom.shapeIdx) {
        setConnections(prev => [...prev, { fromIdx: portDragFrom.shapeIdx, toIdx: targetIdx, color, label: '' }]);
        saveShapeSnapshot();
        toast({ title: "Shapes connected!" });
      }
      setPortDragFrom(null);
      setDragState(null);
      setMousePos(null);
      return;
    }

    if (dragState) {
      setDragState(null);
      saveBaseImage();
      saveToHistory();
      saveShapeSnapshot();
      return;
    }
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      saveBaseImage();
      saveToHistory();
    }
  };



  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    const hitIdx = hitTestShape(point.x, point.y);
    if (hitIdx !== null) {
      const s = placedShapes[hitIdx];
      if (s.shapeId.startsWith('arrow_')) return;
      setEditingIdx(hitIdx);
      setEditText(s.text);
      setSelectedShapeIdx(hitIdx);
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  };

  const autoResizeShape = (shapeIdx: number, newText: string): PlacedShape => {
    const canvas = canvasRef.current;
    const s = { ...placedShapes[shapeIdx], text: newText };
    if (!canvas || s.shapeId.startsWith('arrow_')) return s;
    const ctx = canvas.getContext('2d');
    if (!ctx) return s;
    
    ctx.font = 'bold 14px Arial';
    const lines = newText.split('\n');
    let maxLineWidth = 0;
    for (const line of lines) {
      const words = line.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > s.w - 20 && currentLine) {
          maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width);
    }
    
    const padding = s.shapeId === 'diamond' ? 60 : s.shapeId === 'parallelogram' ? 50 : 30;
    const neededW = Math.max(80, maxLineWidth + padding);
    const totalLines = lines.reduce((count, line) => {
      const words = line.split(' ');
      let cl = '';
      let lc = 1;
      for (const word of words) {
        const tl = cl ? cl + ' ' + word : word;
        if (ctx.measureText(tl).width > Math.max(s.w, neededW) - 20 && cl) { lc++; cl = word; }
        else cl = tl;
      }
      return count + lc;
    }, 0);
    const neededH = Math.max(50, totalLines * 18 + 24);
    
    s.w = Math.max(s.w, neededW);
    s.h = Math.max(s.h, neededH);
    return s;
  };

  const commitEdit = () => {
    if (editingIdx !== null) {
      setPlacedShapes(prev => {
        const updated = [...prev];
        updated[editingIdx] = autoResizeShape(editingIdx, editText);
        return updated;
      });
      setEditingIdx(null);
      saveShapeSnapshot();
      saveToHistory();
    }
  };

  // Touch handlers
  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (activeTab === 'flowchart' && selectedShape) {
      const shapeDef = FLOWCHART_SHAPES.find(s => s.id === selectedShape);
      if (!shapeDef) return;
      const isArrow = selectedShape.startsWith('arrow_');
      const w = isArrow ? 30 : 140;
      const h = isArrow ? 50 : (selectedShape === 'diamond' ? 100 : selectedShape === 'connector' ? 40 : 60);
      const text = isArrow ? '' : shapeDef.name;
      const newShape: PlacedShape = { shapeId: selectedShape, x: point.x - w / 2, y: point.y - h / 2, w, h, text, color };
      setPlacedShapes(prev => [...prev, newShape]);
      setSelectedShapeIdx(placedShapes.length);
      setSelectedShape(null);
      saveShapeSnapshot();
      return;
    }
    const hitIdx = hitTestShape(point.x, point.y);
    if (hitIdx !== null) {
      setSelectedShapeIdx(hitIdx);
      const s = placedShapes[hitIdx];
      setDragState({ type: 'move', offsetX: point.x - s.x, offsetY: point.y - s.y });
      return;
    }
    setSelectedShapeIdx(null);
    if (activeTab === 'draw') {
      setIsDrawing(true);
      lastPointRef.current = point;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.beginPath(); ctx.moveTo(point.x, point.y); }
    }
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (dragState && selectedShapeIdx !== null) {
      setPlacedShapes(prev => {
        const updated = [...prev];
        const s = { ...updated[selectedShapeIdx] };
        s.x = point.x - dragState.offsetX;
        s.y = point.y - dragState.offsetY;
        updated[selectedShapeIdx] = s;
        return updated;
      });
      return;
    }
    if (!isDrawing) return;
    drawLine(point);
  };

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Reset port drag and other states for touch
    if (portDragFrom) {
      setPortDragFrom(null);
      setDragState(null);
      setMousePos(null);
    }
    if (dragState) {
      setDragState(null);
      saveBaseImage();
      saveToHistory();
      saveShapeSnapshot();
      return;
    }
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      saveBaseImage();
      saveToHistory();
    }
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
        baseImageRef.current = history[historyStep - 1];
      };
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
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        baseImageRef.current = history[historyStep + 1];
      };
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
      setConnections([]);
      setSelectedShapeIdx(null);
      setEditingIdx(null);
      setMultiSelect([]);
      saveBaseImage();
      saveToHistory();
      saveShapeSnapshot();
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

  const duplicateSelected = () => {
    if (selectedShapeIdx === null) return;
    const s = placedShapes[selectedShapeIdx];
    const newShape = { ...s, x: s.x + 30, y: s.y + 30 };
    setPlacedShapes(prev => [...prev, newShape]);
    setSelectedShapeIdx(placedShapes.length);
    saveShapeSnapshot();
    toast({ title: "Shape duplicated" });
  };

  // Get editing input position in screen coords
  const getEditInputStyle = (): React.CSSProperties => {
    if (editingIdx === null) return { display: 'none' };
    const canvas = canvasRef.current;
    if (!canvas) return { display: 'none' };
    const rect = canvas.getBoundingClientRect();
    const s = placedShapes[editingIdx];
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      position: 'absolute',
      left: `${s.x * scaleX + rect.left - (canvas.parentElement?.getBoundingClientRect().left || 0)}px`,
      top: `${s.y * scaleY}px`,
      width: `${s.w * scaleX}px`,
      height: `${s.h * scaleY}px`,
      background: 'rgba(255,255,255,0.95)',
      border: '2px solid #3b82f6',
      borderRadius: '4px',
      textAlign: 'center' as const,
      fontSize: '14px',
      fontFamily: 'Arial',
      outline: 'none',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    };
  };

  const getCursorClass = () => {
    if (activeTab === 'flowchart' && selectedShape) return 'cursor-cell';
    if (flowTool === 'connect' || connectMode) return 'cursor-crosshair';
    if (dragState) return dragState.type === 'resize' ? 'cursor-nwse-resize' : 'cursor-move';
    if (activeTab === 'flowchart') return 'cursor-default';
    return 'cursor-crosshair';
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
        <div className="lg:w-1/4 bg-card p-4 rounded-xl border border-border space-y-3 max-h-[80vh] overflow-y-auto">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedShape(null); setConnectMode(false); setConnectFrom(null); }}>
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
              {/* Tool selector */}
              <div>
                <label className="block text-xs font-medium mb-2">Tool</label>
                <div className="grid grid-cols-3 gap-1">
                  <Button onClick={() => { setFlowTool('select'); setConnectMode(false); setConnectFrom(null); setSelectedShape(null); }} 
                    variant={flowTool === 'select' && !selectedShape ? 'default' : 'outline'} className="gap-1 text-xs h-8">
                    <MousePointer className="w-3 h-3" /> Select
                  </Button>
                  <Button onClick={() => { setFlowTool('shape'); setConnectMode(false); setConnectFrom(null); }} 
                    variant={flowTool === 'shape' || selectedShape ? 'default' : 'outline'} className="gap-1 text-xs h-8">
                    <span className="text-sm">▭</span> Shape
                  </Button>
                  <Button onClick={() => { setFlowTool('connect'); setConnectMode(true); setConnectFrom(null); setSelectedShape(null); }} 
                    variant={flowTool === 'connect' ? 'default' : 'outline'} className="gap-1 text-xs h-8">
                    <Link2 className="w-3 h-3" /> Connect
                  </Button>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium mb-2">Color</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['#6366f1', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map((c) => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
                </div>
              </div>

              {/* Shapes grid */}
              <div className="grid grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                {FLOWCHART_SHAPES.map(shape => (
                  <button
                    key={shape.id}
                    onClick={() => { setSelectedShape(selectedShape === shape.id ? null : shape.id); setFlowTool('shape'); setConnectMode(false); }}
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
              {connectMode && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs text-center text-blue-400">
                  🔗 {connectFrom === null ? 'Click source shape' : 'Click target shape to connect'}
                </div>
              )}

              {/* Quick actions */}
              {selectedShapeIdx !== null && (
                <div className="space-y-1 pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground">Selected Shape Actions</p>
                  <div className="grid grid-cols-2 gap-1">
                    <Button onClick={duplicateSelected} variant="outline" className="gap-1 text-xs h-7">
                      <Copy className="w-3 h-3" /> Duplicate
                    </Button>
                    <Button onClick={() => { if (selectedShapeIdx !== null) { setPlacedShapes(prev => prev.filter((_, i) => i !== selectedShapeIdx)); setSelectedShapeIdx(null); saveShapeSnapshot(); } }} 
                      variant="outline" className="gap-1 text-xs h-7 text-red-400 hover:text-red-300">
                      <Trash2 className="w-3 h-3" /> Delete
                    </Button>
                  </div>
                </div>
              )}

              {/* Keyboard shortcuts guide */}
              <div className="bg-muted/50 rounded-lg p-2 text-[10px] text-muted-foreground space-y-0.5">
                <p className="font-semibold text-xs mb-1">⌨️ Shortcuts</p>
                <p><kbd className="bg-muted px-1 rounded">Ctrl+Z</kbd> Undo</p>
                <p><kbd className="bg-muted px-1 rounded">Ctrl+Y</kbd> Redo</p>
                <p><kbd className="bg-muted px-1 rounded">Ctrl+C</kbd> Copy shape</p>
                <p><kbd className="bg-muted px-1 rounded">Ctrl+V</kbd> Paste shape</p>
                <p><kbd className="bg-muted px-1 rounded">Ctrl+D</kbd> / <kbd className="bg-muted px-1 rounded">Delete</kbd> Delete</p>
                <p><kbd className="bg-muted px-1 rounded">Ctrl+A</kbd> Select all</p>
                <p><kbd className="bg-muted px-1 rounded">Shift+Click</kbd> Multi-select</p>
                <p><kbd className="bg-muted px-1 rounded">Esc</kbd> Deselect</p>
                <p>Double-click shape → edit text</p>
                <p>Corner handles → resize</p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex gap-2">
              <Button onClick={handleUndo} variant="outline" className="flex-1 gap-1 text-xs" disabled={historyStep <= 0 && shapeHistoryStep <= 0}>
                <Undo className="w-3 h-3" /> Undo
              </Button>
              <Button onClick={handleRedo} variant="outline" className="flex-1 gap-1 text-xs" disabled={historyStep >= history.length - 1 && shapeHistoryStep >= shapeHistory.length - 1}>
                <Redo className="w-3 h-3" /> Redo
              </Button>
            </div>
            <Button onClick={clearCanvas} variant="destructive" className="w-full gap-2 text-xs">
              <Trash2 className="w-3 h-3" /> Clear All
            </Button>
            <Button onClick={downloadCanvas} variant="outline" className="w-full gap-2 text-xs">
              <Download className="w-3 h-3" /> Save PNG
            </Button>
            <Button onClick={saveToPDF} className="w-full gap-2 neon-glow text-xs">
              <Download className="w-3 h-3" /> Save PDF
            </Button>
          </div>
        </div>

        <div className="lg:w-3/4 border-2 border-primary/50 rounded-xl overflow-hidden neon-glow relative">
          <canvas
            ref={canvasRef}
            className={`w-full h-full ${getCursorClass()}`}
            style={{ touchAction: 'none', backgroundColor: '#ffffff' }}
            onMouseDown={startDrawing}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onTouchStart={startDrawingTouch}
            onTouchMove={drawTouch}
            onTouchEnd={stopDrawingTouch}
            onTouchCancel={stopDrawingTouch}
          />
          {/* Inline text editor overlay */}
          {editingIdx !== null && (
            <textarea
              ref={editInputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } 
                if (e.key === 'Escape') { setEditingIdx(null); } 
              }}
              style={getEditInputStyle()}
              placeholder="Type here..."
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftBoard;
