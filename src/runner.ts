import type { ParsedCommit } from './parser.ts';
import { parseCommit } from './parser.ts';
import type { GitMeta } from './git.ts';
import type { ActiveSeverity, RangeCommit, RuleProblem } from './rules/types.ts';
import type { ResolvedConfig } from './config/loader.ts';
import { builtinRules } from './rules/registry.ts';
import { defaultIgnores, findIgnoreMatch } from './ignores.ts';

/** The outcome of a single rule evaluation against a commit. */
export interface RuleResult {
  /** The rule's unique name. */
  ruleName: string;
  /** The severity this rule was configured with. */
  severity: ActiveSeverity;
  /** Problems found by the rule (non-empty). */
  problems: RuleProblem[];
}

/**
 * Full validation report for a single commit message.
 *
 * {@link valid} is `true` when there are zero errors (warnings are allowed).
 */
export interface ValidationReport {
  /** `true` when {@link errorCount} is zero. */
  valid: boolean;
  /** The parsed commit that was validated. */
  commit: ParsedCommit;
  /** Per-rule results — only rules that found problems appear here. */
  results: RuleResult[];
  /** Total number of error-severity problems across all rules. */
  errorCount: number;
  /** Total number of warning-severity problems across all rules. */
  warningCount: number;
  /** Names of rules that were skipped because {@link GitMeta} was unavailable. */
  skippedGitRules: string[];
  /** Git commit SHA, set when validating a range so formatters can identify the commit. */
  sha?: string;
  /** Git revision range, set on the synthetic range-level report built by {@link validateRangeRules}. */
  range?: string;
  /**
   * Report discriminator: `'range'` on synthetic range-level reports built by
   * {@link validateRangeRules}; per-commit reports omit it. Lets JSON/SARIF
   * consumers tell range findings apart from per-commit ones without relying
   * on an empty `commit.header`.
   */
  kind?: 'range';
  /**
   * `true` when the message matched an ignore pattern and every rule was
   * skipped. Absent on reports that went through the rules.
   */
  ignored?: boolean;
  /**
   * Name of the ignore pattern that matched (e.g. `'revert'`, `'merge'`,
   * `'fixup'`, or a custom predicate's function name). Set with {@link ignored}.
   */
  ignoredBy?: string;
}

/**
 * Validate a commit message against a resolved configuration.
 *
 * Pipeline: parse → iterate enabled rules → collect problems → build report.
 *
 * Rules are looked up in {@link ResolvedConfig.ruleRegistry} (built-ins plus
 * any config `plugins`), falling back to the built-in rules when the config
 * carries no registry.
 *
 * Messages matching an ignore pattern ({@link ResolvedConfig.ignores}, falling
 * back to the built-in {@link defaultIgnores}) short-circuit to a valid report
 * with {@link ValidationReport.ignored} set — no rule runs at all.
 *
 * Rules with `requiresGit: true` are silently skipped (and listed in
 * {@link ValidationReport.skippedGitRules}) when `git` is `null`.
 *
 * @param message - The raw commit message string.
 * @param config - A resolved config (from `loadConfig()`).
 * @param git - Git metadata for the commit, or `null`/`undefined` for message-only validation.
 * @returns A {@link ValidationReport} with all problems and counts.
 */
export function validate(
  message: string,
  config: ResolvedConfig,
  git?: GitMeta | null,
): ValidationReport {
  const commit = parseCommit(message);

  const ignores = config.ignores ?? defaultIgnores;
  const ignoredBy = findIgnoreMatch(message, ignores);
  if (ignoredBy !== null) {
    return {
      valid: true,
      commit,
      results: [],
      errorCount: 0,
      warningCount: 0,
      skippedGitRules: [],
      ignored: true,
      ignoredBy,
    };
  }

  const registry = config.ruleRegistry ?? builtinRules;
  const results: RuleResult[] = [];
  const skippedGitRules: string[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const [ruleName, entry] of Object.entries(config.rules)) {
    const rule = registry.get(ruleName);
    if (!rule) continue;

    if (rule.meta.requiresGit && (git === null || git === undefined)) {
      skippedGitRules.push(ruleName);
      continue;
    }

    const problems = rule.validate({
      commit,
      git: git ?? null,
      options: entry.options,
    });

    if (problems.length > 0) {
      results.push({ ruleName, severity: entry.severity, problems });
      if (entry.severity === 'error') {
        errorCount += problems.length;
      } else {
        warningCount += problems.length;
      }
    }
  }

  return {
    valid: errorCount === 0,
    commit,
    results,
    errorCount,
    warningCount,
    skippedGitRules,
  };
}

/**
 * Run all range-scoped rules (those with a `checkRange` method) against a
 * commit range.
 *
 * Invoked once per range — after every commit in the range has been validated
 * individually — with the commits the range contains (oldest first).
 *
 * @param range - The git revision range being validated (e.g. `"main..HEAD"`).
 * @param commits - The non-merge commits in the range, oldest first.
 * @param config - A resolved config (from `loadConfig()`).
 * @returns A synthetic {@link ValidationReport} carrying {@link ValidationReport.range}
 * and {@link ValidationReport.kind} (and no `sha`), or `null` when no range-scoped
 * rule found problems. Runs on empty ranges too — a rule may report on
 * zero commits.
 */
export function validateRangeRules(
  range: string,
  commits: readonly RangeCommit[],
  config: ResolvedConfig,
): ValidationReport | null {
  const registry = config.ruleRegistry ?? builtinRules;
  const results: RuleResult[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const [ruleName, entry] of Object.entries(config.rules)) {
    const rule = registry.get(ruleName);
    if (!rule?.checkRange) continue;

    const problems = rule.checkRange({
      range,
      commits,
      commitCount: commits.length,
      options: entry.options,
    });
    if (problems.length === 0) continue;

    results.push({ ruleName, severity: entry.severity, problems });
    if (entry.severity === 'error') {
      errorCount += problems.length;
    } else {
      warningCount += problems.length;
    }
  }

  if (results.length === 0) return null;

  return {
    valid: errorCount === 0,
    // Synthetic report: range problems are not tied to any single commit.
    commit: parseCommit(''),
    results,
    errorCount,
    warningCount,
    skippedGitRules: [],
    range,
    kind: 'range',
  };
}
