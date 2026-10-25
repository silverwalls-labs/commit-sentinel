import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { referencesRequiredRule } from '../../../src/rules/references-required.ts';

function run(message: string, pattern?: string) {
  return referencesRequiredRule.validate({
    commit: parseCommit(message),
    git: null,
    options: pattern === undefined ? {} : { pattern },
  });
}

describe('references-required rule', () => {
  it('accepts a reference in the header', () => {
    assert.equal(run('feat: add login (#42)').length, 0);
    assert.equal(run('feat: add login #42').length, 0);
  });

  it('rejects a word-adjacent hash', () => {
    const problems = run('feat: add abc#42');
    assert.equal(problems.length, 1);
  });

  it('rejects a reference followed by letters', () => {
    assert.equal(run('feat: fix #42abc').length, 1);
  });

  it('accepts a reference in a colon-form footer', () => {
    assert.equal(run('feat: x\n\nRefs: #42').length, 0);
  });

  it('accepts a reference in a hash-form footer', () => {
    assert.equal(run('feat: x\n\nFixes #42').length, 0);
  });

  it('rejects a colon-form numeric value without a hash', () => {
    assert.equal(run('feat: x\n\nRefs: 42').length, 1);
  });

  it('rejects digit-leading footer values that are not references', () => {
    assert.equal(run('feat: x\n\nReviewed-by: 2 approvals').length, 1);
  });

  it('ignores references in the body', () => {
    const problems = run('feat: x\n\nThis relates to #42 in some way.');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /header or a footer/);
  });

  it('rejects a message without any reference', () => {
    const problems = run('feat: x\n\nBody text.\n\nReviewed-by: Alice');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /header or a footer/);
  });

  it('supports a custom pattern', () => {
    const pattern = String.raw`[A-Z]+-\d+`;
    assert.equal(run('feat: x\n\nRefs: JIRA-123', pattern).length, 0);
    assert.equal(run('feat: x\n\nRefs: #42', pattern).length, 1);
  });

  it('reports an invalid pattern instead of throwing', () => {
    const problems = run('feat: x', '(');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /Invalid references-required pattern/);
  });

  describe('validateOptions', () => {
    it('returns empty for default options', () => {
      assert.equal(referencesRequiredRule.validateOptions!({}).length, 0);
    });

    it('returns empty for a valid pattern', () => {
      assert.equal(referencesRequiredRule.validateOptions!({ pattern: '#\\d+' }).length, 0);
    });

    it('reports an invalid pattern', () => {
      const problems = referencesRequiredRule.validateOptions!({ pattern: '(' });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /Invalid references-required pattern/);
    });

    it('reports a non-string pattern', () => {
      const problems = referencesRequiredRule.validateOptions!({
        pattern: 123 as unknown as string,
      });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /must be a string/);
    });
  });
});
