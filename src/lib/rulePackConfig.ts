/**
 * Slide 5 only — configurable semantic rule packs + per-language severity.
 * Persisted in localStorage; defaults keep Slide 5's existing behaviour.
 */

export type PackId = 'syntax' | 'runtime' | 'semantic' | 'security' | 'ast' | 'lsp';
export type SeverityLevel = 'error' | 'warning' | 'info' | 'off';

export interface RulePack {
  id: PackId;
  name: string;
  description: string;
}

export const RULE_PACKS: RulePack[] = [
  { id: 'lsp', name: 'Language server (LSP)', description: 'Monaco language servers — primary source when available (TS/JS, JSON, CSS, HTML).' },
  { id: 'ast', name: 'Tree-sitter AST', description: 'Incremental WASM parsing for real syntax errors across all onboarded grammars.' },
  { id: 'syntax', name: 'Strict syntax & casing', description: 'Per-language keyword casing, headers, semicolons, typos.' },
  { id: 'runtime', name: 'Runtime risk heuristics', description: 'Division by zero, overflow/underflow, leaks, infinite loops, unreachable code.' },
  { id: 'semantic', name: 'Semgrep-style semantics', description: 'Logic errors, encapsulation/access modifiers, data-structure bounds.' },
  { id: 'security', name: 'Security rules', description: 'Injection, hardcoded secrets, unsafe APIs.' },
];

export interface RulePackConfig {
  enabled: Record<PackId, boolean>;
  /** language (lowercased) -> severity override applied to non-syntax findings. */
  severityByLanguage: Record<string, SeverityLevel>;
}

export const DEFAULT_CONFIG: RulePackConfig = {
  enabled: { lsp: true, ast: true, syntax: true, runtime: true, semantic: true, security: true },
  severityByLanguage: {},
};

const KEY = 'slide5-rule-pack-config-v1';

export function loadRulePackConfig(): RulePackConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      enabled: { ...DEFAULT_CONFIG.enabled, ...(parsed?.enabled || {}) },
      severityByLanguage: parsed?.severityByLanguage || {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveRulePackConfig(config: RulePackConfig) {
  try { localStorage.setItem(KEY, JSON.stringify(config)); } catch {}
}

const SECURITY_TYPES = /security/i;

/** Which pack a finding belongs to, used for filtering. */
export function packOfFinding(type: string, origin: PackId): PackId {
  if (SECURITY_TYPES.test(type)) return 'security';
  return origin;
}

export function isPackEnabled(config: RulePackConfig, pack: PackId) {
  return config.enabled[pack] !== false;
}

/** Applies a per-language severity override. Returns null when suppressed. */
export function applySeverity<T extends { severity: 'error' | 'warning'; type: string }>(
  finding: T,
  config: RulePackConfig,
  language?: string | null,
): (T & { severity: 'error' | 'warning' }) | null {
  const level = config.severityByLanguage[(language || '').toLowerCase().trim()];
  if (!level) return finding;
  if (level === 'off') return null;
  if (level === 'error') return { ...finding, severity: 'error' };
  return { ...finding, severity: 'warning' };
}