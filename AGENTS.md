# commit-sentinel

CLI tool and library to validate git commit messages against configurable rules.

## Stack

- **Runtime:** Node.js ≥ 24, zero runtime dependencies
- **Language:** TypeScript 6 with `erasableSyntaxOnly` — no enums, no namespaces, no parameter properties, no decorator metadata
- **Module system:** ESM (`"type": "module"` in package.json), `.ts` import extensions
- **Build:** `tsc` with `tsconfig.build.json` → `dist/`
- **Lint:** oxlint
- **Test framework:** `node:test` + `node:assert/strict` (no external test framework)

## Architecture

```
commit-sentinel.config.ts (user config)
  → config/loader.ts (import() + preset merge + plugins registry)
    → runner.ts (orchestrator)
      → parser.ts (message → ParsedCommit)
      → rules/*.ts (each implements Rule interface via defineRule())
        → formatters/*.ts (human / JSON / SARIF)
          → cli.ts (parseArgs, exit codes)
```

- **Parser is lenient, rules are strict** — parser never throws, returns `null` fields for malformed input
- **Rules are pure functions** — `defineRule<Options>()` provides type inference
- **Git-metadata rules** (`author-email`, `signed`) declare `requiresGit: true` and are skipped when git metadata is unavailable
- **Config** loaded via native `import()` from `commit-sentinel.config.ts` — no config loaders
- **Custom rules:** `plugins: Rule[]` in config, merged with builtins into `ResolvedConfig.ruleRegistry`; auto-enabled at `meta.defaultSeverity`, overridable via `rules`; name collisions and unknown rule names throw at load
- **Presets:** strict (default), conventional, angular, hardened (all 14 rules at error)
- **Version:** single source of truth in `src/version.ts` — must match `package.json` (checked by `scripts/check-version.ts`)

## Test Categories

Tests live in `tests/` (plural) and are organized into 5 categories:

| Category | Directory | What belongs here |
|----------|-----------|-------------------|
| **unit** | `tests/unit/` | Pure function tests — no I/O, no child processes, no filesystem |
| **integration** | `tests/integration/` | Multi-module tests — may create temp files, use `import()` |
| **smoke** | `tests/smoke/` | CLI in-process — call `run()` directly, check exit codes and output |
| **e2e** | `tests/e2e/` | Spawn the real binary — child process, real git operations |
| **fuzz** | `tests/fuzz/` | Property-based tests — `fast-check`, structural invariants |

Shared utilities: `tests/helpers/spawn.ts` (runCli helper), `tests/fixtures/messages.ts` (reusable test data)

## Scripts

```
npm test              # all tests
npm run test:unit     # unit only
npm run test:smoke    # smoke only
npm run test:e2e      # e2e only (needs git history)
npm run test:fuzz     # fuzz only
npm run test:coverage # all tests + 100% coverage enforcement
npm run lint          # oxlint
npm run typecheck     # tsc --noEmit
npm run build         # tsc → dist/
npm run docs:build    # typedoc → docs/api/
```

## Docs

- `docs/*.md` — handwritten guides (configuration, rules, cli, integrations, api, plugins), shipped in the npm package (`files: ["docs/*.md"]`)
- `docs/api/` — generated typedoc output (gitignored); `npm run docs:build` regenerates it
- `README.md` — lean overview with install, quick start, presets, and a docs index; deep-dive content lives in `docs/`

## CI

- `quality-gates.yaml` runs on PRs to main: commit message validation (dogfooding), OSV scan, semgrep, npm audit, lint, typecheck, build + package size check, 5 test categories with coverage artifacts, merged coverage PR comment, typedoc build.
- `publish.yaml` runs on GitHub release published: re-runs the quality gate at the tag, then **stages** the package to npm via `npm stage publish` (OIDC trusted publishing in the `release` environment, `id-token: write`, no `NODE_AUTH_TOKEN`). Version is set from the release tag into `package.json` and `src/version.ts` before build. The staged package is not live until a maintainer approves it with 2FA (`npm stage approve` or the npmjs.com Staged Packages tab); the trusted publisher on npm should be configured to allow only staged publishing.
