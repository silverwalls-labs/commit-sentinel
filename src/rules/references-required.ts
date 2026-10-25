import { defineRule } from './define-rule.ts';

interface ReferencesRequiredOptions {
  pattern?: string;
}

/** GitHub-style issue reference: `#42`, `(#42)` — but not `abc#42` or `#42abc`. */
const DEFAULT_PATTERN = String.raw`(?<![\w#])#\d+\b`;

export const referencesRequiredRule = defineRule<ReferencesRequiredOptions>({
  meta: {
    name: 'references-required',
    description: 'Commit must reference an issue in the header or a footer',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validateOptions(options) {
    if (options.pattern !== undefined && typeof options.pattern !== 'string') {
      return [
        {
          message: `Invalid references-required pattern: "${String(options.pattern)}". "pattern" must be a string.`,
          suggestion: 'Check the regex syntax in your config.',
        },
      ];
    }
    const pattern = options.pattern ?? DEFAULT_PATTERN;
    try {
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      new RegExp(pattern);
      return [];
    } catch {
      return [
        {
          message: `Invalid references-required pattern: "${pattern}".`,
          suggestion: 'Check the regex syntax in your config.',
        },
      ];
    }
  },
  validate({ commit, options }) {
    const pattern = options.pattern ?? DEFAULT_PATTERN;
    let re: RegExp;
    try {
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      re = new RegExp(pattern);
    } catch {
      return [
        {
          message: `Invalid references-required pattern: "${pattern}".`,
          suggestion: 'Check the regex syntax in your config.',
        },
      ];
    }

    if (re.test(commit.header)) return [];

    // Reconstruct each footer line as written — `Fixes #42` parses to
    // {token: 'Fixes', separator: ' #', value: '42'}.
    for (const footer of commit.footers) {
      if (re.test(`${footer.token}${footer.separator}${footer.value}`)) {
        return [];
      }
    }

    return [
      {
        message: `Commit must reference an issue matching /${pattern}/ in the header or a footer.`,
        suggestion: 'Add an issue reference, e.g. "Refs #123" or a "(#123)" suffix in the header.',
      },
    ];
  },
});
