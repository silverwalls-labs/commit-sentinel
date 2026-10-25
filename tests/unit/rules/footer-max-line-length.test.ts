import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { footerMaxLineLengthRule } from '../../../src/rules/footer-max-line-length.ts';

function run(message: string, max: number) {
  return footerMaxLineLengthRule.validate({
    commit: parseCommit(message),
    git: null,
    options: { max },
  });
}

describe('footer-max-line-length rule', () => {
  it('skips when no footers', () => {
    assert.equal(run('feat: add', 100).length, 0);
    assert.equal(run('feat: add\n\nJust a body.', 100).length, 0);
  });

  it('accepts footers within limit', () => {
    assert.equal(run('feat: add\n\nBody.\n\nReviewed-by: Alice', 100).length, 0);
  });

  it('counts the token and separator toward the line length', () => {
    // "Reviewed-by" + ": " = 13 characters of prefix.
    const fits = 'a'.repeat(100 - 'Reviewed-by: '.length);
    assert.equal(run(`feat: add\n\nReviewed-by: ${fits}`, 100).length, 0);
    const problems = run(`feat: add\n\nReviewed-by: ${fits}a`, 100);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /exceed the maximum of 100/);
  });

  it('counts the "token #value" separator form identically', () => {
    const fits = 'a'.repeat(100 - 'Fixes #'.length);
    assert.equal(run(`feat: add\n\nFixes #${fits}`, 100).length, 0);
    assert.equal(run(`feat: add\n\nFixes #${fits}a`, 100).length, 1);
  });

  it('rejects long continuation lines', () => {
    const problems = run(`fix: bug\n\nBREAKING CHANGE: first line\n${'a'.repeat(101)}`, 100);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /1 footer line/);
  });

  it('ignores blank lines inside multi-paragraph footer values', () => {
    assert.equal(run('fix: bug\n\nBREAKING CHANGE: first\n\nsecond paragraph', 100).length, 0);
  });

  it('aggregates violations into one problem', () => {
    const long = 'a'.repeat(101);
    const problems = run(`fix: bug\n\nReviewed-by: ${long}\nTested-by: ${long}`, 100);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /2 footer line/);
  });

  it('exempts long lines whose overflow is caused by a URL', () => {
    assert.equal(run(`fix: bug\n\nLink: https://example.com/${'a'.repeat(100)}`, 100).length, 0);
  });

  it('rejects long lines that remain too long without their URLs', () => {
    const problems = run(`fix: bug\n\nLink: ${'a'.repeat(101)} https://example.com/x`, 100);
    assert.equal(problems.length, 1);
  });

  it('handles CRLF input', () => {
    assert.equal(run(`feat: add\r\n\r\nReviewed-by: ${'a'.repeat(101)}`, 100).length, 1);
  });

  describe('validateOptions', () => {
    it('returns empty for valid options', () => {
      assert.equal(footerMaxLineLengthRule.validateOptions!({ max: 100 }).length, 0);
    });

    it('returns empty for default options', () => {
      assert.equal(footerMaxLineLengthRule.validateOptions!({}).length, 0);
    });

    it('reports non-integer max', () => {
      const problems = footerMaxLineLengthRule.validateOptions!({ max: 3.5 });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /positive integer/);
    });

    it('reports negative max', () => {
      assert.equal(footerMaxLineLengthRule.validateOptions!({ max: -1 }).length, 1);
    });

    it('reports zero max', () => {
      const problems = footerMaxLineLengthRule.validateOptions!({ max: 0 });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /positive integer/);
    });

    it('reports string max', () => {
      const problems = footerMaxLineLengthRule.validateOptions!({ max: 'big' as unknown as number });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /positive integer/);
    });
  });
});
