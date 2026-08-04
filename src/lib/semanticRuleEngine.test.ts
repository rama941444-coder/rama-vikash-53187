import { describe, expect, it } from 'vitest';
import { runSemanticRules, familyOf } from './semanticRuleEngine';

const types = (code: string, lang: string) => runSemanticRules(code, lang).map((f) => f.type);

describe('semantic rule engine (Slide 5)', () => {
  it('maps 300+ language names onto families', () => {
    expect(familyOf('Kotlin')).toBe('jvm');
    expect(familyOf('Mojo')).toBe('python');
    expect(familyOf('Solidity')).toBe('js');
    expect(familyOf('brand-new-lang')).toBe('generic');
  });

  it('detects Java encapsulation + logic errors', () => {
    const code = `public class A {
  public int count = 0;
  void run(String s) { if (s == "x") { } }
}`;
    const t = types(code, 'Java');
    expect(t).toContain('EncapsulationWarning');
    expect(t).toContain('LogicError');
  });

  it('detects overflow / underflow', () => {
    expect(types('int big = 3000000000;', 'C')).toContain('OverflowError');
    expect(types('unsigned int i = 0;\n i--;', 'C')).toContain('UnderflowWarning');
  });

  it('detects data-structure bounds problems', () => {
    expect(types('for (int i = 0; i <= arr.length; i++) {}', 'Java')).toContain('IndexOutOfBounds');
    expect(types('for i in range(len(a) + 1):\n  pass', 'Python')).toContain('IndexOutOfBounds');
  });

  it('detects security issues across languages', () => {
    expect(types('db.query("SELECT * FROM u WHERE id=" + id)', 'JavaScript')).toContain('SecurityError');
    expect(types('password = "supersecret123"', 'Python')).toContain('SecurityWarning');
  });

  it('stays silent on clean code', () => {
    const clean = `public class Ok {
  private int count = 0;
  public int getCount() { return count; }
}`;
    expect(runSemanticRules(clean, 'Java')).toEqual([]);
  });

  it('ignores matches inside strings and comments', () => {
    const code = '// if (a = 1) {}\nconst msg = "password = \\"abc12345\\"";';
    expect(runSemanticRules(code, 'JavaScript')).toEqual([]);
  });
});
