import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { subjectNoTrailingPeriodRule } from '../../../src/rules/subject-no-trailing-period.ts';

function run(message: string) {
  return subjectNoTrailingPeriodRule.validate({
    commit: parseCommit(message),
    git: null,
    options: {},
  });
}

describe('subject-no-trailing-period rule', () => {
  it('accepts subject without a trailing period', () => {
    assert.equal(run('feat: add login').length, 0);
  });

  it('rejects subject ending with a period', () => {
    const problems = run('feat: add login.');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /period/);
  });

  it('accepts a period in the middle of the subject', () => {
    assert.equal(run('feat: bump v1.2 of api').length, 0);
  });

  it('rejects subject ending with an ellipsis', () => {
    const problems = run('feat: add login...');
    assert.equal(problems.length, 1);
  });

  it('rejects subject ending with a Unicode ellipsis', () => {
    assert.equal(run('feat: add login…').length, 1);
  });

  it('rejects subject ending with a fullwidth period', () => {
    assert.equal(run('feat: add login．').length, 1);
  });

  it('rejects subject ending with an ideographic full stop', () => {
    assert.equal(run('feat: add login。').length, 1);
  });

  it('accepts Unicode stop characters in the middle of the subject', () => {
    assert.equal(run('feat: bump v2．0 of api').length, 0);
  });

  it('skips when subject is null', () => {
    assert.equal(run('bad message').length, 0);
  });
});
