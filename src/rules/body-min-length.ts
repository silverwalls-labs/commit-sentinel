import { defineRule } from './define-rule.ts';

interface BodyMinLengthOptions {
  min?: number;
}

export const bodyMinLengthRule = defineRule<BodyMinLengthOptions>({
  meta: {
    name: 'body-min-length',
    description: 'Body must meet the minimum length',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'warn',
  },
  validateOptions(options) {
    if (options.min === undefined) return [];
    if (typeof options.min !== 'number' || !Number.isInteger(options.min) || options.min < 0) {
      return [{ message: `"min" must be a non-negative integer, got: ${JSON.stringify(options.min)}.` }];
    }
    return [];
  },
  validate({ commit, options }) {
    if (commit.body === null) return [];
    const min = options.min ?? 20;
    if (commit.body.length >= min) return [];
    return [
      {
        message: `Body is ${commit.body.length} characters, must be at least ${min}.`,
        suggestion: 'Expand the body to explain what changed and why.',
      },
    ];
  },
});
