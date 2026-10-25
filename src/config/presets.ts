import type { RuleConfig } from '../rules/types.ts';

/** A preset is a named collection of default rule configurations. */
export type Preset = Record<string, RuleConfig>;

/** Minimal preset: only `feat`, `fix`, `chore`, and `revert` types allowed. */
export const strict: Preset = {
  'format': 'error',
  'type-enum': ['error', { allowed: ['feat', 'fix', 'chore', 'revert'] }],
  'header-max-length': ['warn', { max: 100 }],
  'subject-min-length': ['error', { min: 1 }],
  'max-commits': ['error', { max: 10 }],
};

/** Conventional Commits preset: all standard types, sensible defaults. */
export const conventional: Preset = {
  'format': 'error',
  'type-enum': [
    'error',
    {
      allowed: [
        'feat', 'fix', 'build', 'ci', 'docs',
        'perf', 'refactor', 'style', 'test', 'chore', 'revert',
      ],
    },
  ],
  'header-max-length': ['warn', { max: 100 }],
  'subject-min-length': ['error', { min: 1 }],
  'subject-case': ['warn', { case: 'lower' }],
  'subject-no-trailing-period': 'error',
  'max-commits': ['error', { max: 10 }],
};

/** Angular commit guidelines preset: stricter casing and 100-char limit on every line. */
export const angular: Preset = {
  'format': 'error',
  'type-enum': [
    'error',
    {
      allowed: ['build', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'test'],
    },
  ],
  'header-max-length': ['error', { max: 100 }],
  'subject-min-length': ['error', { min: 1 }],
  'subject-case': ['error', { case: 'lower' }],
  'subject-no-trailing-period': 'error',
  'body-max-line-length': ['error', { max: 100 }],
  'footer-max-line-length': ['error', { max: 100 }],
  'max-commits': ['error', { max: 10 }],
};

/**
 * Hardened preset: every built-in rule enabled at `error` severity.
 *
 * Rules whose defaults are pass-through stay configurable: `scope-enum`
 * allows any scope and `author-email` matches any email until their
 * options are overridden.
 */
export const hardened: Preset = {
  'format': 'error',
  'type-enum': [
    'error',
    {
      allowed: [
        'feat', 'fix', 'build', 'ci', 'docs',
        'perf', 'refactor', 'style', 'test', 'chore', 'revert',
      ],
    },
  ],
  'scope-enum': 'error',
  'scope-required': 'error',
  'subject-max-length': ['error', { max: 72 }],
  'subject-min-length': ['error', { min: 1 }],
  'subject-case': ['error', { case: 'lower' }],
  'subject-no-trailing-period': 'error',
  'header-max-length': ['error', { max: 100 }],
  'body-required': 'error',
  'body-min-length': ['error', { min: 20 }],
  'body-max-line-length': ['error', { max: 100 }],
  'footer-leading-blank': 'error',
  'footer-max-line-length': ['error', { max: 100 }],
  'breaking-change': ['error', { requireFooter: true }],
  'references-required': 'error',
  'author-email': 'error',
  'signed': 'error',
  'signed-off-by': 'error',
  'agent-attribution': 'error',
  'max-commits': ['error', { max: 5 }],
};

const presets: Record<string, Preset> = { strict, conventional, angular, hardened };

/**
 * Look up a built-in preset by name.
 *
 * @param name - One of `"strict"`, `"conventional"`, `"angular"`, or `"hardened"`.
 * @returns The preset's rule configuration map.
 * @throws When the name does not match any built-in preset.
 */
export function getPreset(name: string): Preset {
  if (!Object.hasOwn(presets, name)) {
    throw new Error(
      `Unknown preset "${name}". Available presets: ${Object.keys(presets).join(', ')}.`,
    );
  }
  return presets[name]!;
}
