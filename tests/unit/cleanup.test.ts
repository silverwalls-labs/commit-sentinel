import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { cleanCommitMessage } from '../../src/cleanup.ts';

const SCISSORS = '# ------------------------ >8 ------------------------';

describe('cleanCommitMessage', () => {
  it('strips comment lines from header position', () => {
    assert.equal(
      cleanCommitMessage('# Please enter the commit message\nfeat: add login'),
      'feat: add login',
    );
  });

  it('strips comment lines between header and body', () => {
    assert.equal(
      cleanCommitMessage('feat: add login\n\n# On branch main\nBody text.'),
      'feat: add login\n\nBody text.',
    );
  });

  it('strips a trailing comment-only block', () => {
    assert.equal(
      cleanCommitMessage('feat: add login\n\n# Changes to be committed:\n#\tmodified: a.ts\n'),
      'feat: add login\n\n',
    );
  });

  it('keeps a mid-line hash', () => {
    assert.equal(cleanCommitMessage('feat: fix #123'), 'feat: fix #123');
  });

  it('keeps an indented hash line (git only strips column 0)', () => {
    assert.equal(
      cleanCommitMessage('feat: add\n\n  # indented, not a comment'),
      'feat: add\n\n  # indented, not a comment',
    );
  });

  it('drops the scissors line and everything after it', () => {
    const message = `feat: add login\n\n${SCISSORS}\ndiff --git a/a.ts b/a.ts\n+not a comment`;
    assert.equal(cleanCommitMessage(message), 'feat: add login\n');
  });

  it('does not treat an inexact dash count as scissors', () => {
    const almost = '# ----------------------- >8 ------------------------';
    assert.equal(cleanCommitMessage(`feat: add\n${almost}\nbody`), 'feat: add\nbody');
  });

  it('returns an empty string when every line is a comment', () => {
    assert.equal(cleanCommitMessage('# one\n# two'), '');
  });

  it('returns an empty string for empty input', () => {
    assert.equal(cleanCommitMessage(''), '');
  });

  it('normalizes CRLF line endings while stripping', () => {
    assert.equal(
      cleanCommitMessage('feat: add login\r\n\r\n# comment\r\nBody.'),
      'feat: add login\n\nBody.',
    );
  });

  it('is idempotent', () => {
    const message = `feat: add\n\n# comment\nBody.\n${SCISSORS}\ndiff`;
    const once = cleanCommitMessage(message);
    assert.equal(cleanCommitMessage(once), once);
  });
});
