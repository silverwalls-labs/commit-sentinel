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

Create rules with `defineRule()` and register them through the `plugins` field:

```typescript
import { defineConfig, defineRule } from '@silverwalls-labs/commit-sentinel';

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

export default defineConfig({
  extends: 'conventional',
  plugins: [noWipRule],
});
```

A plugin rule is **enabled automatically** at its `meta.defaultSeverity`; an entry under `rules` (keyed by the rule's `meta.name`) overrides its severity/options or turns it `'off'`. Name collisions and unknown rule names fail at config load (exit code 1).

A rule may also define `validateOptions()` to reject bad rule options at config load (exit code 1). Plugin rules are auto-enabled with empty options `{}`, so `validateOptions` must treat an all-fields-absent object as valid — a rule whose `validateOptions` rejects `{}` cannot be loaded at all. See [plugins.md](./plugins.md) for details.

**Full guide — API reference, typed options, git-metadata rules, recipes, testing, distribution: [plugins.md](./plugins.md)**
