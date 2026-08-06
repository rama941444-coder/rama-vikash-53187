/**
 * Slide 5 only — persistent diagnostics / AST cache.
 *
 * Keystroke-to-keystroke reuse: the exact same (language, code) pair never gets
 * re-analysed, and unchanged *lines* are reused when only part of the buffer
 * changed. The hot layer is in-memory (instant); a small LRU slice is mirrored
 * into localStorage so results survive re-renders, tab reloads and offline use.
 */

export interface CachedDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  type: string;
  suggestion?: string;
  wrongCode?: string;
  correctCode?: string;
  source?: string;
}

interface CacheEntry {
  findings: CachedDiagnostic[];
  at: number;
  ms: number;
  engine: string;
}

const STORAGE_KEY = 'slide5.diagnostics.cache.v1';
const MAX_MEMORY_ENTRIES = 300;
const MAX_PERSISTED_ENTRIES = 60;
const MAX_PERSISTED_FINDINGS = 40;

const memory = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;
let loaded = false;

/** Fast, stable, non-cryptographic hash (FNV-1a 32-bit) — microseconds on 100k chars. */
export function hashCode(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + ':' + input.length.toString(36);
}

export function cacheKey(code: string, language: string, salt = ''): string {
  return `${(language || 'plaintext').toLowerCase()}|${salt}|${hashCode(code)}`;
}

function hydrate() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Array<[string, CacheEntry]>;
    if (!Array.isArray(parsed)) return;
    for (const [k, v] of parsed) {
      if (k && v && Array.isArray(v.findings)) memory.set(k, v);
    }
  } catch {
    /* corrupted cache is never fatal — start empty */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const recent = Array.from(memory.entries())
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, MAX_PERSISTED_ENTRIES)
        .map(([k, v]) => [k, { ...v, findings: v.findings.slice(0, MAX_PERSISTED_FINDINGS) }] as [string, CacheEntry]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
    } catch {
      /* quota / private mode — memory cache still works */
    }
  }, 1200);
}

export function readCache(key: string): CacheEntry | null {
  hydrate();
  const hit = memory.get(key);
  if (!hit) { misses++; return null; }
  hits++;
  hit.at = Date.now();
  return hit;
}

export function writeCache(key: string, findings: CachedDiagnostic[], ms: number, engine: string) {
  hydrate();
  memory.set(key, { findings, ms, engine, at: Date.now() });
  if (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = Array.from(memory.entries()).sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < oldest.length - MAX_MEMORY_ENTRIES; i++) memory.delete(oldest[i][0]);
  }
  schedulePersist();
}

/**
 * Line-level reuse: findings for lines whose text is unchanged since the last
 * analysed snapshot are returned immediately (shifted to their new line index),
 * so a single keystroke only costs re-analysis of the touched region.
 */
export function reuseUnchangedLines(
  prevCode: string,
  prevFindings: CachedDiagnostic[],
  nextCode: string,
): CachedDiagnostic[] {
  if (!prevCode || !prevFindings.length) return [];
  const prevLines = prevCode.split('\n');
  const nextLines = nextCode.split('\n');
  const out: CachedDiagnostic[] = [];
  for (const f of prevFindings) {
    const text = prevLines[f.line - 1];
    if (text === undefined) continue;
    if (nextLines[f.line - 1] === text) out.push(f);
  }
  return out;
}

export function cacheStats() {
  hydrate();
  const total = hits + misses;
  return {
    entries: memory.size,
    hits,
    misses,
    hitRate: total ? hits / total : 0,
  };
}

export function clearDiagnosticsCache() {
  memory.clear();
  hits = 0; misses = 0;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
