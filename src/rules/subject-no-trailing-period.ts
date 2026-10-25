import { defineRule } from './define-rule.ts';

export const subjectNoTrailingPeriodRule = defineRule({
  meta: {
    name: 'subject-no-trailing-period',
    description: 'Subject must not end with a period',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validate({ commit }) {
    if (commit.subject === null || !commit.subject.endsWith('.')) return [];
    return [
      {
        message: 'Subject must not end with a period.',
        suggestion: 'Remove the trailing period from the subject.',
      },
    ];
  },
});
