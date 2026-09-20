import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { bodyMaxLineLengthRule } from '../../../src/rules/body-max-line-length.ts';

function run(message: string, max: number) {
  return bodyMaxLineLengthRule.validate({
    commit: parseCommit(message),
    git: null,
    options: { max },
  });
}

describe('body-max-line-length rule', () => {
  it('accepts body within limit', () => {
    assert.equal(run('feat: add\n\nShort body.', 100).length, 0);
  });

  it('rejects body with long lines', () => {
    const longLine = 'a'.repeat(101);
    const problems = run(`feat: add\n\n${longLine}`, 100);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /exceed the maximum of 100/);
  });

  it('skips when no body', () => {
    assert.equal(run('feat: add', 100).length, 0);
  });

  it('counts violations across multiple lines', () => {
    const longLine = 'a'.repeat(101);
    const problems = run(`feat: add\n\n${longLine}\nok\n${longLine}`, 100);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /2 body line/);
  });

  it('reports short violating lines without truncation marker', () => {
    // A line of 17 chars against max 10 violates but stays under the
    // 30-char excerpt threshold — exercises the non-truncated excerpt path.
    const problems = run('feat: add\n\nthis line is long', 10);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /exceed the maximum of 10/);
  });

  describe('validateOptions', () => {
    it('returns empty for valid options', () => {
      assert.equal(bodyMaxLineLengthRule.validateOptions!({ max: 100 }).length, 0);
    });

    it('returns empty for default options', () => {
      assert.equal(bodyMaxLineLengthRule.validateOptions!({}).length, 0);
    });

    it('reports non-integer max', () => {
      const problems = bodyMaxLineLengthRule.validateOptions!({ max: 3.5 });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /positive integer/);
    });

    it('reports negative max', () => {
      const problems = bodyMaxLineLengthRule.validateOptions!({ max: -1 });
      assert.equal(problems.length, 1);
    });

    it('reports zero max', () => {
      const problems = bodyMaxLineLengthRule.validateOptions!({ max: 0 });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /positive integer/);
    });

    it('reports string max', () => {
      const problems = bodyMaxLineLengthRule.validateOptions!({ max: 'big' as unknown as number });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /positive integer/);
    });
  });
});
