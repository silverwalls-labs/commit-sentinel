# Programmatic API

```typescript
import {
  parseCommit,
  validate,
  loadConfig,
  defineConfig,
  defineRule,
} from '@silverwalls-labs/commit-sentinel';

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

// Create a custom rule
const noWipRule = defineRule({
  meta: {
    name: 'no-wip',
    description: 'Subject must not start with WIP',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validate({ commit }) {
    if (commit.subject?.toUpperCase().startsWith('WIP')) {
      return [{ message: 'WIP commits are not allowed.', suggestion: 'Remove the WIP prefix.' }];
    }
    return [];
  },
});

// Register it via the `plugins` field of commit-sentinel.config.ts —
// loadConfig() merges it into the rule registry and validate() runs it
export default defineConfig({
  extends: 'strict',
  plugins: [noWipRule],
});
```

See [plugins.md](./plugins.md) for the full custom-rule guide.
