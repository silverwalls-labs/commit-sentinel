import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { signedOffByRule } from '../../../src/rules/signed-off-by.ts';
import { valid } from '../../fixtures/messages.ts';

function run(message: string) {
  return signedOffByRule.validate({
    commit: parseCommit(message),
    git: null,
    options: {},
  });
}

describe('signed-off-by rule', () => {
  it('rejects a message without footers', () => {
    const problems = run('feat: x');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /Signed-off-by/);
  });

  it('rejects a message whose footers lack a sign-off', () => {
    assert.equal(run(valid.withMultipleFooters).length, 1);
  });

  it('accepts a valid sign-off', () => {
    assert.equal(run(valid.withSignOff).length, 0);
  });

  it('matches the token case-insensitively', () => {
    assert.equal(run('feat: x\n\nsigned-off-by: Ada Lovelace <ada@example.com>').length, 0);
  });

  it('accepts multiple valid sign-offs', () => {
    const message =
      'feat: x\n\nSigned-off-by: Ada Lovelace <ada@example.com>\nSigned-off-by: Bob <bob@example.com>';
    assert.equal(run(message).length, 0);
  });

  it('rejects a name-only sign-off', () => {
    const problems = run('feat: x\n\nSigned-off-by: Ada Lovelace');
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /Name <email>/);
  });

  it('rejects a bare email sign-off', () => {
    assert.equal(run('feat: x\n\nSigned-off-by: ada@example.com').length, 1);
  });

  it('rejects an email without an @', () => {
    assert.equal(run('feat: x\n\nSigned-off-by: Ada <ada.example.com>').length, 1);
  });

  it('rejects trailing text after the email', () => {
    assert.equal(run('feat: x\n\nSigned-off-by: Ada <ada@example.com> extra').length, 1);
  });

  it('rejects a sign-off with a continuation line', () => {
    assert.equal(run('feat: x\n\nSigned-off-by: Ada <ada@example.com>\nnot a footer').length, 1);
  });

  it('rejects a continuation line hidden in the name', () => {
    assert.equal(run('feat: x\n\nSigned-off-by: Ada\nLovelace <ada@example.com>').length, 1);
  });

  it('reports one problem per malformed sign-off', () => {
    const message = 'feat: x\n\nSigned-off-by: Ada Lovelace <ada@example.com>\nSigned-off-by: Bob';
    const problems = run(message);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /Name <email>/);
  });
});
