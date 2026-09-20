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

Also exported: `defineConfig` and `defineRule` for custom configs and rules — see [plugins.md](./plugins.md) for the custom-rule guide — as well as `getPreset`, `builtinRules`, and the `human`, `json`, and `sarif` formatters.
