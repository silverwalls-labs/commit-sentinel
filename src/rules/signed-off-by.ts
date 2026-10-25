import { defineRule } from './define-rule.ts';

const SIGN_OFF_RE = /^[^<>\r\n]+ <[^\s<>]+@[^\s<>]+>$/;

export const signedOffByRule = defineRule({
  meta: {
    name: 'signed-off-by',
    description: 'Commit must contain a valid Signed-off-by footer (DCO)',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validate({ commit }) {
    // Git's DCO machinery only recognizes the colon form; `Signed-off-by #…`
    // parses as a footer but is not a sign-off.
    const signOffs = commit.footers.filter(
      (f) => f.separator === ': ' && f.token.toLowerCase() === 'signed-off-by',
    );
    if (signOffs.length === 0) {
      return [
        {
          message: 'Commit must contain a Signed-off-by footer.',
          suggestion: 'Add it with git commit --signoff (or -s).',
        },
      ];
    }

    const problems: { message: string; suggestion?: string }[] = [];
    for (const footer of signOffs) {
      if (!SIGN_OFF_RE.test(footer.value.trim())) {
        problems.push({
          message: 'Signed-off-by footer must have the form "Name <email>".',
          suggestion: 'Example: Signed-off-by: Ada Lovelace <ada@example.com>',
        });
      }
    }
    return problems;
  },
});
