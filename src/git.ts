import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Metadata about a git commit that is not part of the commit message itself. */
export interface GitMeta {
  /** The author email address (`git log --format=%ae`). */
  authorEmail: string;
  /** `true` when the commit carries a cryptographic signature (GPG or SSH). */
  signed: boolean;
}

/**
 * Read the full commit message for a given git ref.
 *
 * @param ref - A git ref (SHA, branch, tag, or `HEAD`). Defaults to `"HEAD"`.
 * @returns The raw commit message including body and footers.
 * @throws When the ref does not exist or `git` is not available.
 */
export async function readCommitMessage(ref = 'HEAD'): Promise<string> {
  const { stdout } = await execFileAsync('git', ['show', '-s', '--format=%B', ref], {
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

/**
 * Parse raw `git show -s --format=%ae%n%G?` output into a {@link GitMeta}.
 *
 * @param stdout - The raw `git show` output (author email line, then signature status).
 * @returns The parsed {@link GitMeta}.
 */
export function parseGitMeta(stdout: string): GitMeta {
  const lines = stdout.trim().split('\n');
  const authorEmail = lines[0]!;
  const sigStatus = lines[1] ?? 'N';

  // %G? returns: G=good, B=bad, U=untrusted, X=expired, Y=expired key,
  // R=revoked, E=error, N=no signature. Treat anything except N/E as signed.
  const signed = sigStatus !== 'N' && sigStatus !== 'E';

  return { authorEmail, signed };
}

/**
 * Read git metadata (author email, signing status) for a commit.
 *
 * Signing is a **presence check only** — the signature is not verified.
 *
 * @param ref - A git ref. Defaults to `"HEAD"`.
 * @returns The commit's {@link GitMeta}.
 * @throws When the ref does not exist or `git` is not available.
 */
export async function readGitMeta(ref = 'HEAD'): Promise<GitMeta> {
  const { stdout } = await execFileAsync(
    'git',
    ['show', '-s', '--format=%ae%n%G?', ref],
    { maxBuffer: 1024 * 1024 },
  );
  return parseGitMeta(stdout);
}

/**
 * Read git metadata, returning `null` when it is unavailable (bad ref, not a
 * git repository, or `git` is missing) instead of throwing.
 *
 * Callers use this so that git-metadata rules can be skipped gracefully.
 *
 * @param ref - A git ref. Defaults to `"HEAD"`.
 */
export async function readGitMetaOrNull(ref = 'HEAD'): Promise<GitMeta | null> {
  try {
    return await readGitMeta(ref);
  } catch {
    return null;
  }
}

/**
 * List commit SHAs in a git range, oldest first.
 *
 * @param range - A git revision range (e.g. `"main..HEAD"`).
 * @returns An array of full 40-character SHA strings.
 * @throws When the range is invalid or `git` is not available.
 */
export async function listCommitsInRange(range: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['rev-list', '--reverse', '--no-merges', range], {
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim().split('\n').filter((line) => line.length > 0);
}
