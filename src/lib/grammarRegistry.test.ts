import { describe, expect, it } from 'vitest';
import { verifyGrammarOnboarding, onboardGrammars } from './grammarRegistry';
import { runSemanticRules } from './semanticRuleEngine';

describe('grammar onboarding workflow (Slide 5)', () => {
  it('registers extra aliases exactly once', () => {
    expect(onboardGrammars()).toBeGreaterThanOrEqual(0);
    expect(onboardGrammars()).toBe(0);
  });

  it('routes every registry language to a diagnostics tier', () => {
    const report = verifyGrammarOnboarding();
    expect(report.total).toBeGreaterThan(300);
    expect(report.withGrammar).toBeGreaterThan(80);
    expect(report.rows.every((r) => !!r.tier)).toBe(true);
  });

  it('maps onboarded languages onto working rule packs', () => {
    expect(runSemanticRules('int big = 3000000000;', 'Arduino').map((f) => f.type)).toContain('OverflowError');
    expect(runSemanticRules('password = "supersecret123"', 'Mojo').map((f) => f.type)).toContain('SecurityWarning');
  });
});