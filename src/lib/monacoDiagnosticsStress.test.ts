import { describe, expect, it } from 'vitest';
import { validateLive } from './liveSyntaxValidator';
import { detectRuntimeRisks } from './runtimeRiskHeuristics';

describe('Monaco live diagnostics stress path', () => {
  it('keeps rapid C typing diagnostics deterministic without stale marker-style findings', () => {
    const target = '#iiiiinclude <studio.h>\nInt Main() {\n  pritnf("hi")\n  return 0\n}\n';
    let snapshot = '';
    let latest: ReturnType<typeof validateLive> = [];

    for (const ch of target) {
      snapshot += ch;
      latest = [
        ...validateLive(snapshot, 'C'),
        ...detectRuntimeRisks(snapshot, 'C'),
      ];
      expect(Array.isArray(latest)).toBe(true);
    }

    const messages = latest.map((f) => `${f.type}: ${f.message} ${f.suggestion || ''}`).join('\n');
    expect(messages).toMatch(/iiiiinclude|#include|include/i);
    expect(messages).toMatch(/studio\.h|stdio\.h/i);
    expect(messages).toMatch(/Int|int|case-sensitive/i);
    expect(messages).toMatch(/Main|main|case-sensitive/i);
    expect(messages).toMatch(/pritnf|printf/i);
    expect(messages).toMatch(/semicolon|;/i);
  });

  it('does not flag corrected C code with red-line syntax errors', () => {
    const code = '#include <stdio.h>\nint main() {\n  printf("hi");\n  return 0;\n}\n';
    const findings = [
      ...validateLive(code, 'C'),
      ...detectRuntimeRisks(code, 'C'),
    ];

    expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
  });
});