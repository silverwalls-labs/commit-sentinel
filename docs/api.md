# Programmatic API

```typescript
import { parseCommit, validate, loadConfig } from '@silverwalls-labs/commit-sentinel';

// Parse a commit message
const commit = parseCommit('feat(api)!: drop v1\n\nBREAKING CHANGE: removed /v1');
console.log(commit.type);              // 'feat'
console.log(commit.scope);             // 'api'
console.log(commit.breaking);          // true  (! marker)
console.log(commit.hasBreakingChange); // true  (marker OR footer)

// Validate against a config
const config = await loadConfig();
const report = validate('feat: add login', config);

if (!report.valid) {
  for (const result of report.results) {
    for (const problem of result.problems) {
      console.error(`[${result.ruleName}] ${problem.message}`);
    }
  }
}
```

For ranges, `readCommitsInRange(range)` reads every non-merge commit (sha, raw message, git metadata) in a single `git log` spawn, and `validateRangeRules(range, commits, config)` runs the range-scoped rules (those defining `checkRange`, e.g. `max-commits`) against `RangeCommit` objects (`{ sha, commit, git }`) and returns a synthetic `ValidationReport` carrying `range` and `kind: "range"` instead of a `sha` — or `null` when nothing fired. It runs on empty ranges too, so a rule can report on zero commits. Combine it with `validate` to reproduce the CLI's `--range` mode:

```typescript
import {
  loadConfig, readCommitsInRange, validate, validateRangeRules,
} from '@silverwalls-labs/commit-sentinel';

const config = await loadConfig();
const commits = await readCommitsInRange('main..HEAD');

const reports = [];
const rangeCommits = [];
for (const { sha, message, meta } of commits) {
  const report = validate(message, config, meta);
  report.sha = sha;
  reports.push(report);
  rangeCommits.push({ sha, commit: report.commit, git: meta });
}
const rangeReport = validateRangeRules('main..HEAD', rangeCommits, config);
if (rangeReport) reports.push(rangeReport);
```

The per-sha readers (`listCommitsInRange`, `readCommitMessage`, `readGitMetaOrNull`) remain exported for single-commit workflows.

## Ignored commits

Before any rule runs, `validate()` tests the message against the config's ignore list — git-generated messages (merge, revert/reapply, `fixup!`/`squash!`/`amend!`) short-circuit to a valid report carrying `ignored: true` and `ignoredBy: '<pattern name>'` (both fields are absent on reports that went through the rules):

```typescript
const report = validate('Revert "feat: add login"', config);
console.log(report.valid);     // true
console.log(report.ignored);   // true
console.log(report.ignoredBy); // 'revert'
console.log(report.results);   // []
```

`ResolvedConfig.ignores` carries the resolved list (`loadConfig()` builds it from the config's `defaultIgnores`/`ignores` fields — see [configuration.md](./configuration.md#ignoring-auto-generated-commits)). When the key is absent — e.g. on a hand-built config — `validate()` falls back to the built-in `defaultIgnores` (exported, a `ReadonlyArray<ResolvedIgnore>` of `{ name, test }` entries); pass `ignores: []` to disable ignoring entirely.

`cleanCommitMessage(message)` is also exported: it cleans a raw editor message the way the CLI does for `--file`/`--stdin` — truncating at the scissors line when one is present (keeping the text above verbatim, like git's `cleanup=scissors`), otherwise stripping column-0 `#` comment lines.

Also exported: `defineConfig` and `defineRule` for custom configs and rules — see [plugins.md](./plugins.md) for the custom-rule guide — as well as `getPreset`, `builtinRules`, the `IgnorePredicate`/`ResolvedIgnore` types, and the `human`, `json`, and `sarif` formatters.
