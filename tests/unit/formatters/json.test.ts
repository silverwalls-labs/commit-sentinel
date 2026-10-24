import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { jsonFormatter } from '../../../src/formatters/json.ts';
import { parseCommit } from '../../../src/parser.ts';

describe('jsonFormatter', () => {
  it('produces valid JSON', () => {
    const output = jsonFormatter.format({
      valid: true,
      commit: parseCommit('feat: add login'),
      results: [],
      errorCount: 0,
      warningCount: 0,
      skippedGitRules: [],
    });
    const parsed = JSON.parse(output);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.errorCount, 0);
    assert.ok(parsed.commit);
    assert.ok(Array.isArray(parsed.results));
  });

  it('includes results in JSON output', () => {
    const output = jsonFormatter.format({
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
    const parsed = JSON.parse(output);
    assert.equal(parsed.results.length, 1);
    assert.equal(parsed.results[0].ruleName, 'format');
  });

  it('serializes the ignored fields on ignored reports', () => {
    const output = jsonFormatter.format({
      valid: true,
      commit: parseCommit('Revert "feat: add login"'),
      results: [],
      errorCount: 0,
      warningCount: 0,
      skippedGitRules: [],
      ignored: true,
      ignoredBy: 'revert',
    });
    const parsed = JSON.parse(output);
    assert.equal(parsed.ignored, true);
    assert.equal(parsed.ignoredBy, 'revert');
  });

  it('omits the ignored fields on normal reports', () => {
    const output = jsonFormatter.format({
      valid: true,
      commit: parseCommit('feat: add login'),
      results: [],
      errorCount: 0,
      warningCount: 0,
      skippedGitRules: [],
    });
    const parsed = JSON.parse(output);
    assert.ok(!('ignored' in parsed));
    assert.ok(!('ignoredBy' in parsed));
  });
});
