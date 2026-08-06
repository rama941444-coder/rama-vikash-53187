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

  it('detects Java OOP semantic errors before compilation', () => {
    const code = `public private class Broken {
  private abstract void hidden();
}
abstract final class Closed {}
class Child extends Parent, Other {}`;
    const findings = detectRuntimeRisks(code, 'Java');
    const types = findings.map((finding) => finding.type);
    expect(types).toContain('AccessModifierError');
    expect(types).toContain('OverrideError');
    expect(types).toContain('InheritanceError');
  });

  it('does not add semantic red lines to valid Java OOP code', () => {
    const code = `abstract class Parent {
  protected abstract void run();
}
class Child extends Parent {
  @Override public void run() {}
}`;
    const findings = detectRuntimeRisks(code, 'Java');
    expect(findings.filter((finding) => finding.type.endsWith('Error'))).toEqual([]);
  });
});
describe('Java static-context detection', () => {
  it('flags a non-static method called from main', () => {
    const code = `public class A {
  void greet() {}
  public static void main(String[] args) {
    greet();
  }
}`;
    const findings = detectRuntimeRisks(code, 'Java');
    expect(findings.some((f) => f.type === 'StaticContextError')).toBe(true);
  });

  it('does not flag static calls from main', () => {
    const code = `public class A {
  static void greet() {}
  public static void main(String[] args) {
    greet();
  }
}`;
    const findings = detectRuntimeRisks(code, 'Java');
    expect(findings.some((f) => f.type === 'StaticContextError')).toBe(false);
  });
});
