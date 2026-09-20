import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { run } from '../../src/cli.ts';
import { attribution } from '../fixtures/messages.ts';

const execFileAsync = promisify(execFile);

describe('CLI run()', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'commit-sentinel-cli-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('prints help and exits 0', async () => {
    const result = await run(['--help']);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Usage: commit-sentinel/);
  });

  it('prints version and exits 0', async () => {
    const result = await run(['--version']);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /0\.1\.0/);
  });

  it('exits 1 for unknown flags', async () => {
    const result = await run(['--bad-flag']);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Unknown/i);
  });

  it('exits 0 for valid message', async () => {
    const result = await run(['--message', 'chore: bootstrap project']);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
  });

  it('accepts revert type with the conventional preset', async () => {
    const configPath = join(dir, 'conventional.config.ts');
    await writeFile(configPath, `export default { extends: 'conventional' };`);

    const result = await run(['--message', 'revert: undo the login change', '--config', configPath]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
  });

  it('hardened preset rejects a scope-less, body-less message', async () => {
    const configPath = join(dir, 'hardened.config.ts');
    await writeFile(configPath, `export default { extends: 'hardened' };`);

    const result = await run(['--message', 'feat: add login', '--config', configPath]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /scope-required/);
    assert.match(result.stderr, /body-required/);
  });

  it('hardened preset accepts a fully compliant message', async () => {
    const configPath = join(dir, 'hardened.config.ts');
    await writeFile(configPath, `export default { extends: 'hardened' };`);

    const message = 'feat(api): add login\n\nAdd the login flow with session handling.';
    const result = await run(['--message', message, '--config', configPath]);
    assert.equal(result.exitCode, 0);
  });

  it('rejects revert type in the strict preset', async () => {
    const configPath = join(dir, 'strict.config.ts');
    await writeFile(configPath, `export default { extends: 'strict' };`);

    const result = await run(['--message', 'revert: undo the login change', '--config', configPath]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /Unsupported commit type "revert"/);
  });

  it('exits 2 for invalid message', async () => {
    const result = await run(['--message', 'bad message']);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /Invalid commit message/);
  });

  it('reads from a file', async () => {
    const messageFile = join(dir, 'message.txt');
    await writeFile(messageFile, 'fix: handle edge case\n', 'utf8');

    const result = await run(['--file', messageFile]);
    assert.equal(result.exitCode, 0);
  });

  it('rejects multiple sources', async () => {
    const result = await run(['--message', 'feat: x', '--stdin']);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Choose only one/);
  });

  it('rejects combining --json and --sarif', async () => {
    const result = await run(['--message', 'feat: add login', '--json', '--sarif']);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Cannot use both/);
  });

  it('outputs JSON with --json flag', async () => {
    const result = await run(['--message', 'feat: add login', '--json']);
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.valid, true);
  });

  it('outputs SARIF with --sarif flag', async () => {
    const result = await run(['--message', 'feat: add login', '--sarif']);
    assert.equal(result.exitCode, 0);
    const sarif = JSON.parse(result.stdout);
    assert.equal(sarif.version, '2.1.0');
  });

  it('exits 1 when file does not exist', async () => {
    const result = await run(['--file', join(dir, 'nonexistent.txt')]);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.length > 0);
  });

  it('validates a range of commits', async () => {
    const result = await run(['--range', 'HEAD~1..HEAD']);
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
    // Output should contain commit validation info
    assert.ok(result.stdout.length > 0 || result.stderr.length > 0);
  });

  it('validates using --base shorthand', async () => {
    const result = await run(['--base', 'HEAD~1']);
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
    assert.ok(result.stdout.length > 0 || result.stderr.length > 0);
  });

  it('reports no commits for empty range', async () => {
    const result = await run(['--range', 'HEAD..HEAD']);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /No commits found/);
  });

  it('validates JSON output for range is a valid array', async () => {
    const result = await run(['--range', 'HEAD~1..HEAD', '--json']);
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
    const output = result.stdout || result.stderr;
    const parsed = JSON.parse(output);
    assert.ok(Array.isArray(parsed));
  });

  describe('agent-attribution via --message', () => {
    it('rejects a commit with Claude attribution', async () => {
      const configPath = join(dir, 'agent.config.ts');
      await writeFile(configPath, `export default { extends: 'strict', rules: { 'agent-attribution': 'error' } };`);

      const result = await run(['--message', attribution.claudeFooter, '--config', configPath]);
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /agent-attribution/);
    });

    it('passes when the agent is in the allow list', async () => {
      const configPath = join(dir, 'agent-allow.config.ts');
      await writeFile(configPath, `export default { extends: 'strict', rules: { 'agent-attribution': ['error', { allow: ['claude'] }] } };`);

      const result = await run(['--message', attribution.claudeFooter, '--config', configPath]);
      assert.equal(result.exitCode, 0);
    });

    it('warns but exits 0 at warn severity', async () => {
      const configPath = join(dir, 'agent-warn.config.ts');
      await writeFile(configPath, `export default { extends: 'strict', rules: { 'agent-attribution': 'warn' } };`);

      const result = await run(['--message', attribution.claudeFooter, '--config', configPath]);
      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /agent-attribution/);
      assert.match(result.stdout, /warning\(s\)/);
    });
  });

  describe('config option validation', () => {
    it('exits 1 when config has invalid rule options', async () => {
      const configPath = join(dir, 'bad-options.config.ts');
      await writeFile(configPath, `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': ['error', { max: -1 }],
          },
        };
      `);

      const result = await run(['--message', 'feat: add login', '--config', configPath]);
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /Invalid options for rule "header-max-length"/);
      assert.equal(result.stdout, '');
    });

    it('exits 1 when config has invalid subject-case option', async () => {
      const configPath = join(dir, 'bad-case.config.ts');
      await writeFile(configPath, `
        export default {
          extends: 'strict',
          rules: {
            'subject-case': ['warn', { case: 'lowr' }],
          },
        };
      `);

      const result = await run(['--message', 'feat: add login', '--config', configPath]);
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /Invalid options for rule "subject-case"/);
    });

    it('exits 1 when plugin validateOptions rejects options', async () => {
      const configPath = join(dir, 'plugin-validate.config.ts');
      await writeFile(configPath, `
        export default {
          extends: 'strict',
          plugins: [{
            meta: {
              name: 'strict-plugin',
              description: 'plugin with option validation',
              category: 'content',
              requiresGit: false,
              defaultSeverity: 'warn',
            },
            validateOptions(options) {
              if (options.mode !== 'strict') {
                return [{ message: '"mode" must be "strict".' }];
              }
              return [];
            },
            validate() { return []; },
          }],
          rules: {
            'strict-plugin': ['warn', { mode: 'relaxed' }],
          },
        };
      `);

      const result = await run(['--message', 'feat: add login', '--config', configPath]);
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /Invalid options for rule "strict-plugin"/);
    });

    it('config validation error uses exit 1 not exit 2', async () => {
      // Exit 1 = user/config error, Exit 2 = lint failure
      const configPath = join(dir, 'bad-enum.config.ts');
      await writeFile(configPath, `
        export default {
          extends: 'strict',
          rules: {
            'type-enum': ['error', { allowed: 'feat' }],
          },
        };
      `);

      const result = await run(['--message', 'feat: add login', '--config', configPath]);
      assert.equal(result.exitCode, 1);
      assert.notEqual(result.exitCode, 2);
    });
  });

  describe('custom rules via plugins', () => {
    const pluginConfig = `
      export default {
        extends: 'strict',
        plugins: [{
          meta: {
            name: 'no-wip',
            description: 'Subject must not start with WIP',
            category: 'content',
            requiresGit: false,
            defaultSeverity: 'error',
          },
          validate({ commit }) {
            if (commit.subject?.toUpperCase().startsWith('WIP')) {
              return [{ message: 'WIP commits are not allowed.' }];
            }
            return [];
          },
        }],
      };
    `;

    it('exits 2 when a plugin rule fails', async () => {
      const configPath = join(dir, 'plugin.config.ts');
      await writeFile(configPath, pluginConfig);

      const result = await run(['--message', 'feat: WIP do not merge', '--config', configPath]);
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /no-wip/);
      assert.match(result.stderr, /WIP commits are not allowed/);
    });

    it('exits 0 when a plugin rule passes', async () => {
      const configPath = join(dir, 'plugin.config.ts');
      await writeFile(configPath, pluginConfig);

      const result = await run(['--message', 'feat: add login', '--config', configPath]);
      assert.equal(result.exitCode, 0);
    });

    it('exits 1 when a plugin collides with a builtin rule', async () => {
      const configPath = join(dir, 'collision.config.ts');
      await writeFile(configPath, `
        export default {
          plugins: [{
            meta: {
              name: 'format',
              description: 'shadow builtin',
              category: 'format',
              requiresGit: false,
              defaultSeverity: 'error',
            },
            validate() { return []; },
          }],
        };
      `);

      const result = await run(['--message', 'feat: add login', '--config', configPath]);
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /conflicts with a built-in rule/);
    });
  });
});

