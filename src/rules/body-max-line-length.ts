import { defineRule } from './define-rule.ts';
import { validatePositiveInteger } from './option-validators.ts';
import { lineExceedsMax } from './line-length.ts';

interface BodyMaxLineLengthOptions {
  max?: number;
}

export const bodyMaxLineLengthRule = defineRule<BodyMaxLineLengthOptions>({
  meta: {
    name: 'body-max-line-length',
    description: 'Body lines must not exceed the maximum length',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'warn',
  },
  validateOptions(options) {
    return validatePositiveInteger('max', options.max);
  },
  validate({ commit, options }) {
    if (commit.body === null) return [];
    const max = options.max ?? 100;
    const violations: string[] = [];

    for (const line of commit.body.split('\n')) {
      if (lineExceedsMax(line, max)) {
        violations.push(line.slice(0, 30) + (line.length > 30 ? '...' : ''));
      }
    }

    if (violations.length === 0) return [];
    return [
      {
        message: `${violations.length} body line(s) exceed the maximum of ${max} characters.`,
        suggestion: `Wrap body lines to ${max} characters or fewer.`,
      },
    ];
  },
});
