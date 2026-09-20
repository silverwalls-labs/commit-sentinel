#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { run } from './src/cli.ts';

export {
  parseCommit,
  defineConfig,
  defineRule,
  loadConfig,
  getPreset,
  validate,
  builtinRules,
  getRule,
  humanFormatter,
  jsonFormatter,
  sarifFormatter,
} from './src/index.ts';

export type {
  ParsedCommit,
  Footer,
  GitMeta,
  Rule,
  RuleMeta,
  RuleContext,
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
} from './src/types.ts';

// Both paths must be canonicalized: npm bin shims are symlinks, Node realpaths the main module.
const invokedAs = process.argv[1];
let isMain = false;
if (invokedAs !== undefined) {
  try {
    isMain = realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invokedAs);
  } catch {
    // argv[1] may not exist on disk; not a CLI invocation.
  }
}
if (isMain) {
  const result = await run(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}