describe('CLI run() range validation (fixture git repo)', () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(async () => {
    previousCwd = process.cwd();
    dir = await mkdtemp(join(tmpdir(), 'commit-sentinel-range-'));

    const commit = (message: string) =>
      execFileAsync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.com',
          'commit', '--allow-empty', '-m', message],
        { cwd: dir },
      );

    await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    // Oldest→newest: valid, invalid, valid. The range HEAD~2..HEAD covers
    // the last two, so it always contains exactly one invalid commit.
    await commit('chore: bootstrap fixture');
    await commit('bad message with no colon');
    await commit('feat: valid change');
    process.chdir(dir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(dir, { recursive: true, force: true });
  });

  it('exits 2 with output on stderr when a commit in the range is invalid', async () => {
    const result = await run(['--range', 'HEAD~2..HEAD']);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Invalid commit message/);
  });

  it('exits 0 with output on stdout for an empty range', async () => {
    const result = await run(['--range', 'HEAD..HEAD']);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /No commits found/);
  });

  it('merges range reports into a single SARIF document', async () => {
    const result = await run(['--range', 'HEAD~2..HEAD', '--sarif']);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, '');
    const sarif = JSON.parse(result.stderr);
    assert.equal(sarif.version, '2.1.0');
    assert.ok(sarif.runs[0].results.length > 0);
    assert.equal(sarif.runs[0].results[0].level, 'error');
  });

  it('reports a range as a JSON array of reports', async () => {
    const result = await run(['--range', 'HEAD~2..HEAD', '--json']);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, '');
    const reports = JSON.parse(result.stderr);
    assert.ok(Array.isArray(reports));
    assert.equal(reports.length, 2);
    assert.equal(reports[0].valid, false);
    assert.equal(reports[1].valid, true);
  });
});
