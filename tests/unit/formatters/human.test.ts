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

  it('formats an ignored commit as a single informational line', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit('Revert "feat: add login"'),
        results: [],
        errorCount: 0,
        warningCount: 0,
        skippedGitRules: [],
        ignored: true,
        ignoredBy: 'revert',
      },
      { color: false },
    );
    assert.equal(output, 'ℹ Ignored revert commit message: Revert "feat: add login"\n');
  });

  it('colors the ignored notice when color is enabled', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit('fixup! feat: add login'),
        results: [],
        errorCount: 0,
        warningCount: 0,
        skippedGitRules: [],
        ignored: true,
        ignoredBy: 'fixup',
      },
      { color: true },
    );
    assert.ok(output.includes('\u001b[34mℹ\u001b[39m'));
    assert.match(output, /Ignored fixup commit message/);
  });

  it('sanitizes control characters in an ignored header', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit('Revert "feat: \x1b[2Jadd login"'),
        results: [],
        errorCount: 0,
        warningCount: 0,
        skippedGitRules: [],
        ignored: true,
        ignoredBy: 'revert',
      },
      { color: false },
    );
    assert.ok(!output.includes('\x1b'));
    assert.match(output, /Ignored revert commit message/);
  });

  it('tolerates a hand-built ignored report without ignoredBy', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit('Revert "feat: add login"'),
        results: [],
        errorCount: 0,
        warningCount: 0,
        skippedGitRules: [],
        ignored: true,
      },
      { color: false },
    );
    assert.equal(output, 'ℹ Ignored commit message: Revert "feat: add login"\n');
  });

  it('labels an empty ignored header as <empty>', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit(''),
        results: [],
        errorCount: 0,
        warningCount: 0,
        skippedGitRules: [],
        ignored: true,
        ignoredBy: 'custom',
      },
      { color: false },
    );
    assert.match(output, /Ignored custom commit message: <empty>/);
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

    it('uses TTY detection when no color env vars are set (F29)', () => {
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;
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
        // On non-TTY (test runner), should have no ANSI codes
        assert.ok(!output.includes('\u001b['));
      } finally {
        restoreEnv();
      }
    });
  });
});

describe('humanFormatter range reports', () => {
  it('formats an invalid range report', () => {
    const output = humanFormatter.format(
      {
        valid: false,
        commit: parseCommit(''),
        range: 'main..HEAD',
        results: [
          {
            ruleName: 'max-commits',
            severity: 'error',
            problems: [
              {
                message: 'Range main..HEAD contains 12 commits, exceeds maximum of 10.',
                suggestion: 'Squash or split the branch.',
              },
            ],
          },
        ],
        errorCount: 1,
        warningCount: 0,
        skippedGitRules: [],
      },
      { color: false },
    );
    assert.match(output, /✖ Invalid commit range: main\.\.HEAD/);
    assert.match(output, /exceeds maximum of 10/);
    assert.match(output, /\[max-commits\]/);
    assert.doesNotMatch(output, /<empty>/);
  });

  it('formats a range report with warnings only', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit(''),
        range: 'main..HEAD',
        results: [
          {
            ruleName: 'max-commits',
            severity: 'warn',
            problems: [
              { message: 'Range main..HEAD contains 12 commits, exceeds maximum of 10.' },
            ],
          },
        ],
        errorCount: 0,
        warningCount: 1,
        skippedGitRules: [],
      },
      { color: false },
    );
    assert.match(output, /✔ Valid commit range: main\.\.HEAD/);
    assert.match(output, /1 warning/);
  });

  it('formats a clean range report', () => {
    const output = humanFormatter.format(
      {
        valid: true,
        commit: parseCommit(''),
        range: 'main..HEAD',
        results: [],
        errorCount: 0,
        warningCount: 0,
        skippedGitRules: [],
      },
      { color: false },
    );
    assert.match(output, /✔ Valid commit range: main\.\.HEAD/);
  });
});
