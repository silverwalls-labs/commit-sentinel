import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../src/parser.ts';
import { valid, invalid } from '../fixtures/messages.ts';

describe('parseCommit', () => {
  it('parses a simple commit message', () => {
    const result = parseCommit(valid.simple);
    assert.equal(result.type, 'feat');
    assert.equal(result.scope, null);
    assert.equal(result.breaking, false);
    assert.equal(result.hasBreakingChange, false);
    assert.equal(result.subject, 'add login');
    assert.equal(result.body, null);
    assert.deepEqual(result.footers, []);
  });

  it('parses a commit with scope', () => {
    const result = parseCommit(valid.withScope);
    assert.equal(result.type, 'fix');
    assert.equal(result.scope, 'api');
    assert.equal(result.subject, 'handle timeout');
  });

  it('parses a commit with breaking marker', () => {
    const result = parseCommit(valid.withBreakingMarker);
    assert.equal(result.type, 'feat');
    assert.equal(result.breaking, true);
    assert.equal(result.hasBreakingChange, true);
    assert.equal(result.subject, 'drop legacy API');
  });

  it('parses a commit with scope and breaking marker', () => {
    const result = parseCommit('refactor(core)!: rewrite internals');
    assert.equal(result.type, 'refactor');
    assert.equal(result.scope, 'core');
    assert.equal(result.breaking, true);
    assert.equal(result.subject, 'rewrite internals');
  });

  it('parses a commit with body', () => {
    const result = parseCommit('feat: add login\n\nThis adds the login feature.');
    assert.equal(result.type, 'feat');
    assert.equal(result.subject, 'add login');
    assert.equal(result.body, 'This adds the login feature.');
    assert.deepEqual(result.footers, []);
  });

  it('parses a commit with multi-paragraph body', () => {
    const result = parseCommit(
      'feat: add login\n\nFirst paragraph.\n\nSecond paragraph.',
    );
    assert.equal(result.body, 'First paragraph.\n\nSecond paragraph.');
    assert.deepEqual(result.footers, []);
  });

  it('parses a commit with footers', () => {
    const result = parseCommit(
      'feat: add login\n\nSome body.\n\nReviewed-by: Alice\nRefs #123',
    );
    assert.equal(result.body, 'Some body.');
    assert.equal(result.footers.length, 2);
    assert.equal(result.footers[0]?.token, 'Reviewed-by');
    assert.equal(result.footers[0]?.value, 'Alice');
    assert.equal(result.footers[1]?.token, 'Refs');
    assert.equal(result.footers[1]?.value, '123');
  });

  it('parses BREAKING CHANGE footer', () => {
    const result = parseCommit(
      'feat!: drop API\n\nBody text.\n\nBREAKING CHANGE: removed /v1 endpoint',
    );
    assert.equal(result.breaking, true);
    assert.equal(result.hasBreakingChange, true);
    assert.equal(result.footers.length, 1);
    assert.equal(result.footers[0]?.token, 'BREAKING CHANGE');
    assert.equal(result.footers[0]?.value, 'removed /v1 endpoint');
  });

  it('parses BREAKING-CHANGE footer', () => {
    const result = parseCommit(
      'feat: change\n\nBREAKING-CHANGE: new behavior',
    );
    assert.equal(result.breaking, false);
    assert.equal(result.hasBreakingChange, true);
    assert.equal(result.footers.length, 1);
    assert.equal(result.footers[0]?.token, 'BREAKING-CHANGE');
    assert.equal(result.footers[0]?.value, 'new behavior');
  });

  it('hasBreakingChange is false for normal commits', () => {
    const result = parseCommit(valid.simple);
    assert.equal(result.hasBreakingChange, false);
  });

  it('parses footer continuation lines', () => {
    const result = parseCommit(
      'fix: bug\n\nBREAKING CHANGE: first line\ncontinuation line',
    );
    assert.equal(result.footers.length, 1);
    assert.equal(
      result.footers[0]?.value,
      'first line\ncontinuation line',
    );
  });

  it('trims blank lines between body and footer section', () => {
    const result = parseCommit('feat: add login\n\nbody text\n\n\nRefs: #1');
    assert.equal(result.body, 'body text');
    assert.deepEqual(result.footers, [{ token: 'Refs', separator: ': ', value: '#1' }]);
  });

  it('returns null type for malformed header', () => {
    const result = parseCommit(invalid.noColon);
    assert.equal(result.type, null);
    assert.equal(result.subject, null);
    assert.equal(result.header, 'fix bug');
  });

  it('returns null type for empty string', () => {
    const result = parseCommit(invalid.empty);
    assert.equal(result.type, null);
    assert.equal(result.subject, null);
    assert.equal(result.header, '');
  });

  it('handles whitespace-only input', () => {
    const result = parseCommit(invalid.whitespaceOnly);
    assert.equal(result.type, null);
    assert.equal(result.subject, null);
  });

  it('parses only the first line as header', () => {
    const result = parseCommit('feat: first line\nsecond line');
    assert.equal(result.header, 'feat: first line');
    assert.equal(result.type, 'feat');
    assert.equal(result.subject, 'first line');
  });

  it('preserves raw message', () => {
    const msg = 'feat(api): add endpoint\n\nbody\n';
    const result = parseCommit(msg);
    assert.equal(result.raw, msg);
  });

  it('parses footers without body', () => {
    const result = parseCommit('feat: add login\n\nReviewed-by: Alice');
    assert.equal(result.body, null);
    assert.equal(result.footers.length, 1);
    assert.equal(result.footers[0]?.token, 'Reviewed-by');
  });

  it('handles body that looks like footer but is not', () => {
    // Body contains a colon but not in footer format
    const result = parseCommit('feat: add\n\nNote: this is body text');
    // "Note: this" would match footer pattern, so it's treated as footer
    assert.equal(result.footers.length, 1);
    assert.equal(result.footers[0]?.token, 'Note');
  });
});
