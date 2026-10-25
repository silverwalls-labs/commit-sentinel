import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { footerLeadingBlankRule } from '../../../src/rules/footer-leading-blank.ts';

function run(message: string, extraTokens?: string[]) {
  return footerLeadingBlankRule.validate({
    commit: parseCommit(message),
    git: null,
    options: extraTokens === undefined ? {} : { extraTokens },
  });
}

describe('footer-leading-blank rule', () => {
  it('accepts footers separated from the body by a blank line', () => {
    assert.equal(run('feat: x\n\nBody text.\n\nSigned-off-by: Ada <ada@example.com>').length, 0);
  });

  it('accepts a footer-only message with a blank line after the header', () => {
    assert.equal(run('feat: x\n\nSigned-off-by: Ada <ada@example.com>').length, 0);
  });

  it('accepts a message with no footers', () => {
    assert.equal(run('feat: x').length, 0);
    assert.equal(run('feat: x\n\nJust a body.').length, 0);
  });

  it('rejects footers glued directly to the header', () => {
    const problems = run('feat: x\nSigned-off-by: Ada <ada@example.com>');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /blank line/);
  });

  it('rejects footers glued directly to the header with CRLF', () => {
    assert.equal(run('feat: x\r\nSigned-off-by: Ada <ada@example.com>').length, 1);
  });

  it('rejects a known trailer glued to the end of the body', () => {
    const problems = run('feat: x\n\nSome prose.\nSigned-off-by: Ada <ada@example.com>');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /1 trailer-like line/);
  });

  it('counts multiple glued trailer lines', () => {
    const problems = run('feat: x\n\nSome prose.\nRefs: #1\nSigned-off-by: Ada <ada@example.com>');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /2 trailer-like line/);
  });

  it('matches known tokens case-insensitively', () => {
    assert.equal(run('feat: x\n\nSome prose.\nsigned-off-by: Ada <ada@example.com>').length, 1);
  });

  it('recognizes a glued BREAKING CHANGE trailer', () => {
    assert.equal(run('feat: x\n\nSome prose.\nBREAKING CHANGE: removed /v1').length, 1);
  });

  it('recognizes the "token #value" form regardless of the token', () => {
    assert.equal(run('feat: x\n\nSome prose.\nGH #42').length, 1);
  });

  it('ignores prose lines that merely start with "Word #123"', () => {
    assert.equal(run('feat: x\n\nWe investigated.\nBug #123 was the root cause').length, 0);
  });

  it('ignores unknown colon-form tokens', () => {
    assert.equal(run('feat: x\n\nSome prose.\nNote: be careful').length, 0);
  });

  it('flags extra tokens from options, case-insensitively', () => {
    assert.equal(run('feat: x\n\nSome prose.\nTicket: ABC-1', ['ticket']).length, 1);
    assert.equal(run('feat: x\n\nSome prose.\nticket: ABC-1', ['Ticket']).length, 1);
  });

  it('ignores trailer-like lines followed by prose', () => {
    assert.equal(run('feat: x\n\nFirst prose.\nRefs: #1\nMore prose.').length, 0);
  });

  it('terminates on a hand-built commit whose body is all trailers', () => {
    // parseCommit never produces this shape (an all-trailer paragraph becomes
    // footers), but hand-built ParsedCommit values must not escape the scan.
    const problems = footerLeadingBlankRule.validate({
      commit: {
        raw: 'feat: x\n\nFixes: 1\nFixes: 2',
        header: 'feat: x',
        type: 'feat',
        scope: null,
        breaking: false,
        hasBreakingChange: false,
        subject: 'x',
        body: 'Fixes: 1\nFixes: 2',
        footers: [],
      },
      git: null,
      options: {},
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /2 trailer-like line/);
  });

  describe('validateOptions', () => {
    it('returns empty for default options', () => {
      assert.equal(footerLeadingBlankRule.validateOptions!({}).length, 0);
    });

    it('returns empty for a valid token list', () => {
      assert.equal(footerLeadingBlankRule.validateOptions!({ extraTokens: ['Ticket'] }).length, 0);
    });

    it('reports a non-array extraTokens', () => {
      const problems = footerLeadingBlankRule.validateOptions!({
        extraTokens: 'Ticket' as unknown as string[],
      });
      assert.equal(problems.length, 1);
      assert.match(problems[0]!.message, /array of trailer token strings/);
    });

    it('reports non-string array entries', () => {
      const problems = footerLeadingBlankRule.validateOptions!({
        extraTokens: [1] as unknown as string[],
      });
      assert.equal(problems.length, 1);
    });
  });
});
