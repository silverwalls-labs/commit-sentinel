import { strict as assert } from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { runCli } from '../helpers/spawn.ts';

const INDEX_URL = pathToFileURL(
  resolve(import.meta.dirname, '..', '..', 'src', 'index.ts'),
).href;

describe('CLI e2e', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'commit-sentinel-e2e-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // ── happy paths ──

  it('exits 0 with --help', async () => {
    const result = await runCli(['--help']);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Usage: commit-sentinel/);
    assert.match(result.stdout, /--message/);
    assert.match(result.stdout, /--range/);
    assert.match(result.stdout, /--base/);
  });

  it('exits 0 with --version', async () => {
    const result = await runCli(['--version']);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /\d+\.\d+\.\d+/);
  });

  it('exits 0 for a valid message', async () => {
    const result = await runCli(['--message', 'chore: bootstrap project']);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
  });

  it('exits 0 for valid message with scope', async () => {
    const result = await runCli(['--message', 'feat(api): add endpoint']);
    assert.equal(result.exitCode, 0);
  });

  it('reads from stdin when --stdin is passed', async () => {
    const result = await runCli(['--stdin'], 'feat(ui): add button\n');
    assert.equal(result.exitCode, 0);
  });

  it('reads from a commit message file', async () => {
    const messageFile = join(dir, 'message.txt');
    await writeFile(messageFile, 'fix: handle edge case\n', 'utf8');
    const result = await runCli(['--file', messageFile]);
    assert.equal(result.exitCode, 0);
  });

  it('validates HEAD commit by default (no source flag)', async () => {
    const result = await runCli([]);
    // May pass or fail depending on HEAD commit format, but should not crash
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
  });

  it('validates a specific commit with --commit', async () => {
    const result = await runCli(['--commit', 'HEAD']);
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
    assert.ok(result.stdout.length > 0 || result.stderr.length > 0);
  });

  // ── output formats ──

  it('outputs JSON with --json for valid message', async () => {
    const result = await runCli(['--message', 'feat: add login', '--json']);
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.valid, true);
    assert.ok(parsed.commit);
    assert.equal(parsed.commit.type, 'feat');
    assert.equal(parsed.commit.subject, 'add login');
  });

  it('outputs JSON with --json for invalid message', async () => {
    const result = await runCli(['--message', 'bad message', '--json']);
    assert.equal(result.exitCode, 2);
    const parsed = JSON.parse(result.stderr);
    assert.equal(parsed.valid, false);
    assert.ok(parsed.errorCount > 0);
    assert.ok(parsed.results.length > 0);
  });

  it('outputs SARIF with --sarif for valid message', async () => {
    const result = await runCli(['--message', 'feat: add login', '--sarif']);
    assert.equal(result.exitCode, 0);
    const sarif = JSON.parse(result.stdout);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs[0].tool.driver.name, 'commit-sentinel');
    assert.equal(sarif.runs[0].results.length, 0);
  });

  it('outputs SARIF with --sarif for invalid message', async () => {
    const result = await runCli(['--message', 'bad message', '--sarif']);
    assert.equal(result.exitCode, 2);
    const sarif = JSON.parse(result.stderr);
    assert.equal(sarif.version, '2.1.0');
    assert.ok(sarif.runs[0].results.length > 0);
    assert.equal(sarif.runs[0].results[0].level, 'error');
  });

  // ── range validation ──

  it('validates a commit range with --range', async () => {
    const result = await runCli(['--range', 'HEAD~1..HEAD']);
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
    assert.ok(result.stdout.length > 0 || result.stderr.length > 0);
  });

  it('validates commits with --base shorthand', async () => {
    const result = await runCli(['--base', 'HEAD~1']);
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
    assert.ok(result.stdout.length > 0 || result.stderr.length > 0);
  });

  it('reports no commits for empty range', async () => {
    const result = await runCli(['--range', 'HEAD..HEAD']);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /No commits found/);
  });

  it('validates range with --json output as array', async () => {
    const result = await runCli(['--range', 'HEAD~1..HEAD', '--json']);
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
    const output = result.stdout || result.stderr;
    const parsed = JSON.parse(output);
    assert.ok(Array.isArray(parsed));
    assert.ok(parsed.length > 0);
    assert.equal(typeof parsed[0].valid, 'boolean');
  });

  it('validates range with --sarif output as single document', async () => {
    const result = await runCli(['--range', 'HEAD~1..HEAD', '--sarif']);
    assert.ok(result.exitCode === 0 || result.exitCode === 2);
    const output = result.stdout || result.stderr;
    const sarif = JSON.parse(output);
    assert.equal(sarif.version, '2.1.0');
  });

  it('exits 2 for a range when the config rejects every commit', async () => {
    const configPath = join(dir, 'reject-range.config.ts');
    await writeFile(configPath, `
      export default {
        extends: 'strict',
        rules: {
          'type-enum': ['error', { allowed: ['zzz'] }],
        },
      };
    `);

    const result = await runCli(['--range', 'HEAD~1..HEAD', '--config', configPath]);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.length > 0);
  });

  // ── config ──

  it('uses custom config with --config', async () => {
    const configContent = `
      export default {
        extends: 'conventional',
        rules: {
          'type-enum': ['error', { allowed: ['feat', 'fix', 'docs', 'refactor'] }],
        },
      };
    `;
    const configPath = join(dir, 'custom.config.ts');
    await writeFile(configPath, configContent);

    // 'docs' is allowed by this config, not by default strict preset
    const result = await runCli(['--message', 'docs: update readme', '--config', configPath]);
    assert.equal(result.exitCode, 0);
  });

  it('rejects type not in custom config', async () => {
    const configContent = `
      export default {
        extends: 'strict',
        rules: {
          'type-enum': ['error', { allowed: ['feat'] }],
        },
      };
    `;
    const configPath = join(dir, 'strict.config.ts');
    await writeFile(configPath, configContent);

    const result = await runCli(['--message', 'fix: something', '--config', configPath]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /Unsupported commit type "fix"/);
  });

  // ── custom rules (plugins) ──

  const pluginConfigContent = `
    import { defineRule } from '${INDEX_URL}';

    const noWipRule = defineRule({
      meta: {
        name: 'no-wip',
        description: 'Subject must not start with WIP',
        category: 'content',
        requiresGit: false,
        defaultSeverity: 'error',
      },
      validate({ commit }) {
        if (commit.subject?.toUpperCase().startsWith('WIP')) {
          return [{ message: 'WIP commits are not allowed.', suggestion: 'Remove the WIP prefix.' }];
        }
        return [];
      },
    });

    export default {
      extends: 'strict',
      plugins: [noWipRule],
    };
  `;

  it('runs a defineRule() plugin from config and exits 2 on violation', async () => {
    const configPath = join(dir, 'plugin.config.ts');
    await writeFile(configPath, pluginConfigContent);

    const result = await runCli(['--message', 'feat: WIP do not merge', '--config', configPath]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /no-wip/);
    assert.match(result.stderr, /WIP commits are not allowed/);
  });

  it('exits 0 when the plugin rule passes', async () => {
    const configPath = join(dir, 'plugin.config.ts');
    await writeFile(configPath, pluginConfigContent);

    const result = await runCli(['--message', 'feat: add login', '--config', configPath]);
    assert.equal(result.exitCode, 0);
  });

  it('exits 1 for an unknown rule name in config', async () => {
    const configPath = join(dir, 'unknown-rule.config.ts');
    await writeFile(configPath, `
      export default {
        extends: 'strict',
        rules: {
          'no-such-rule': 'error',
        },
      };
    `);

    const result = await runCli(['--message', 'feat: add login', '--config', configPath]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Unknown rule "no-such-rule"/);
  });

  // ── config option validation ──

  it('exits 1 for invalid rule options in config', async () => {
    const configPath = join(dir, 'bad-options.config.ts');
    await writeFile(configPath, `
      export default {
        extends: 'strict',
        rules: {
          'header-max-length': ['error', { max: 'big' }],
        },
      };
    `);

    const result = await runCli(['--message', 'feat: add login', '--config', configPath]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Invalid options for rule "header-max-length"/);
  });

  it('exits 1 for invalid subject-case option in config', async () => {
    const configPath = join(dir, 'bad-case.config.ts');
    await writeFile(configPath, `
      export default {
        extends: 'strict',
        rules: {
          'subject-case': ['warn', { case: 'camelCase' }],
        },
      };
    `);

    const result = await runCli(['--message', 'feat: add login', '--config', configPath]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Invalid options for rule "subject-case"/);
  });

  it('exits 1 for invalid agent-attribution allow option in config', async () => {
    const configPath = join(dir, 'bad-agent.config.ts');
    await writeFile(configPath, `
      export default {
        extends: 'strict',
        rules: {
          'agent-attribution': ['error', { allow: ['cluade'] }],
        },
      };
    `);

    const result = await runCli(['--message', 'feat: add login', '--config', configPath]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Invalid options for rule "agent-attribution"/);
    assert.match(result.stderr, /Unknown agent ID/);
  });

  it('exits 1 for a typo\'d severity in config', async () => {
    const configPath = join(dir, 'bad-severity.config.ts');
    await writeFile(configPath, `
      export default {
        extends: 'strict',
        rules: {
          'header-max-length': ['oops', { max: 100 }],
        },
      };
    `);

    const result = await runCli(['--message', 'feat: add login', '--config', configPath]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Unknown severity "oops" for rule/);
  });

  it('config validation error outputs plain text even with --json', async () => {
    const configPath = join(dir, 'bad-json.config.ts');
    await writeFile(configPath, `
      export default {
        extends: 'strict',
        rules: {
          'header-max-length': ['error', { max: -1 }],
        },
      };
    `);

    const result = await runCli(['--message', 'feat: add login', '--config', configPath, '--json']);
    assert.equal(result.exitCode, 1);
    // Config errors bypass the formatter — stderr is plain text, not JSON
    assert.match(result.stderr, /Invalid options for rule/);
    assert.throws(() => JSON.parse(result.stderr), 'stderr should not be valid JSON');
  });

  // ── negative / error paths ──

  it('exits 2 for invalid format (no colon)', async () => {
    const result = await runCli(['--message', 'fix bug']);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /must match/);
  });

  it('exits 2 for unsupported type', async () => {
    const result = await runCli(['--message', 'yolo: move files']);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /Unsupported commit type "yolo"/);
  });

  it('exits 2 for empty message', async () => {
    const result = await runCli(['--message', '']);
    assert.equal(result.exitCode, 2);
  });

  it('exits 1 for non-existent file', async () => {
    const result = await runCli(['--file', join(dir, 'ghost.txt')]);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.length > 0);
  });

  it('exits 1 for non-existent config file', async () => {
    const result = await runCli(['--message', 'feat: ok', '--config', join(dir, 'nope.ts')]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Config file not found|Failed to load/);
  });

  it('exits 1 for unknown flag', async () => {
    const result = await runCli(['--nope']);
    assert.equal(result.exitCode, 1);
  });

  it('exits 1 when multiple sources given', async () => {
    const result = await runCli(['--message', 'feat: x', '--stdin']);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Choose only one/);
  });

  it('exits 1 when --json and --sarif combined', async () => {
    const result = await runCli(['--message', 'feat: x', '--json', '--sarif']);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Cannot use both/);
  });

  it('exits 1 for invalid git range', async () => {
    const result = await runCli(['--range', 'nonexistent-branch..HEAD']);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.length > 0);
  });

  it('exits 1 for invalid commit ref', async () => {
    const result = await runCli(['--commit', 'nonexistent-ref-abc123']);
    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.length > 0);
  });

  it('handles message with only whitespace', async () => {
    const result = await runCli(['--message', '   ']);
    assert.equal(result.exitCode, 2);
  });

  it('handles file with CRLF line endings', async () => {
    const messageFile = join(dir, 'crlf.txt');
    await writeFile(messageFile, 'feat: crlf test\r\n\r\nbody\r\n', 'utf8');
    const result = await runCli(['--file', messageFile]);
    assert.equal(result.exitCode, 0);
  });

  it('handles commit message with unicode', async () => {
    const result = await runCli(['--message', 'feat: ajouter la connexion 🚀']);
    assert.equal(result.exitCode, 0);
  });
});
