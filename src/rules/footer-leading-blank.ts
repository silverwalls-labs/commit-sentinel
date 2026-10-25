import { defineRule } from './define-rule.ts';
import { isStringArray } from './option-validators.ts';
import { FOOTER_LINE_RE } from '../parser.ts';

interface FooterLeadingBlankOptions {
  extraTokens?: string[];
}

/** Standard git trailer tokens (lowercased) recognized when glued to the body. */
const KNOWN_TRAILER_TOKENS: ReadonlySet<string> = new Set([
  'signed-off-by',
  'co-authored-by',
  'co-developed-by',
  'reviewed-by',
  'acked-by',
  'tested-by',
  'reported-by',
  'suggested-by',
  'link',
  'cc',
  'refs',
  'fixes',
  'closes',
  'resolves',
  'breaking change',
  'breaking-change',
]);

function isTrailerLike(line: string, extraTokens: ReadonlySet<string>): boolean {
  const match = FOOTER_LINE_RE.exec(line);
  if (!match?.groups) return false;
  const token = match.groups.token!;
  if (KNOWN_TRAILER_TOKENS.has(token.toLowerCase()) || extraTokens.has(token.toLowerCase())) {
    return true;
  }
  // The `Token #value` form counts regardless of the token, but only for a
  // bare reference value — prose like `Bug #123 was the root cause` is body.
  return match.groups.sep === ' #' && /^\d+$/.test(match.groups.value!);
}

export const footerLeadingBlankRule = defineRule<FooterLeadingBlankOptions>({
  meta: {
    name: 'footer-leading-blank',
    description: 'Footers must be separated from the header or body by a blank line',
    category: 'format',
    requiresGit: false,
    defaultSeverity: 'warn',
  },
  validateOptions(options) {
    if (options.extraTokens === undefined || isStringArray(options.extraTokens)) return [];
    return [
      {
        message: '"extraTokens" must be an array of trailer token strings.',
        suggestion: 'Check the footer-leading-blank extraTokens option in your config.',
      },
    ];
  },
  validate({ commit, options }) {
    if (commit.body === null) {
      if (commit.footers.length === 0) return [];
      // Footers directly after the header: line 2 must be blank. It always
      // exists for parser-built commits (footers require a content line);
      // hand-built commits may lack it, in which case there is nothing to check.
      const secondLine = commit.raw.split(/\r?\n/)[1];
      if (secondLine !== undefined && secondLine.trim() !== '') {
        return [
          {
            message: 'Footers must be separated from the header by a blank line.',
            suggestion: 'Insert a blank line between the header and the footer block.',
          },
        ];
      }
      return [];
    }

    // Trailer-like lines glued to the end of the body were absorbed by the
    // parser (footers require a preceding blank line). Scan backward; for
    // parser-built commits any paragraph-initial body line matching the footer
    // shape would have been extracted as a footer, but hand-built commits may
    // have an all-trailer body, so the scan is bounded explicitly.
    const extraTokens = new Set((options.extraTokens ?? []).map((t) => t.toLowerCase()));
    const lines = commit.body.split('\n');
    let count = 0;
    for (let i = lines.length - 1; i >= 0 && isTrailerLike(lines[i]!, extraTokens); i--) {
      count++;
    }

    if (count === 0) return [];
    return [
      {
        message: `${count} trailer-like line(s) at the end of the body are not separated by a blank line.`,
        suggestion: 'Insert a blank line before the footer block.',
      },
    ];
  },
});
