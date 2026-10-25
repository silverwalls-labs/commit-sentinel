import { defineRule } from './define-rule.ts';
import { validatePositiveInteger } from './option-validators.ts';

interface MaxCommitsOptions {
  max?: number;
}

const DEFAULT_MAX = 10;

/**
 * Range-scoped rule: the validated range must not contain more than `max`
 * commits (default 10). Only evaluated in range mode (`--range` / `--base`);
 * single-message modes skip it silently via the no-op `validate()`.
 *
 * Merge commits never count toward the limit by design: ranges are
 * enumerated with `git rev-list --no-merges` (see `listCommitsInRange`).
 */
export const maxCommitsRule = defineRule<MaxCommitsOptions>({
  meta: {
    name: 'max-commits',
    description: 'Range must not contain more than the maximum number of commits',
    category: 'git',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validateOptions(options) {
    return validatePositiveInteger('max', options.max);
  },
  // Range-scoped: per-commit validation never reports anything.
  validate() {
    return [];
  },
  checkRange({ range, commitCount, options }) {
    const max = options.max ?? DEFAULT_MAX;
    if (commitCount <= max) return [];
    return [
      {
        message: `Range ${range} contains ${commitCount} commits, exceeds maximum of ${max}.`,
        suggestion: `Squash or split the branch so the range has at most ${max} commits (merge commits are not counted).`,
      },
    ];
  },
});
