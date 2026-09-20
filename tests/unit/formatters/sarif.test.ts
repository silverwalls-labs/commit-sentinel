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
});
