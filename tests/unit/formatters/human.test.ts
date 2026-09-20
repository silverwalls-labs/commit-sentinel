import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { humanFormatter } from '../../../src/formatters/human.ts';
import { parseCommit } from '../../../src/parser.ts';

describe('humanFormatter', () => {
  it('formats valid commit', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit('feat: add login'),
        results: [],
        errorCount: 0,
        warningCount: 0,
        skippedGitRules: [],
      },
      { color: false },
    );
    assert.match(output, /✔/);
    assert.match(output, /Valid commit message/);
  });

  it('formats invalid commit with errors', () => {
    const output = humanFormatter.format(
      {
        valid: false,
        commit: parseCommit('bad message'),
        results: [
          {
            ruleName: 'format',
            severity: 'error',
            problems: [
              { message: 'Bad format.', suggestion: 'Fix it.' },
            ],
          },
        ],
        errorCount: 1,
        warningCount: 0,
        skippedGitRules: [],
      },
      { color: false },
    );
    assert.match(output, /✖/);
    assert.match(output, /Invalid commit message/);
    assert.match(output, /Bad format/);
    assert.match(output, /\[format\]/);
    assert.match(output, /1 error/);
  });

  it('formats warnings with valid header', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit('feat: Add Login'),
        results: [
          {
            ruleName: 'subject-case',
            severity: 'warn',
            problems: [
              { message: 'Must start with lowercase.' },
            ],
          },
        ],
        errorCount: 0,
        warningCount: 1,
        skippedGitRules: [],
      },
      { color: false },
    );
    assert.match(output, /✔/);
    assert.match(output, /Valid commit message/);
    assert.match(output, /⚠/); // warning icon on the individual problem
    assert.match(output, /1 warning/);
  });

  it('shows skipped git rules on valid path', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit('feat: add login'),
        results: [],
        errorCount: 0,
        warningCount: 0,
        skippedGitRules: ['signed', 'author-email'],
      },
      { color: false },
    );
    assert.match(output, /Skipped git-metadata rules/);
    assert.match(output, /signed, author-email/);
  });

  it('shows skipped git rules on error path', () => {
    const output = humanFormatter.format(
      {
        valid: false,
        commit: parseCommit('bad message'),
        results: [
          {
            ruleName: 'format',
            severity: 'error',
            problems: [{ message: 'Bad format.' }],
          },
        ],
        errorCount: 1,
        warningCount: 0,
        skippedGitRules: ['signed'],
      },
      { color: false },
    );
    assert.match(output, /Skipped git-metadata rules/);
    assert.match(output, /signed/);
    assert.match(output, /1 error/);
  });

  it('formats with color enabled', () => {
    const output = humanFormatter.format(
      {
        valid: false,
        commit: parseCommit('bad message'),
        results: [
          {
            ruleName: 'format',
            severity: 'error',
            problems: [{ message: 'Bad format.', suggestion: 'Fix it.' }],
          },
        ],
        errorCount: 1,
        warningCount: 0,
        skippedGitRules: [],
      },
      { color: true },
    );
    // When color is enabled, ANSI escape codes should be present
    assert.match(output, /Bad format/);
    assert.match(output, /1 error/);
  });

  it('formats empty header as <empty>', () => {
    const output = humanFormatter.format(
      {
        valid: false,
        commit: parseCommit(''),
        results: [
          {
            ruleName: 'format',
            severity: 'error',
            problems: [{ message: 'Bad.' }],
          },
        ],
        errorCount: 1,
        warningCount: 0,
        skippedGitRules: [],
      },
      { color: false },
    );
    assert.match(output, /<empty>/);
  });

  describe('color detection via environment', () => {
    const savedNoColor = process.env.NO_COLOR;
    const savedForceColor = process.env.FORCE_COLOR;

    function restoreEnv(): void {
      if (savedNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = savedNoColor;
      }
      if (savedForceColor === undefined) {
        delete process.env.FORCE_COLOR;
      } else {
        process.env.FORCE_COLOR = savedForceColor;
      }
    }

    it('disables colors when NO_COLOR is set', () => {
      delete process.env.FORCE_COLOR;
      process.env.NO_COLOR = '1';
      try {
        const output = humanFormatter.format(
          {
            valid: false,
            commit: parseCommit('bad message'),
            results: [
              {
                ruleName: 'format',
                severity: 'error',
                problems: [{ message: 'Bad.' }],
              },
            ],
            errorCount: 1,
            warningCount: 0,
            skippedGitRules: [],
          },
        );
        assert.ok(!output.includes('\u001b['));
      } finally {
        restoreEnv();
      }
    });

    it('enables colors when FORCE_COLOR is set', () => {
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = '1';
      try {
        const output = humanFormatter.format(
          {
            valid: false,
            commit: parseCommit('bad message'),
            results: [
              {
                ruleName: 'format',
                severity: 'error',
                problems: [{ message: 'Bad.' }],
              },
            ],
            errorCount: 1,
            warningCount: 0,
            skippedGitRules: [],
          },
        );
        assert.ok(output.includes('\u001b['));
      } finally {
        restoreEnv();
      }
    });
  });
});
