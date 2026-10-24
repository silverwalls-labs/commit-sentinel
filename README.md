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
| **strict** (default) | `feat`, `fix`, `chore` | header-max-length: warn@100, max-commits: error@10 |
| **conventional** | `feat`, `fix`, `build`, `ci`, `docs`, `perf`, `refactor`, `style`, `test`, `chore`, `revert` | subject-case: warn@lower, header-max-length: warn@100, max-commits: error@10 |
| **angular** | `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `test` | subject-case: error@lower, header-max-length: error@100, max-commits: error@10 |
| **hardened** | same as conventional | **all 15 rules at error** — subject-max: 72, max 5 commits per range, header/body lines: 100, scope + body required, breaking-change footer required, signed commits, agent attribution blocked |

> **Note:** Git's own auto-generated messages — `Merge branch '…'`, `Revert "…"`/`Reapply "…"`, and the `fixup!`/`squash!`/`amend!` autosquash family — are **ignored by default** on every preset: validation short-circuits to valid and the commit is reported as ignored. Explicit `revert: …` / `revert(scope): …` messages are still validated normally. Opt out with `defaultIgnores: false`, or add custom patterns via `ignores` — see [docs/configuration.md](./docs/configuration.md#ignoring-auto-generated-commits). When reading a message from `--file` or `--stdin`, `#` comment lines and scissors sections are stripped first, like git's own cleanup.

> **Note:** Every preset enables `max-commits` at error — 10 commits per validated range (`--range`/`--base`), tightened to 5 in hardened. Tune it via `'max-commits': ['error', { max: 20 }]` or disable with `'off'`.

> **Note:** In the hardened preset, `scope-enum` and `author-email` are enabled but pass-through with their defaults (any scope, any email) — override their options to lock them down, e.g. `'author-email': ['error', { pattern: '^.+@company\\.com$' }]`.

## Documentation

| Guide | Contents |
|-------|----------|
| [Configuration](./docs/configuration.md) | Config resolution, severity levels, custom rules |
| [Rules](./docs/rules.md) | All 15 built-in rules, options, and defaults |
| [CLI reference](./docs/cli.md) | Options, examples, exit codes, output formats |
| [Integrations](./docs/integrations.md) | Husky, lefthook, CI/CD pipelines |
| [API](./docs/api.md) | Programmatic usage — `parseCommit`, `validate`, `loadConfig` |
| [Plugins](./docs/plugins.md) | Writing custom rules — full guide |

## License

MIT
