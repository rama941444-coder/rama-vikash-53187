import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Activity, Gauge, Layers, ListChecks, RefreshCw } from 'lucide-react';
import {
  RULE_PACKS, type RulePackConfig, type SeverityLevel,
} from '@/lib/rulePackConfig';
import {
  getStats, subscribeProfiler, clearSamples, runTypingBenchmark,
  LATENCY_TARGET_MS, HEAP_TARGET_MB, type BenchmarkResult,
} from '@/lib/diagnosticsProfiler';
import { verifyGrammarOnboarding } from '@/lib/grammarRegistry';

interface Props {
  config: RulePackConfig;
  onConfigChange: (next: RulePackConfig) => void;
  language: string;
  runDiagnostics: (snapshot: string) => unknown;
  benchmarkSource: string;
}

const SEVERITIES: SeverityLevel[] = ['error', 'warning', 'info', 'off'];

const DiagnosticsLabPanel = ({ config, onConfigChange, language, runDiagnostics, benchmarkSource }: Props) => {
  const [tab, setTab] = useState<'profiling' | 'grammars' | 'packs'>('profiling');
  const [, forceRender] = useState(0);
  const [bench, setBench] = useState<BenchmarkResult | null>(null);
  const [benchRunning, setBenchRunning] = useState(false);

  useEffect(() => subscribeProfiler(() => forceRender((n) => n + 1)), []);

  const stats = getStats();
  const coverage = useMemo(() => verifyGrammarOnboarding(), []);

  const runBench = useCallback(async () => {
    setBenchRunning(true);
    const source = benchmarkSource.trim().length > 40
      ? benchmarkSource
      : '#include <stdio.h>\nint main(){int a=1,b=0;int c=a/b;printf("%d",c);return 0;}\n'.repeat(4);
    const result = await runTypingBenchmark(`${language} typing replay`, source, runDiagnostics);
    setBench(result);
    setBenchRunning(false);
  }, [benchmarkSource, language, runDiagnostics]);

  const setPack = (id: keyof RulePackConfig['enabled'], value: boolean) =>
    onConfigChange({ ...config, enabled: { ...config.enabled, [id]: value } });

  const setSeverity = (level: SeverityLevel) => {
    const key = (language || '').toLowerCase().trim();
    const next = { ...config.severityByLanguage };
    if (level === 'error' && !next[key]) next[key] = 'error';
    next[key] = level;
    onConfigChange({ ...config, severityByLanguage: next });
  };

  const activeSeverity = config.severityByLanguage[(language || '').toLowerCase().trim()] || 'default';
  const ok = (good: boolean) => (good ? 'text-green-400' : 'text-amber-400');

  return (
    <div className="bg-[#0d1117] border-2 border-[#0f3460] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#16213e] to-[#0d1117] border-b border-[#0f3460]">
        <Activity className="w-4 h-4 text-[#e94560]" />
        <span className="text-sm font-semibold text-gray-200">Diagnostics Lab</span>
        <div className="ml-auto flex gap-1">
          {([
            ['profiling', 'Profiling', Gauge],
            ['grammars', 'Grammars', Layers],
            ['packs', 'Rule packs', ListChecks],
          ] as const).map(([id, label, Icon]) => (
            <Button key={id} size="sm" variant="ghost"
              onClick={() => setTab(id)}
              className={`h-7 px-2 text-xs ${tab === id ? 'bg-[#0f3460] text-white' : 'text-gray-400'}`}>
              <Icon className="w-3 h-3 mr-1" />{label}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 text-xs text-gray-300 space-y-3">
        {tab === 'profiling' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><div className="text-gray-500">p50 latency</div><div className={`text-base font-mono ${ok(stats.p50 <= LATENCY_TARGET_MS)}`}>{stats.p50.toFixed(2)} ms</div></div>
              <div><div className="text-gray-500">p95 latency</div><div className={`text-base font-mono ${ok(stats.p95 <= LATENCY_TARGET_MS)}`}>{stats.p95.toFixed(2)} ms</div></div>
              <div><div className="text-gray-500">JS heap</div><div className={`text-base font-mono ${ok((stats.heapMB ?? 0) <= HEAP_TARGET_MB)}`}>{stats.heapMB === null ? 'n/a' : `${stats.heapMB.toFixed(1)} MB`}</div></div>
              <div><div className="text-gray-500">Engine</div><div className="text-base font-mono text-blue-300">{stats.lastEngine || '—'}</div></div>
            </div>
            <div className="text-gray-500">
              {stats.samples} samples • AST avg {stats.avgAst.toFixed(2)} ms • rules avg {stats.avgRules.toFixed(2)} ms •
              targets: ≤{LATENCY_TARGET_MS} ms / ≤{HEAP_TARGET_MB} MB •{' '}
              <span className={ok(stats.withinTarget)}>{stats.withinTarget ? 'within target' : 'over target'}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={runBench} disabled={benchRunning}>
                <RefreshCw className={`w-3 h-3 mr-1 ${benchRunning ? 'animate-spin' : ''}`} />
                {benchRunning ? 'Benchmarking…' : 'Run offline benchmark'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400" onClick={() => clearSamples()}>Clear samples</Button>
            </div>
            {bench && (
              <div className="font-mono text-[11px] text-gray-400 border border-[#0f3460] rounded p-2">
                {bench.label}: {bench.keystrokes} keystrokes • p50 {bench.p50.toFixed(2)} ms • p95 {bench.p95.toFixed(2)} ms •
                max {bench.maxMs.toFixed(2)} ms {bench.heapDeltaMB !== null && `• heap Δ ${bench.heapDeltaMB.toFixed(1)} MB`}
              </div>
            )}
          </>
        )}

        {tab === 'grammars' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><div className="text-gray-500">Languages verified</div><div className="text-base font-mono text-green-400">{coverage.total}</div></div>
              <div><div className="text-gray-500">AST grammars</div><div className="text-base font-mono text-blue-300">{coverage.grammars}</div></div>
              <div><div className="text-gray-500">With AST route</div><div className="text-base font-mono text-blue-300">{coverage.withGrammar}</div></div>
              <div><div className="text-gray-500">Strict validators</div><div className="text-base font-mono text-amber-300">{coverage.withValidator}</div></div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-[#0f3460] rounded">
              <table className="w-full text-[11px] font-mono">
                <tbody>
                  {coverage.rows.slice(0, 400).map((row) => (
                    <tr key={row.language} className="border-b border-[#0f3460]/40">
                      <td className="px-2 py-1 text-gray-300">{row.language}</td>
                      <td className="px-2 py-1 text-gray-500">{row.family}</td>
                      <td className="px-2 py-1 text-gray-500">{row.grammar?.replace('tree-sitter-', '') || '—'}</td>
                      <td className={`px-2 py-1 ${row.tier === 'AST' ? 'text-green-400' : row.tier === 'Rules+Validator' ? 'text-blue-300' : 'text-amber-300'}`}>{row.tier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-gray-500">Every language resolves to a diagnostics tier — no language is left without live checks.</div>
          </>
        )}

        {tab === 'packs' && (
          <>
            {RULE_PACKS.map((pack) => (
              <div key={pack.id} className="flex items-start justify-between gap-3 border-b border-[#0f3460]/40 pb-2">
                <div>
                  <div className="text-gray-200">{pack.name}</div>
                  <div className="text-gray-500">{pack.description}</div>
                </div>
                <Switch checked={config.enabled[pack.id] !== false} onCheckedChange={(v) => setPack(pack.id, v)} />
              </div>
            ))}
            <div className="pt-1">
              <div className="text-gray-400 mb-1">Severity for <span className="text-gray-200">{language || 'current language'}</span> (syntax errors always stay errors)</div>
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant={activeSeverity === 'default' ? 'default' : 'outline'} className="h-7 text-xs"
                  onClick={() => {
                    const next = { ...config.severityByLanguage };
                    delete next[(language || '').toLowerCase().trim()];
                    onConfigChange({ ...config, severityByLanguage: next });
                  }}>default</Button>
                {SEVERITIES.map((level) => (
                  <Button key={level} size="sm" variant={activeSeverity === level ? 'default' : 'outline'}
                    className="h-7 text-xs" onClick={() => setSeverity(level)}>{level}</Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DiagnosticsLabPanel;