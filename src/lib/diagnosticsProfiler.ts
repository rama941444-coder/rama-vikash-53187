/**
 * Slide 5 only — offline performance profiler for incremental AST parsing
 * and diagnostics. Zero network cost: everything is measured in-page.
 */

export interface ProfileSample {
  at: number;
  totalMs: number;
  astMs: number;
  rulesMs: number;
  lspMs: number;
  chars: number;
  lines: number;
  findings: number;
  engine: 'LSP' | 'AST' | 'Rules';
  heapMB: number | null;
}

export interface ProfileStats {
  samples: number;
  p50: number;
  p95: number;
  max: number;
  avgAst: number;
  avgRules: number;
  heapMB: number | null;
  lastEngine: ProfileSample['engine'] | null;
  withinTarget: boolean;
}

/** Typing-latency budget (ms) for a single incremental diagnostics pass. */
export const LATENCY_TARGET_MS = 16;
export const HEAP_TARGET_MB = 350;

const MAX_SAMPLES = 120;
const samples: ProfileSample[] = [];
const listeners = new Set<() => void>();

export function heapMB(): number | null {
  const mem = (performance as any)?.memory;
  if (!mem?.usedJSHeapSize) return null;
  return mem.usedJSHeapSize / (1024 * 1024);
}

export function recordSample(sample: Omit<ProfileSample, 'at' | 'heapMB'>) {
  samples.push({ ...sample, at: Date.now(), heapMB: heapMB() });
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
  listeners.forEach((l) => l());
}

export function subscribeProfiler(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSamples(): ProfileSample[] {
  return samples.slice();
}

export function clearSamples() {
  samples.length = 0;
  listeners.forEach((l) => l());
}

const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

export function getStats(): ProfileStats {
  const totals = samples.map((s) => s.totalMs).sort((a, b) => a - b);
  const last = samples[samples.length - 1] || null;
  const avg = (pick: (s: ProfileSample) => number) =>
    samples.length ? samples.reduce((sum, s) => sum + pick(s), 0) / samples.length : 0;
  const p95 = percentile(totals, 95);
  const currentHeap = last?.heapMB ?? heapMB();
  return {
    samples: samples.length,
    p50: percentile(totals, 50),
    p95,
    max: totals.length ? totals[totals.length - 1] : 0,
    avgAst: avg((s) => s.astMs),
    avgRules: avg((s) => s.rulesMs),
    heapMB: currentHeap,
    lastEngine: last?.engine ?? null,
    withinTarget: (!totals.length || p95 <= LATENCY_TARGET_MS) && (currentHeap === null || currentHeap <= HEAP_TARGET_MB),
  };
}

export interface BenchmarkResult {
  label: string;
  keystrokes: number;
  p50: number;
  p95: number;
  maxMs: number;
  heapDeltaMB: number | null;
}

/**
 * Offline benchmark: replays character-by-character typing through the
 * supplied diagnostics function and reports latency percentiles.
 */
export async function runTypingBenchmark(
  label: string,
  source: string,
  run: (snapshot: string) => unknown,
  step = 4,
): Promise<BenchmarkResult> {
  const before = heapMB();
  const durations: number[] = [];
  for (let i = 1; i <= source.length; i += step) {
    const snapshot = source.slice(0, i);
    const t0 = performance.now();
    try { run(snapshot); } catch { /* keep benchmarking */ }
    durations.push(performance.now() - t0);
    if (i % 400 < step) await new Promise((r) => setTimeout(r, 0));
  }
  const sorted = durations.slice().sort((a, b) => a - b);
  const after = heapMB();
  return {
    label,
    keystrokes: durations.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    maxMs: sorted.length ? sorted[sorted.length - 1] : 0,
    heapDeltaMB: before !== null && after !== null ? after - before : null,
  };
}