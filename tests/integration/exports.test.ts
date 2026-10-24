import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import * as rootEntry from '../../index.ts';
import * as srcEntry from '../../src/index.ts';

/**
 * The package entry point is the root index.ts barrel (package.json "exports"
 * → dist/index.js). It must re-export every runtime export of src/index.ts —
 * adding an export there without the barrel silently hides it from consumers.
 */
describe('package entry surface', () => {
  it('re-exports every runtime export of src/index.ts', () => {
    assert.deepEqual(
      Object.keys(rootEntry).sort(),
      Object.keys(srcEntry).sort(),
    );
  });

  it('exports the documented runtime API', () => {
    const functions = [
      'parseCommit',
      'cleanCommitMessage',
      'defineConfig',
      'defineRule',
      'loadConfig',
      'getPreset',
      'listCommitsInRange',
      'readCommitMessage',
      'readGitMetaOrNull',
      'readCommitsInRange',
      'validate',
      'validateRangeRules',
      'getRule',
    ];
    for (const name of functions) {
      const value = (srcEntry as Record<string, unknown>)[name];
      assert.equal(typeof value, 'function', `${name} must be exported as a function`);
    }
    assert.ok(srcEntry.builtinRules instanceof Map, 'builtinRules must be exported as a Map');
    assert.ok(Array.isArray(srcEntry.defaultIgnores), 'defaultIgnores must be exported as an array');
    for (const name of ['humanFormatter', 'jsonFormatter', 'sarifFormatter']) {
      const formatter = (srcEntry as Record<string, { format?: unknown }>)[name];
      assert.equal(typeof formatter.format, 'function', `${name} must export a format() function`);
    }
  });
});
