import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { sarifFormatter } from '../../../src/formatters/sarif.ts';
import { parseCommit } from '../../../src/parser.ts';

describe('sarifFormatter', () => {
  it('produces valid SARIF 2.1.0', () => {
    const output = sarifFormatter.format({
      valid: false,
      commit: parseCommit('bad'),
      results: [
        {
          ruleName: 'format',
          severity: 'error',
          problems: [{ message: 'Bad format.' }],
        },
      ],
      errorCount: 1,
      warningCount: 0,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    assert.equal(sarif.version, '2.1.0');
    assert.ok(sarif.$schema);
    assert.equal(sarif.runs.length, 1);
    assert.equal(sarif.runs[0].tool.driver.name, 'commit-sentinel');
    assert.equal(sarif.runs[0].results.length, 1);
    assert.equal(sarif.runs[0].results[0].level, 'error');
    assert.equal(sarif.runs[0].results[0].ruleId, 'format');
  });

  it('maps warnings correctly', () => {
    const output = sarifFormatter.format({
      valid: true,
      commit: parseCommit('feat: Add Login'),
      results: [
        {
          ruleName: 'subject-case',
          severity: 'warn',
          problems: [{ message: 'Must start lowercase.' }],
        },
      ],
      errorCount: 0,
      warningCount: 1,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    assert.equal(sarif.runs[0].results[0].level, 'warning');
  });

  it('produces empty results for valid commit', () => {
    const output = sarifFormatter.format({
      valid: true,
      commit: parseCommit('feat: add login'),
      results: [],
      errorCount: 0,
      warningCount: 0,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    assert.equal(sarif.runs[0].results.length, 0);
  });

  it('deduplicates rule descriptors across repeated rule names', () => {
    const output = sarifFormatter.format({
      valid: false,
      commit: parseCommit('bad'),
      results: [
        {
          ruleName: 'format',
          severity: 'error',
          problems: [{ message: 'Bad format.' }, { message: 'Still bad.' }],
        },
        {
          ruleName: 'format',
          severity: 'error',
          problems: [{ message: 'Bad again.' }],
        },
      ],
      errorCount: 3,
      warningCount: 0,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    assert.equal(sarif.runs[0].tool.driver.rules.length, 1);
    assert.equal(sarif.runs[0].tool.driver.rules[0].id, 'format');
    assert.equal(sarif.runs[0].results.length, 3);
    for (const result of sarif.runs[0].results) {
      assert.equal(result.ruleIndex, 0);
    }
  });

  it('includes commit identity when the report carries a sha', () => {
    const output = sarifFormatter.format({
      valid: false,
      commit: parseCommit('bad'),
      sha: '0123456789abcdef0123456789abcdef01234567',
      results: [
        {
          ruleName: 'format',
          severity: 'error',
          problems: [{ message: 'Bad format.' }],
        },
      ],
      errorCount: 1,
      warningCount: 0,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    const result = sarif.runs[0].results[0];
    assert.equal(result.properties.commitSha, '0123456789abcdef0123456789abcdef01234567');
    assert.match(result.message.text, /^\[01234567\] Bad format\.$/);
  });

  it('falls back to the rule name when the rule is not a builtin', () => {
    const output = sarifFormatter.format({
      valid: false,
      commit: parseCommit('bad'),
      results: [
        {
          ruleName: 'no-wip',
          severity: 'error',
          problems: [{ message: 'WIP commits are not allowed.' }],
        },
      ],
      errorCount: 1,
      warningCount: 0,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    assert.equal(sarif.runs[0].tool.driver.rules[0].id, 'no-wip');
    assert.equal(sarif.runs[0].tool.driver.rules[0].shortDescription.text, 'no-wip');
  });

  it('marks an ignored commit via a run-level properties bag', () => {
    const output = sarifFormatter.format({
      valid: true,
      commit: parseCommit('Revert "feat: add login"'),
      results: [],
      errorCount: 0,
      warningCount: 0,
      skippedGitRules: [],
      ignored: true,
      ignoredBy: 'revert',
    });
    const sarif = JSON.parse(output);
    assert.equal(sarif.runs[0].results.length, 0);
    assert.deepEqual(sarif.runs[0].properties, { ignored: true, ignoredBy: 'revert' });
  });

  it('includes the commit sha in the ignored properties bag when set', () => {
    const output = sarifFormatter.format({
      valid: true,
      commit: parseCommit('fixup! feat: add login'),
      sha: '0123456789abcdef0123456789abcdef01234567',
      results: [],
      errorCount: 0,
      warningCount: 0,
      skippedGitRules: [],
      ignored: true,
      ignoredBy: 'fixup',
    });
    const sarif = JSON.parse(output);
    assert.deepEqual(sarif.runs[0].properties, {
      ignored: true,
      ignoredBy: 'fixup',
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    });
  });

  it('attaches no run-level properties bag to non-ignored reports', () => {
    const output = sarifFormatter.format({
      valid: true,
      commit: parseCommit('feat: add login'),
      results: [],
      errorCount: 0,
      warningCount: 0,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    assert.ok(!('properties' in sarif.runs[0]));
  });
});

describe('sarifFormatter range reports', () => {
  it('includes the range in properties when the report carries one', () => {
    const output = sarifFormatter.format({
      valid: false,
      commit: parseCommit(''),
      range: 'main..HEAD',
      results: [
        {
          ruleName: 'max-commits',
          severity: 'error',
          problems: [
            { message: 'Range main..HEAD contains 12 commits, exceeds maximum of 10.' },
          ],
        },
      ],
      errorCount: 1,
      warningCount: 0,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    const result = sarif.runs[0].results[0];
    assert.equal(result.properties.range, 'main..HEAD');
    assert.equal(result.properties.commitSha, undefined);
    assert.equal(result.ruleId, 'max-commits');
    assert.match(result.message.text, /^\[range main\.\.HEAD\] Range main\.\.HEAD contains/);
    assert.equal(
      sarif.runs[0].tool.driver.rules[0].shortDescription.text,
      'Range must not contain more than the maximum number of commits',
    );
  });

  it('keeps commitSha alongside range when both are set', () => {
    const output = sarifFormatter.format({
      valid: false,
      commit: parseCommit(''),
      sha: '0123456789abcdef0123456789abcdef01234567',
      range: 'main..HEAD',
      results: [
        {
          ruleName: 'max-commits',
          severity: 'error',
          problems: [{ message: 'Too many commits.' }],
        },
      ],
      errorCount: 1,
      warningCount: 0,
      skippedGitRules: [],
    });
    const sarif = JSON.parse(output);
    const result = sarif.runs[0].results[0];
    assert.equal(result.properties.commitSha, '0123456789abcdef0123456789abcdef01234567');
    assert.equal(result.properties.range, 'main..HEAD');
    // The sha prefix wins; the range is not prefixed into the message twice.
    assert.equal(result.message.text, '[01234567] Too many commits.');
  });
});
