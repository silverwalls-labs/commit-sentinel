import type { Rule } from './types.ts';
import { formatRule } from './format.ts';
import { typeEnumRule } from './type-enum.ts';
import { scopeEnumRule } from './scope-enum.ts';
import { scopeRequiredRule } from './scope-required.ts';
import { subjectMaxLengthRule } from './subject-max-length.ts';
import { subjectMinLengthRule } from './subject-min-length.ts';
import { subjectCaseRule } from './subject-case.ts';
import { subjectNoTrailingPeriodRule } from './subject-no-trailing-period.ts';
import { headerMaxLengthRule } from './header-max-length.ts';
import { bodyRequiredRule } from './body-required.ts';
import { bodyMinLengthRule } from './body-min-length.ts';
import { bodyMaxLineLengthRule } from './body-max-line-length.ts';
import { footerLeadingBlankRule } from './footer-leading-blank.ts';
import { footerMaxLineLengthRule } from './footer-max-line-length.ts';
import { breakingChangeRule } from './breaking-change.ts';
import { referencesRequiredRule } from './references-required.ts';
import { authorEmailRule } from './author-email.ts';
import { signedRule } from './signed.ts';
import { signedOffByRule } from './signed-off-by.ts';
import { agentAttributionRule } from './agent-attribution.ts';
import { maxCommitsRule } from './max-commits.ts';

/** All 21 built-in rules, keyed by name. */
export const builtinRules: ReadonlyMap<string, Rule> = new Map<string, Rule>([
  ['format', formatRule],
  ['type-enum', typeEnumRule],
  ['scope-enum', scopeEnumRule],
  ['scope-required', scopeRequiredRule],
  ['subject-max-length', subjectMaxLengthRule],
  ['subject-min-length', subjectMinLengthRule],
  ['subject-case', subjectCaseRule],
  ['subject-no-trailing-period', subjectNoTrailingPeriodRule],
  ['header-max-length', headerMaxLengthRule],
  ['body-required', bodyRequiredRule],
  ['body-min-length', bodyMinLengthRule],
  ['body-max-line-length', bodyMaxLineLengthRule],
  ['footer-leading-blank', footerLeadingBlankRule],
  ['footer-max-line-length', footerMaxLineLengthRule],
  ['breaking-change', breakingChangeRule],
  ['references-required', referencesRequiredRule],
  ['author-email', authorEmailRule],
  ['signed', signedRule],
  ['signed-off-by', signedOffByRule],
  ['agent-attribution', agentAttributionRule],
  ['max-commits', maxCommitsRule],
]);

/**
 * Look up a built-in rule by name.
 *
 * @param name - The rule identifier (e.g. `"type-enum"`).
 * @returns The rule, or `undefined` if no built-in rule has that name.
 */
export function getRule(name: string): Rule | undefined {
  return builtinRules.get(name);
}
