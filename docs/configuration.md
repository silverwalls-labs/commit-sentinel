# Configuration

Create a `commit-sentinel.config.ts` file in your project root:

```typescript
import { defineConfig } from '@silverwalls-labs/commit-sentinel';

export default defineConfig({
  extends: 'conventional',
  rules: {
    'subject-max-length': ['warn', { max: 72 }],
    'author-email': ['error', { pattern: '^.+@company\\.com$' }],
    'signed': 'off',
  },
});
```

## How config resolution works

1. Looks for `commit-sentinel.config.ts` in the current working directory
2. If found, loads it via native `import()` and reads the default export
3. Merges custom `plugins` rules into the rule registry
4. Resolves the `extends` preset, then applies user `rules` on top
5. If no config file is found, falls back to the `strict` preset

> **Note:** The config file is looked up in the current working directory only. Monorepo directory-tree walking is planned for a future release.

> **Note:** Node.js caches ESM `import()` by URL. If you change the config file, restart the process to pick up the new values.

## Severity levels

Each rule can be set to one of three levels:

| Level | Effect |
|-------|--------|
| `'error'` | Fails validation (exit code 2) |
| `'warn'` | Prints a warning but passes (exit code 0) |
| `'off'` | Rule is disabled entirely |

Rules can be configured as a bare severity (`'error'`) or as a tuple with options (`['warn', { max: 72 }]`).

## Custom rules

Your own rules — written with `defineRule()` and registered through the config's `plugins` field — run alongside the built-ins. A plugin rule is enabled automatically at its `meta.defaultSeverity` and can be tuned or disabled through the `rules` field like any built-in. Name collisions and unknown rule names fail at config load (exit code 1).

See [plugins.md](./plugins.md) for the full guide: API reference, typed options, option validation, git-metadata rules, recipes, testing, and distribution.

