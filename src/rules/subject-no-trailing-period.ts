import { defineRule } from './define-rule.ts';

/** Sentence-ending punctuation: `.`, `…` (ellipsis), `．` (fullwidth), `。` (ideographic). */
const TRAILING_STOP_RE = /[.．。…]$/;

export const subjectNoTrailingPeriodRule = defineRule({
  meta: {
    name: 'subject-no-trailing-period',
    description: 'Subject must not end with a period',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validate({ commit }) {
    if (commit.subject === null || !TRAILING_STOP_RE.test(commit.subject)) return [];
    return [
      {
        message: 'Subject must not end with a period.',
        suggestion: 'Remove the trailing period from the subject.',
      },
    ];
  },
});
