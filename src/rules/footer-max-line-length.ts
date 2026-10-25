import { defineRule } from './define-rule.ts';
import { validatePositiveInteger } from './option-validators.ts';
import { lineExceedsMax } from './line-length.ts';

interface FooterMaxLineLengthOptions {
  max?: number;
}

export const footerMaxLineLengthRule = defineRule<FooterMaxLineLengthOptions>({
  meta: {
    name: 'footer-max-line-length',
    description: 'Footer lines must not exceed the maximum length',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'warn',
  },
  validateOptions(options) {
    return validatePositiveInteger('max', options.max);
  },
  validate({ commit, options }) {
    const max = options.max ?? 100;
    let violations = 0;

    for (const footer of commit.footers) {
      // Reconstruct the physical first line exactly as written.
      const [first, ...rest] = footer.value.split('\n');
      if (lineExceedsMax(`${footer.token}${footer.separator}${first!}`, max)) violations++;
      for (const line of rest) {
        if (lineExceedsMax(line, max)) violations++;
      }
    }

    if (violations === 0) return [];
    return [
      {
        message: `${violations} footer line(s) exceed the maximum of ${max} characters.`,
        suggestion: `Wrap footer lines to ${max} characters or fewer.`,
      },
    ];
  },
});
