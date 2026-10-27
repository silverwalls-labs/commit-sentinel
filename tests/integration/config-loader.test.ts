import { strict as assert } from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../src/config/loader.ts';
import { defaultIgnores } from '../../src/ignores.ts';
import { validate } from '../../src/runner.ts';
import { INDEX_URL } from '../helpers/index-url.ts';

/** A minimal plugin rule as inline config-file source. */
function pluginSource(name: string, defaultSeverity = 'error'): string {
  return `{
    meta: {
      name: '${name}',
      description: 'Subject must not contain ${name}',
      category: 'content',
      requiresGit: false,
      defaultSeverity: '${defaultSeverity}',
    },
    validate({ commit }) {
      if (commit.subject?.includes('${name}')) {
        return [{ message: 'Found forbidden token "${name}".' }];
      }
      return [];
    },
  }`;
}

describe('loadConfig', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'commit-sentinel-config-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('falls back to strict preset when no config file', async () => {
    const config = await loadConfig(dir);
    assert.ok(config.rules['format']);
    assert.ok(config.rules['type-enum']);
    assert.equal(config.rules['type-enum']!.severity, 'error');
  });

  it('loads config file from directory', async () => {
    const configContent = `
      export default {
        extends: 'conventional',
        rules: {
          'subject-max-length': ['warn', { max: 50 }],
        },
      };
    `;
    await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

    const config = await loadConfig(dir);
    assert.ok(config.rules['subject-max-length']);
    assert.equal(config.rules['subject-max-length']!.severity, 'warn');
    assert.deepEqual(config.rules['subject-max-length']!.options, { max: 50 });
  });

  it('merges user rules on top of preset', async () => {
    const configContent = `
      export default {
        extends: 'strict',
        rules: {
          'type-enum': ['error', { allowed: ['feat', 'fix'] }],
        },
      };
    `;
    await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

    const config = await loadConfig(dir);
    const typeEnum = config.rules['type-enum']!;
    assert.equal(typeEnum.severity, 'error');
    assert.deepEqual(typeEnum.options, { allowed: ['feat', 'fix'] });
  });

  it('defaults options to {} for a tuple without options', async () => {
    const configContent = `
      export default {
        extends: 'strict',
        rules: {
          'header-max-length': ['error'],
        },
      };
    `;
    await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

    const config = await loadConfig(dir);
    assert.equal(config.rules['header-max-length']!.severity, 'error');
    assert.deepEqual(config.rules['header-max-length']!.options, {});
  });

  it('removes rules set to off', async () => {
    const configContent = `
      export default {
        extends: 'strict',
        rules: {
          'format': 'off',
        },
      };
    `;
    await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

    const config = await loadConfig(dir);
    assert.equal(config.rules['format'], undefined);
  });

  it('throws for unknown preset', async () => {
    const configContent = `
      export default {
        extends: 'nonexistent',
      };
    `;
    await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

    await assert.rejects(
      () => loadConfig(dir),
      /Unknown preset "nonexistent"/,
    );
  });

  it('throws when explicit config path does not exist', async () => {
    await assert.rejects(
      () => loadConfig(dir, 'missing.config.ts'),
      /Config file not found/,
    );
  });

  it('throws when config file has syntax error', async () => {
    await writeFile(
      join(dir, 'commit-sentinel.config.ts'),
      'export default {{{ invalid syntax',
    );
    await assert.rejects(
      () => loadConfig(dir),
      /Failed to load config file/,
    );
  });

  it('falls back to strict when config file has no default export', async () => {
    await writeFile(
      join(dir, 'commit-sentinel.config.ts'),
      'export const foo = 42;',
    );
    const config = await loadConfig(dir);
    // No default export → null → falls back to strict
    assert.ok(config.rules['format']);
    assert.ok(config.rules['type-enum']);
  });

  describe('plugins', () => {
    it('auto-enables a plugin rule at its default severity', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          plugins: [${pluginSource('no-wip', 'warn')}],
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

      const config = await loadConfig(dir);
      assert.ok(config.rules['no-wip']);
      assert.equal(config.rules['no-wip']!.severity, 'warn');
      assert.ok(config.ruleRegistry!.has('no-wip'));
      // Builtins remain in the registry untouched
      assert.ok(config.ruleRegistry!.has('format'));
    });

    it('runs a defineRule() plugin end-to-end through validate()', async () => {
      const configContent = `
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
              return [{ message: 'WIP commits are not allowed.' }];
            }
            return [];
          },
        });

        export default {
          extends: 'strict',
          plugins: [noWipRule],
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

      const config = await loadConfig(dir);
      const failing = validate('feat: WIP do not merge', config);
      assert.equal(failing.valid, false);
      assert.ok(failing.results.some((r) => r.ruleName === 'no-wip'));

      const passing = validate('feat: add login', config);
      assert.equal(passing.valid, true);
    });

    it('lets a rules entry override plugin severity and options', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          plugins: [${pluginSource('no-wip')}],
          rules: {
            'no-wip': ['warn', { strict: true }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

      const config = await loadConfig(dir);
      assert.equal(config.rules['no-wip']!.severity, 'warn');
      assert.deepEqual(config.rules['no-wip']!.options, { strict: true });
    });

    it('lets a rules entry turn a plugin off', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          plugins: [${pluginSource('no-wip')}],
          rules: {
            'no-wip': 'off',
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

      const config = await loadConfig(dir);
      assert.equal(config.rules['no-wip'], undefined);
    });

    it('throws when a plugin name collides with a builtin rule', async () => {
      const configContent = `
        export default {
          plugins: [${pluginSource('type-enum')}],
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

      await assert.rejects(
        () => loadConfig(dir),
        /Plugin rule "type-enum" conflicts with a built-in rule/,
      );
    });

    it('throws on duplicate plugin names', async () => {
      const configContent = `
        export default {
          plugins: [${pluginSource('no-wip')}, ${pluginSource('no-wip')}],
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

      await assert.rejects(
        () => loadConfig(dir),
        /Duplicate plugin rule "no-wip"/,
      );
    });

    it('throws for unknown rule names in rules', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'no-such-rule': 'error',
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

      await assert.rejects(
        () => loadConfig(dir),
        /Unknown rule "no-such-rule" in config/,
      );
    });

    it('resolves a rules entry that targets a plugin rule', async () => {
      // The unknown-rule check must accept plugin names, not just builtins
      const configContent = `
        export default {
          plugins: [${pluginSource('no-wip')}],
          rules: {
            'no-wip': 'error',
            'format': 'warn',
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);

      const config = await loadConfig(dir);
      assert.equal(config.rules['no-wip']!.severity, 'error');
      assert.equal(config.rules['format']!.severity, 'warn');
    });

    it('throws for malformed plugin entries', async () => {
      const invalidPlugins = [
        'null',
        '42',
        '{}',
        "{ meta: { name: 42 }, validate() { return []; } }",
        "{ meta: { name: 'no-validate' } }",
        "{ meta: { name: 'bad-validate-options' }, validate() { return []; }, validateOptions: 'typo' }",
        "{ meta: { name: 'bad-check-range' }, validate() { return []; }, checkRange: 'typo' }",
      ];

      for (const [index, plugin] of invalidPlugins.entries()) {
        const fileName = `invalid-${index}.config.ts`;
        await writeFile(
          join(dir, fileName),
          `export default { plugins: [${plugin}] };`,
        );
        await assert.rejects(
          () => loadConfig(dir, fileName),
          /Invalid entry in "plugins"/,
          `plugin entry: ${plugin}`,
        );
      }
    });

    it('exposes the builtin registry when config has no plugins', async () => {
      const config = await loadConfig(dir);
      assert.ok(config.ruleRegistry);
      assert.ok(config.ruleRegistry.has('format'));
      assert.equal(config.ruleRegistry.has('no-wip'), false);
    });
  });

  describe('rule option validation', () => {
    it('throws for invalid rule options at load time', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': ['warn', { max: -5 }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid options for rule "header-max-length"/,
      );
    });

    it('throws for invalid max-commits option', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'max-commits': ['error', { max: 0 }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid options for rule "max-commits"/,
      );
    });

    it('throws for invalid subject-case option', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'subject-case': ['warn', { case: 'lowr' }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid options for rule "subject-case"/,
      );
    });

    it('throws for non-array type-enum allowed', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'type-enum': ['error', { allowed: 'feat' }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid options for rule "type-enum"/,
      );
    });

    it('throws for empty type-enum allowed list', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'type-enum': ['error', { allowed: [] }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        (err: Error) => {
          assert.match(err.message, /Invalid options for rule "type-enum"/);
          assert.match(err.message, /"allowed" must not be empty/);
          return true;
        },
      );
    });

    it('throws for empty scope-enum allowed list', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'scope-enum': ['error', { allowed: [] }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        (err: Error) => {
          assert.match(err.message, /Invalid options for rule "scope-enum"/);
          assert.match(err.message, /"allowed" must not be empty/);
          return true;
        },
      );
    });

    it('accepts valid rule options without error', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': ['warn', { max: 72 }],
            'subject-case': ['warn', { case: 'lower' }],
            'type-enum': ['error', { allowed: ['feat', 'fix'] }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      const config = await loadConfig(dir);
      assert.ok(config.rules['header-max-length']);
      assert.ok(config.rules['subject-case']);
      assert.ok(config.rules['type-enum']);
    });

    it('does not validate options for disabled rules', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': 'off',
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      const config = await loadConfig(dir);
      assert.equal(config.rules['header-max-length'], undefined);
    });

    it('validates plugin rule options via validateOptions', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          plugins: [{
            meta: {
              name: 'custom-validated',
              description: 'A plugin with option validation',
              category: 'content',
              requiresGit: false,
              defaultSeverity: 'warn',
            },
            validateOptions(options) {
              if (options.foo !== 'bar') {
                return [{ message: '"foo" must be "bar".' }];
              }
              return [];
            },
            validate() { return []; },
          }],
          rules: {
            'custom-validated': ['warn', { foo: 'baz' }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid options for rule "custom-validated"/,
      );
    });

    it('throws on the first invalid rule (fail-fast)', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': ['warn', { max: -5 }],
            'subject-case': ['warn', { case: 'lowr' }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid options for rule/,
      );
    });

    it('all built-in presets pass option validation', async () => {
      for (const preset of ['strict', 'conventional', 'angular', 'hardened']) {
        // Use a distinct directory per preset to avoid ESM module cache reuse
        const presetDir = join(dir, preset);
        await mkdir(presetDir);
        const configContent = `export default { extends: '${preset}' };`;
        await writeFile(join(presetDir, 'commit-sentinel.config.ts'), configContent);
        const config = await loadConfig(presetDir);
        assert.ok(config.rules, `preset "${preset}" should resolve without error`);
        // Verify each preset returns its expected rule count
        const ruleCount = Object.keys(config.rules).length;
        assert.ok(ruleCount > 0, `preset "${preset}" should have active rules`);
      }
    });

    it('includes the rule name in the error message', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'body-max-line-length': ['warn', { max: 'banana' }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        (err: Error) => {
          assert.match(err.message, /Invalid options for rule "body-max-line-length"/);
          assert.match(err.message, /positive integer/);
          return true;
        },
      );
    });

    it('passes when plugin validateOptions returns empty', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          plugins: [{
            meta: {
              name: 'custom-validated',
              description: 'A plugin with option validation',
              category: 'content',
              requiresGit: false,
              defaultSeverity: 'warn',
            },
            validateOptions(options) {
              return [];
            },
            validate() { return []; },
          }],
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      const config = await loadConfig(dir);
      assert.ok(config.rules['custom-validated']);
    });
  });

  describe('ignores resolution', () => {
    it('resolves the default ignores when no config file exists', async () => {
      const config = await loadConfig(dir);
      assert.deepEqual(config.ignores, defaultIgnores);
    });

    it('resolves the default ignores when the config does not mention them', async () => {
      await writeFile(
        join(dir, 'commit-sentinel.config.ts'),
        `export default { extends: 'conventional' };`,
      );
      const config = await loadConfig(dir);
      assert.deepEqual(config.ignores, defaultIgnores);
    });

    it('resolves an empty list for defaultIgnores: false', async () => {
      await writeFile(
        join(dir, 'commit-sentinel.config.ts'),
        `export default { defaultIgnores: false };`,
      );
      const config = await loadConfig(dir);
      assert.deepEqual(config.ignores, []);
    });

    it('appends custom predicates after the defaults', async () => {
      const configContent = `
        export default {
          ignores: [function noWip(message) { return message.startsWith('WIP'); }],
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      const config = await loadConfig(dir);
      assert.equal(config.ignores!.length, defaultIgnores.length + 1);
      assert.equal(config.ignores![0]!.name, defaultIgnores[0]!.name);
      assert.equal(config.ignores!.at(-1)!.name, 'noWip');
    });

    it('runs a custom ignore end-to-end through validate()', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          defaultIgnores: false,
          ignores: [function wip(message) { return message.startsWith('WIP'); }],
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      const config = await loadConfig(dir);

      const ignored = validate('WIP stuff', config);
      assert.equal(ignored.ignored, true);
      assert.equal(ignored.ignoredBy, 'wip');

      // Defaults are off: a git revert message is validated (and fails format).
      const revert = validate('Revert "feat: add login"', config);
      assert.equal(revert.valid, false);
      assert.ok(!('ignored' in revert));
    });

    it('throws for a non-boolean defaultIgnores', async () => {
      await writeFile(
        join(dir, 'commit-sentinel.config.ts'),
        `export default { defaultIgnores: 'yes' };`,
      );
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid "defaultIgnores" in config: expected a boolean, got: string\./,
      );
    });

    it('throws for a non-array ignores', async () => {
      await writeFile(
        join(dir, 'commit-sentinel.config.ts'),
        `export default { ignores: 'nope' };`,
      );
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid "ignores" in config: expected an array of functions\./,
      );
    });

    it('throws for a non-function ignores entry', async () => {
      await writeFile(
        join(dir, 'commit-sentinel.config.ts'),
        `export default { ignores: [42] };`,
      );
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid entry in "ignores": expected a function/,
      );
    });

    it('throws when a custom predicate name collides with a built-in pattern', async () => {
      await writeFile(
        join(dir, 'commit-sentinel.config.ts'),
        `export default { ignores: [function merge(message) { return message.startsWith('WIP'); }] };`,
      );
      await assert.rejects(
        () => loadConfig(dir),
        /Custom ignore "merge" conflicts with a built-in ignore pattern of the same name\./,
      );
    });
  });

  describe('severity and shape validation', () => {
    it('throws for a typo\'d severity in tuple form', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': ['oops', { max: 100 }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Unknown severity "oops" for rule "header-max-length"/,
      );
    });

    it('throws for a typo\'d bare string severity', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': 'Warning',
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Unknown severity "Warning" for rule/,
      );
    });

    it('throws for a non-string severity in tuple form', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': [42, {}],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Unknown severity 42 for rule/,
      );
    });

    it('throws for a non-string, non-tuple rule config', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': 42,
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid configuration for rule/,
      );
    });

    it('throws for non-object options in tuple form', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': ['warn', 'oops'],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid options for rule.*expected an object/,
      );
    });

    it('throws for explicit null options in tuple form', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': ['warn', null],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      await assert.rejects(
        () => loadConfig(dir),
        /Invalid options for rule/,
      );
    });

    it('disables the rule for an off tuple with options', async () => {
      const configContent = `
        export default {
          extends: 'strict',
          rules: {
            'header-max-length': ['off', { max: 50 }],
          },
        };
      `;
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configContent);
      const config = await loadConfig(dir);
      assert.equal(config.rules['header-max-length'], undefined);
    });
  });

  describe('config discovery walk', () => {
    /** Config source with a distinctive subject-max-length to tell configs apart. */
    function configSource(max: number): string {
      return `
        export default {
          extends: 'strict',
          rules: {
            'subject-max-length': ['warn', { max: ${max} }],
          },
        };
      `;
    }

    it('finds config in a parent directory from a nested child', async () => {
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configSource(41));
      const child = join(dir, 'packages', 'app');
      await mkdir(child, { recursive: true });

      const config = await loadConfig(child);
      assert.deepEqual(config.rules['subject-max-length']!.options, { max: 41 });
    });

    it('nearest config wins over an ancestor config', async () => {
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configSource(42));
      const pkg = join(dir, 'pkg');
      const nested = join(pkg, 'nested');
      await mkdir(nested, { recursive: true });
      await writeFile(join(pkg, 'commit-sentinel.config.ts'), configSource(43));

      const config = await loadConfig(nested);
      assert.deepEqual(config.rules['subject-max-length']!.options, { max: 43 });
    });

    it('stops at a .git directory boundary without picking up configs above it', async () => {
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configSource(44));
      const repo = join(dir, 'repo');
      const sub = join(repo, 'sub');
      await mkdir(sub, { recursive: true });
      await mkdir(join(repo, '.git'));

      const config = await loadConfig(sub);
      // Strict fallback: the config above the repo root must not apply.
      assert.equal(config.rules['subject-max-length'], undefined);
      assert.equal(config.rules['type-enum']!.severity, 'error');
    });

    it('stops at a .git file boundary (worktree/submodule)', async () => {
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configSource(45));
      const repo = join(dir, 'repo');
      const sub = join(repo, 'sub');
      await mkdir(sub, { recursive: true });
      await writeFile(join(repo, '.git'), 'gitdir: /elsewhere\n');

      const config = await loadConfig(sub);
      assert.equal(config.rules['subject-max-length'], undefined);
    });

    it('finds a config sitting next to .git (boundary is inclusive)', async () => {
      const repo = join(dir, 'repo');
      const sub = join(repo, 'sub');
      await mkdir(sub, { recursive: true });
      await mkdir(join(repo, '.git'));
      await writeFile(join(repo, 'commit-sentinel.config.ts'), configSource(46));

      const config = await loadConfig(sub);
      assert.deepEqual(config.rules['subject-max-length']!.options, { max: 46 });
    });

    it('explicit configPath bypasses the walk', async () => {
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configSource(47));
      const child = join(dir, 'child');
      await mkdir(child);
      await writeFile(join(child, 'custom.config.ts'), configSource(48));

      const config = await loadConfig(child, 'custom.config.ts');
      assert.deepEqual(config.rules['subject-max-length']!.options, { max: 48 });
    });

    it('missing explicit configPath still throws even when an ancestor has a config', async () => {
      await writeFile(join(dir, 'commit-sentinel.config.ts'), configSource(49));
      const child = join(dir, 'child');
      await mkdir(child);

      await assert.rejects(
        () => loadConfig(child, 'missing.config.ts'),
        /Config file not found/,
      );
    });
  });
});
