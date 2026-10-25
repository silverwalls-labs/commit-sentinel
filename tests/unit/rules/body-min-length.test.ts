import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { bodyMinLengthRule } from '../../../src/rules/body-min-length.ts';

function run(message: string, min: number) {
  return bodyMinLengthRule.validate({
    commit: parseCommit(message),
    git: null,
    options: { min },
  });
}

describe('body-min-length rule', () => {
  it('accepts body meeting the minimum', () => {
    assert.equal(run('feat: add login\n\nAdd the login flow with session handling.', 20).length, 0);
  });

  it('rejects body below the minimum', () => {
    const problems = run('feat: add login\n\nTiny body.', 20);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /at least 20/);
  });

  it('accepts body at the exact minimum', () => {
    const body = 'a'.repeat(20);
    assert.equal(run(`feat: add login\n\n${body}`, 20).length, 0);
  });

  it('skips when body is null', () => {
    assert.equal(run('feat: add login', 20).length, 0);
  });

  describe('validateOptions', () => {
    it('returns empty for valid options', () => {
      assert.equal(bodyMinLengthRule.validateOptions!({ min: 20 }).length, 0);
    });

    it('returns empty for default options', () => {
      assert.equal(bodyMinLengthRule.validateOptions!({}).length, 0);
    });

    it('reports non-integer min', () => {
      const problems = bodyMinLengthRule.validateOptions!({ min: 3.5 });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /non-negative integer/);
    });

    it('reports negative min', () => {
      const problems = bodyMinLengthRule.validateOptions!({ min: -1 });
      assert.equal(problems.length, 1);
    });

    it('reports string min', () => {
      const problems = bodyMinLengthRule.validateOptions!({ min: 'ten' as unknown as number });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /non-negative integer/);
    });
  });
});
