import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { subjectMinLengthRule } from '../../../src/rules/subject-min-length.ts';

function run(message: string, min: number) {
  return subjectMinLengthRule.validate({
    commit: parseCommit(message),
    git: null,
    options: { min },
  });
}

describe('subject-min-length rule', () => {
  it('accepts subject meeting minimum', () => {
    assert.equal(run('feat: add login', 3).length, 0);
  });

  it('rejects subject below minimum', () => {
    const problems = run('feat: ab', 5);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /must be at least 5/);
  });

  it('skips when subject is null', () => {
    assert.equal(run('bad message', 1).length, 0);
  });

  it('applies the default min of 1 when no options are given', () => {
    const problems = subjectMinLengthRule.validate({
      commit: parseCommit('feat: a'),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 0);
  });

  describe('validateOptions', () => {
    it('returns empty for valid options', () => {
      assert.equal(subjectMinLengthRule.validateOptions!({ min: 3 }).length, 0);
    });

    it('returns empty for default options', () => {
      assert.equal(subjectMinLengthRule.validateOptions!({}).length, 0);
    });

    it('accepts zero as min', () => {
      assert.equal(subjectMinLengthRule.validateOptions!({ min: 0 }).length, 0);
    });

    it('reports negative min', () => {
      const problems = subjectMinLengthRule.validateOptions!({ min: -1 });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /non-negative integer/);
    });

    it('reports non-integer min', () => {
      const problems = subjectMinLengthRule.validateOptions!({ min: 2.5 });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /non-negative integer/);
    });

    it('reports string min', () => {
      const problems = subjectMinLengthRule.validateOptions!({ min: 'two' as unknown as number });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /non-negative integer/);
    });
  });
});
