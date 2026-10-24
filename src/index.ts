// Parser
export { parseCommit } from './parser.ts';

// Cleanup — strip editor comments / scissors sections from raw messages
export { cleanCommitMessage } from './cleanup.ts';

// Ignores — built-in patterns for git-generated commit messages
export { defaultIgnores } from './ignores.ts';

// Config
export { defineConfig } from './config/define-config.ts';
export { loadConfig } from './config/loader.ts';
export { getPreset } from './config/presets.ts';

// Rules
export { defineRule } from './rules/define-rule.ts';
export { builtinRules, getRule } from './rules/registry.ts';

// Runner
export { validate, validateRangeRules } from './runner.ts';

// Git — enumerate ranges and read per-commit inputs (for range validation)
export { listCommitsInRange, readCommitMessage, readGitMetaOrNull, readCommitsInRange } from './git.ts';

// Formatters
export { humanFormatter } from './formatters/human.ts';
export { jsonFormatter } from './formatters/json.ts';
export { sarifFormatter } from './formatters/sarif.ts';

// Types
export type {
  ParsedCommit,
  Footer,
  GitMeta,
  CommitRecord,
  IgnorePredicate,
  ResolvedIgnore,
  Rule,
  RuleMeta,
  RuleContext,
  RangeRuleContext,
  RangeCommit,
  RuleProblem,
  RuleConfig,
  RuleCategory,
  Severity,
  ActiveSeverity,
  UserConfig,
  Preset,
  ResolvedConfig,
  ResolvedRuleEntry,
  ValidationReport,
  RuleResult,
  Formatter,
  FormatOptions,
} from './types.ts';
