import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { breakingChangeRule } from '../../../src/rules/breaking-change.ts';

function run(message: string, requireFooter = false) {
  return breakingChangeRule.validate({
    commit: parseCommit(message),
    git: null,
    options: { requireFooter },
  });
}

describe('breaking-change rule', () => {
  it('passes for non-breaking commit', () => {
    assert.equal(run('feat: add login').length, 0);
  });

  it('passes for breaking marker without requireFooter', () => {
    assert.equal(run('feat!: drop API').length, 0);
  });

  it('fails when requireFooter and marker has no footer', () => {
    const problems = run('feat!: drop API', true);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /requires a BREAKING CHANGE footer/);
  });

  it('passes when requireFooter and footer exists', () => {
    const msg = 'feat!: drop API\n\nBREAKING CHANGE: removed /v1';
    assert.equal(run(msg, true).length, 0);
  });

  it('fails when BREAKING CHANGE footer has empty value', () => {
    const msg = 'feat: change\n\nBREAKING CHANGE: ';
    const problems = run(msg);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /non-empty description/);
  });

  it('passes when BREAKING CHANGE footer has value', () => {
    const msg = 'feat: change\n\nBREAKING CHANGE: new behavior';
    assert.equal(run(msg).length, 0);
  });

  it('accepts the hyphenated BREAKING-CHANGE footer', () => {
    const msg = 'feat: change\n\nBREAKING-CHANGE: new behavior';
    assert.equal(run(msg).length, 0);
  });

  it('accepts the hyphenated BREAKING-CHANGE footer as satisfying requireFooter', () => {
    const msg = 'feat!: drop API\n\nBREAKING-CHANGE: removed /v1';
    assert.equal(run(msg, true).length, 0);
  });

  it('fails when the hyphenated BREAKING-CHANGE footer has empty value', () => {
    const msg = 'feat: change\n\nBREAKING-CHANGE: ';
    const problems = run(msg);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /non-empty description/);
  });

  describe('validateOptions', () => {
    it('returns empty for valid options', () => {
      assert.equal(breakingChangeRule.validateOptions!({ requireFooter: true }).length, 0);
      assert.equal(breakingChangeRule.validateOptions!({ requireFooter: false }).length, 0);
    });

    it('returns empty for default options', () => {
      assert.equal(breakingChangeRule.validateOptions!({}).length, 0);
    });

    it('reports non-boolean requireFooter', () => {
      const problems = breakingChangeRule.validateOptions!({ requireFooter: 'yes' as unknown as boolean });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /must be a boolean/);
    });
  });
});
