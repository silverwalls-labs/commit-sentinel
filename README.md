# commit-sentinel

A CLI tool and library to validate and enforce git commit message standards. Supports [Conventional Commits](https://www.conventionalcommits.org), configurable rules, presets, and multiple output formats.

Zero runtime dependencies — runs on Node.js ≥ 24 built-ins only.

## Installation

```bash
npm install -g @silverwalls-labs/commit-sentinel
```

Or as a dev dependency:

```bash
npm install --save-dev @silverwalls-labs/commit-sentinel
```

## Quick Start

```bash
# Validate the last commit (uses strict preset by default)
commit-sentinel

# Validate a commit message string
commit-sentinel --message "feat: add login"

# Validate a file (e.g., from a git hook)
commit-sentinel --file .git/COMMIT_EDITMSG

# Validate all commits in a PR
commit-sentinel --base main
```

## Configuration

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

See [docs/configuration.md](./docs/configuration.md) for config resolution, severity levels, and custom rules.

## Presets

| Preset | Types | Notable defaults |
|--------|-------|-----------------|
| **strict** (default) | `feat`, `fix`, `chore` | header-max-length: warn@100 |
| **conventional** | `feat`, `fix`, `build`, `ci`, `docs`, `perf`, `refactor`, `style`, `test`, `chore`, `revert` | subject-case: warn@lower, header-max-length: warn@100 |
| **angular** | `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `test` | subject-case: error@lower, header-max-length: error@100 |
| **hardened** | same as conventional | **all 14 rules at error** — subject-max: 72, header/body lines: 100, scope + body required, breaking-change footer required, signed commits, agent attribution blocked |

> **Note:** `revert` (in the conventional, angular, and hardened presets) only covers explicit `revert: …` / `revert(scope): …` messages. Git's auto-generated `Revert "…"` messages do not match the `format` rule ([#24](https://github.com/silverwalls-labs/commit-sentinel/issues/24)).

> **Note:** In the hardened preset, `scope-enum` and `author-email` are enabled but pass-through with their defaults (any scope, any email) — override their options to lock them down, e.g. `'author-email': ['error', { pattern: '^.+@company\\.com$' }]`.

## Documentation

| Guide | Contents |
|-------|----------|
| [Configuration](./docs/configuration.md) | Config resolution, severity levels, custom rules |
| [Rules](./docs/rules.md) | All 14 built-in rules, options, and defaults |
| [CLI reference](./docs/cli.md) | Options, examples, exit codes, output formats |
| [Integrations](./docs/integrations.md) | Husky, lefthook, CI/CD pipelines |
| [API](./docs/api.md) | Programmatic usage — `parseCommit`, `validate`, `loadConfig` |
| [Plugins](./docs/plugins.md) | Writing custom rules — full guide |

## License

MIT
