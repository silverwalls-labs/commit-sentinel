import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseGitMeta, readCommitMessage, readGitMeta, readGitMetaOrNull, listCommitsInRange } from '../../src/git.ts';

describe('parseGitMeta', () => {
  it('parses an unsigned commit (N)', () => {
    assert.deepEqual(parseGitMeta('dev@example.com\nN\n'), {
      authorEmail: 'dev@example.com',
      signed: false,
    });
  });

  it('treats a good signature (G) as signed', () => {
    assert.deepEqual(parseGitMeta('dev@example.com\nG\n'), {
      authorEmail: 'dev@example.com',
      signed: true,
    });
  });

  it('treats a bad signature (B) as signed', () => {
    assert.equal(parseGitMeta('dev@example.com\nB\n').signed, true);
  });

  it('treats an untrusted signature (U) as signed', () => {
    assert.equal(parseGitMeta('dev@example.com\nU\n').signed, true);
  });

  it('treats a signature error (E) as unsigned', () => {
    assert.deepEqual(parseGitMeta('dev@example.com\nE\n'), {
      authorEmail: 'dev@example.com',
      signed: false,
    });
  });

  it('defaults the signature status to N for single-line output', () => {
    assert.deepEqual(parseGitMeta('dev@example.com'), {
      authorEmail: 'dev@example.com',
      signed: false,
    });
  });

  it('parses empty output', () => {
    assert.deepEqual(parseGitMeta(''), {
      authorEmail: '',
      signed: false,
    });
  });

  it('trims surrounding whitespace', () => {
    assert.deepEqual(parseGitMeta('  dev@example.com\nN  '), {
      authorEmail: 'dev@example.com',
      signed: false,
    });
  });
});

describe('git operations', () => {
  it('readCommitMessage reads HEAD commit', async () => {
    const message = await readCommitMessage('HEAD');
    assert.equal(typeof message, 'string');
    assert.ok(message.length > 0);
  });

  it('readGitMeta reads author email from HEAD', async () => {
    const meta = await readGitMeta('HEAD');
    assert.equal(typeof meta.authorEmail, 'string');
    assert.ok(meta.authorEmail.includes('@'));
    assert.equal(typeof meta.signed, 'boolean');
  });

  it('readGitMetaOrNull returns metadata for a valid ref', async () => {
    const meta = await readGitMetaOrNull('HEAD');
    assert.ok(meta !== null);
    assert.ok(meta!.authorEmail.includes('@'));
  });

  it('readGitMetaOrNull returns null for an invalid ref', async () => {
    assert.equal(await readGitMetaOrNull('nonexistent-ref-abc123'), null);
  });

  it('listCommitsInRange returns commit SHAs', async () => {
    const shas = await listCommitsInRange('HEAD~1..HEAD');
    assert.ok(Array.isArray(shas));
    assert.ok(shas.length >= 1, `Expected at least 1 commit, got ${shas.length}`);
    for (const sha of shas) {
      assert.match(sha, /^[0-9a-f]{40}$/);
    }
  });

  it('listCommitsInRange returns an empty array for an empty range', async () => {
    const shas = await listCommitsInRange('HEAD..HEAD');
    assert.deepEqual(shas, []);
  });

  it('readCommitMessage rejects invalid ref', async () => {
    await assert.rejects(
      () => readCommitMessage('nonexistent-ref-abc123'),
    );
  });
});
