import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gitEnv } from './git-env.ts';

const execFileAsync = promisify(execFile);

/** Create an empty commit in `dir` with a fixed test identity. */
export function commitIn(dir: string, message: string): Promise<unknown> {
  return execFileAsync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com',
      'commit', '--allow-empty', '-m', message],
    { cwd: dir, env: gitEnv },
  );
}

/**
 * Write `content` to `file` and commit it in `dir` with a fixed test identity.
 * Unlike {@link commitIn}, the commit carries a real change — so it can be
 * meaningfully reverted with `git revert`.
 */
export async function commitFileIn(
  dir: string,
  file: string,
  content: string,
  message: string,
): Promise<void> {
  await writeFile(join(dir, file), content, 'utf8');
  await execFileAsync('git', ['add', file], { cwd: dir, env: gitEnv });
  await execFileAsync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com',
      'commit', '-m', message],
    { cwd: dir, env: gitEnv },
  );
}

/**
 * Create a temp git repository on branch `main` with one empty commit per
 * message (oldest first). The caller owns cleanup (`rm`) and any `chdir`.
 */
export async function createFixtureRepo(
  prefix: string,
  messages: readonly string[],
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir, env: gitEnv });
  for (const message of messages) {
    await commitIn(dir, message);
  }
  return dir;
}
