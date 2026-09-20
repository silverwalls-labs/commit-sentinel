import type { Rule, RuleConfig } from '../rules/types.ts';

/**
 * User-facing configuration for commit-sentinel.
 *
 * Loaded from `commit-sentinel.config.ts` in the project root.
 *
 * @example
 * ```ts
 * // commit-sentinel.config.ts
 * import { defineConfig, defineRule } from '@silverwalls-labs/commit-sentinel';
 *
 * const noWipRule = defineRule({
 *   meta: {
 *     name: 'no-wip',
 *     description: 'Subject must not start with WIP',
 *     category: 'content',
 *     requiresGit: false,
 *     defaultSeverity: 'error',
 *   },
 *   validate({ commit }) {
 *     if (commit.subject?.toUpperCase().startsWith('WIP')) {
 *       return [{ message: 'WIP commits are not allowed.' }];
 *     }
 *     return [];
 *   },
 * });
 *
 * export default defineConfig({
 *   extends: 'conventional',
 *   plugins: [noWipRule],
 *   rules: {
 *     'subject-max-length': ['warn', { max: 72 }],
 *     'signed': 'off',
 *   },
 * });
 * ```
 */
export interface UserConfig {
  /** Name of a built-in preset to extend (`"strict"`, `"conventional"`, `"angular"`, or `"hardened"`). */
  extends?: string;
  /** Per-rule overrides applied on top of the preset. */
  rules?: Record<string, RuleConfig>;
  /**
   * Custom rules created with `defineRule()`.
   *
   * Each plugin rule is enabled automatically at its `meta.defaultSeverity`.
   * Add an entry under {@link rules} (keyed by the rule's `meta.name`) to
   * override its severity/options or turn it `'off'`. Plugin names must not
   * collide with built-in rules or with each other.
   */
  plugins?: Rule[];
}

/**
 * Identity helper that provides type-safe autocompletion for config files.
 *
 * @param config - The user configuration object.
 * @returns The same config, unchanged.
 */
export function defineConfig(config: UserConfig): UserConfig {
  return config;
}
