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
    'max-commits': ['error', { max: 20 }],
  },
});
```

## How config resolution works

1. With `--config <path>`, uses that file directly (resolved against the current working directory) — no searching
2. Otherwise, walks from the current working directory upward looking for `commit-sentinel.config.ts` — the nearest config wins; the walk stops after checking the first directory that contains a `.git` entry (the repo root — a directory, or a file for worktrees/submodules), or at the filesystem root
3. If found, loads it via native `import()` and reads the default export
4. Merges custom `plugins` rules into the rule registry
5. Resolves the `extends` preset, then applies user `rules` on top
6. If no config file is found, falls back to the `strict` preset

In a monorepo, this means you can keep a single `commit-sentinel.config.ts` at the repo root and run commit-sentinel from any package directory (e.g. `packages/app`) — the root config is found automatically. Configs **above** the repo root are never picked up.

> **Note:** Node.js caches ESM `import()` by URL. If you change the config file, restart the process to pick up the new values.

## Ignoring auto-generated commits

Git writes its own messages for merges, reverts, and autosquash commits. Those never follow the conventional format, so by default commit-sentinel **ignores** them: validation short-circuits to valid without running any rule, and the commit is reported as ignored (never silently dropped — see [cli.md](./cli.md) for how ignored commits appear in human/JSON/SARIF output).

The built-in patterns are conservative — only git's exact productions match, case-sensitively, anchored at the start of the first line:

| Name | Pattern | Covers |
|------|---------|--------|
| `merge` | `/^Merge (?:(?:remote-tracking )?branch(?:es)? '\|tag '\|commit '\|pull request #\d+ from )/` | `Merge branch '…'`, `Merge branches '…' and '…'`, `Merge remote-tracking branch '…'`, `Merge tag '…'`, `Merge commit '…'`, GitHub's `Merge pull request #N from …` |
| `revert` | `/^(?:Revert\|Reapply) ".*"$/` | `git revert`'s default message, including `Reapply "…"` (revert of a revert) |
| `fixup` | `/^fixup! /` | `git commit --fixup` |
| `squash` | `/^squash! /` | `git commit --squash` |
| `amend` | `/^amend! /` | `git commit --fixup=amend:…` (git ≥ 2.32) |

A hand-written header that merely resembles these (`Merge branch protection rules`, `Revert "flag" rollout for beta users`, `revert "x"`) does not match and is validated normally — the merge patterns require git's quoted ref name (or GitHub's `from`), and the revert pattern is anchored to the end of the header. Explicit `revert: …` messages go through the rules as usual.

Two config fields control the behavior:

```typescript
export default defineConfig({
  extends: 'conventional',
  // Disable the built-in patterns (default: true)
  defaultIgnores: false,
  // Custom predicates, additive to the defaults. The function name is
  // reported as ValidationReport.ignoredBy ('custom' when anonymous).
  ignores: [function wip(message) { return message.startsWith('WIP'); }],
});
```

A custom predicate whose name collides with a built-in pattern name (`merge`, `revert`, `fixup`, `squash`, `amend`) — or with another custom predicate's name — fails at config load, same convention as plugin rule names, so `ignoredBy` always identifies exactly one entry.

**Range mode:** ignored commits in a `--range`/`--base` run still produce a (valid, ignored) report entry and still count for range-scoped rules like `max-commits` — ignoring exempts a commit from per-commit message rules, not from range accounting. Merge commits never appear in ranges at all (`git log --no-merges`).

**Library use:** `ResolvedConfig.ignores` carries the resolved list. Hand-built configs without an `ignores` key fall back to the built-in defaults (mirroring the `ruleRegistry` fallback); pass `ignores: []` to disable ignoring entirely.

> **Security note:** an ignored commit skips *all* rules, including `agent-attribution` in the hardened preset — attribution footers inside a `fixup!` or `Revert "…"` commit are not scanned. Ignored commits are always visible in the output (`ignored`/`ignoredBy` in JSON, an `ℹ Ignored …` line in human output), so CI logs show them; set `defaultIgnores: false` if your policy requires validating every commit.

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

