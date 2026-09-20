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

### How config resolution works

1. Looks for `commit-sentinel.config.ts` in the current working directory
2. If found, loads it via native `import()` and reads the default export
3. Merges custom `plugins` rules into the rule registry
4. Resolves the `extends` preset, then applies user `rules` on top
5. If no config file is found, falls back to the `strict` preset

> **Note:** The config file is looked up in the current working directory only. Monorepo directory-tree walking is planned for a future release.

> **Note:** Node.js caches ESM `import()` by URL. If you change the config file, restart the process to pick up the new values.

### Severity levels

Each rule can be set to one of three levels:

| Level | Effect |
|-------|--------|
| `'error'` | Fails validation (exit code 2) |
| `'warn'` | Prints a warning but passes (exit code 0) |
| `'off'` | Rule is disabled entirely |

Rules can be configured as a bare severity (`'error'`) or as a tuple with options (`['warn', { max: 72 }]`).

### Custom rules

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

A rule may also define `validateOptions()` to reject bad rule options at config load (exit code 1). Plugin rules are auto-enabled with empty options `{}`, so `validateOptions` must treat an all-fields-absent object as valid — a rule whose `validateOptions` rejects `{}` cannot be loaded at all. See [PLUGINS.md](./PLUGINS.md) for details.

**Full guide — API reference, typed options, git-metadata rules, recipes, testing, distribution: [PLUGINS.md](./PLUGINS.md)**

## Presets

| Preset | Types | Notable defaults |
|--------|-------|-----------------|
| **strict** (default) | `feat`, `fix`, `chore` | header-max-length: warn@100 |
| **conventional** | `feat`, `fix`, `build`, `ci`, `docs`, `perf`, `refactor`, `style`, `test`, `chore`, `revert` | subject-case: warn@lower, header-max-length: warn@100 |
| **angular** | `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `test` | subject-case: error@lower, header-max-length: error@100 |
| **hardened** | same as conventional | **all 14 rules at error** — subject-max: 72, header/body lines: 100, scope + body required, breaking-change footer required, signed commits, agent attribution blocked |

> **Note:** `revert` (in the conventional, angular, and hardened presets) only covers explicit `revert: …` / `revert(scope): …` messages. Git's auto-generated `Revert "…"` messages do not match the `format` rule ([#24](https://github.com/silverwalls-labs/commit-sentinel/issues/24)).

> **Note:** In the hardened preset, `scope-enum` and `author-email` are enabled but pass-through with their defaults (any scope, any email) — override their options to lock them down, e.g. `'author-email': ['error', { pattern: '^.+@company\\.com$' }]`.

## Rules

| Rule | Category | Options | Default |
|------|----------|---------|---------|
| `format` | format | — | Commit must match `type: subject` or `type(scope): subject` |
| `type-enum` | format | `{ allowed?: string[] }` | Types from the active preset |
| `scope-enum` | format | `{ allowed?: string[] }` | No restriction (empty list) |
| `scope-required` | format | — | Scope is optional |
| `subject-max-length` | content | `{ max?: number }` | 72 characters |
| `subject-min-length` | content | `{ min?: number }` | 1 character |
| `subject-case` | content | `{ case?: 'lower' \| 'sentence' \| 'upper' }` | `'lower'` |
| `header-max-length` | content | `{ max?: number }` | 100 characters |
| `body-required` | content | — | Body is optional |
| `body-max-line-length` | content | `{ max?: number }` | 100 characters |
| `breaking-change` | content | `{ requireFooter?: boolean }` | Footer not required |
| `author-email` | git | `{ pattern?: string }` | Match any (`.+`) |
| `signed` | git | — | Signing not required |
| `agent-attribution` | content | `{ allow?: string[], patterns?: string[] }` | Block all known AI-agent markers |

> **`agent-attribution` known agents:** `claude`, `copilot`, `cursor`, `gemini`, `codex`, `vibe` (Mistral), `aider`, `opencode`, `windsurf` (Cascade). Use `allow` to exempt specific agents; `patterns` to add extra deny regexes for agents not yet in the built-in set. Unknown IDs in `allow` fail at validation time. `patterns` entries are plain regex sources — the `i` and `m` flags are applied automatically.

**Git-metadata rules** (`author-email`, `signed`) require an actual git commit ref. They are automatically skipped (with a notice) when validating message text directly (`--message`, `--stdin`, `--file`).

> **Note:** Rules execute in the order they appear in the resolved config (preset order, then user overrides). This order is deterministic but implicit — if rule ordering matters for your use case, define them explicitly in your config.

## CLI

```
Usage: commit-sentinel [options]

Options:
  -m, --message <message>    Validate a commit message string
  -F, --file <path>          Validate the first line from a commit message file
  -c, --commit <ref>         Validate a git commit message (default: HEAD)
      --stdin                Read the commit message from stdin
      --range <range>        Validate all commits in a git range (e.g., main..HEAD)
      --base <ref>           Validate all commits from <ref>..HEAD (PR shorthand)
      --config <path>        Path to config file (default: commit-sentinel.config.ts)
      --json                 Output results as JSON
      --sarif                Output results as SARIF 2.1.0
  -h, --help                 Show help
  -v, --version              Show version number
```

### Examples

```bash
# Validate a specific commit
commit-sentinel --commit HEAD~1

# Validate all commits in a range
commit-sentinel --range main..HEAD

# Validate a PR (shorthand for --range <ref>..HEAD)
commit-sentinel --base main

# JSON output for scripting
commit-sentinel --message "feat: add login" --json

# SARIF output for GitHub Code Scanning
commit-sentinel --range main..HEAD --sarif > results.sarif

# Read from stdin (e.g., piped from git)
echo "fix(api): handle timeout" | commit-sentinel --stdin

# Use a custom config file
commit-sentinel --message "feat: add login" --config path/to/config.ts
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Commit message is valid (warnings may be present) |
| `1` | CLI usage error or runtime error |
| `2` | Commit message validation failed |

## Output formats

### Human (default)

```
✔ Valid commit message: feat: add login
```

```
✖ Invalid commit message: bad message

  ✖ Commit message must match "type: subject" or "type(scope): subject". [format]
    Suggestion: Example: feat: add login, fix(api): handle timeout.

1 error(s)
```

### JSON (`--json`)

Full `ValidationReport` object with `valid`, `commit`, `results`, `errorCount`, `warningCount`.

### SARIF (`--sarif`)

[SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) for integration with GitHub Code Scanning and other static analysis tools.

## Git hooks integration

### Using with Husky

```bash
npm install --save-dev husky
npx husky init
echo "commit-sentinel --file \$1" > .husky/commit-msg
```

### Using with lefthook

```yaml
# lefthook.yml
commit-msg:
  commands:
    validate:
      run: commit-sentinel --file {1}
```

## CI/CD integration

```yaml
name: Validate Commits
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm install -g @silverwalls-labs/commit-sentinel
      - run: commit-sentinel --base origin/main
```

## Programmatic API

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

See [PLUGINS.md](./PLUGINS.md) for the full custom-rule guide.

## License

MIT
