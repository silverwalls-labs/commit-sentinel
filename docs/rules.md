# Rules

| Rule | Category | Options | Default |
|------|----------|---------|---------|
| `format` | format | — | Commit must match `type: subject` or `type(scope): subject` |
| `type-enum` | format | `{ allowed?: string[] }` | Types from the active preset |
| `scope-enum` | format | `{ allowed?: string[] }` | No restriction (empty list) |
| `scope-required` | format | — | Scope is optional |
| `subject-max-length` | content | `{ max?: number }` | 72 characters |
| `subject-min-length` | content | `{ min?: number }` | 1 character |
| `subject-case` | content | `{ case?: 'lower' \| 'sentence' \| 'upper' }` | `'lower'` |
| `subject-no-trailing-period` | content | — | Trailing period not allowed |
| `header-max-length` | content | `{ max?: number }` | 100 characters |
| `body-required` | content | — | Body is optional |
| `body-min-length` | content | `{ min?: number }` | 20 characters |
| `body-max-line-length` | content | `{ max?: number }` | 100 characters |
| `breaking-change` | content | `{ requireFooter?: boolean }` | Footer not required |
| `author-email` | git | `{ pattern?: string }` | Match any (`.+`) |
| `signed` | git | — | Signing not required |
| `agent-attribution` | content | `{ allow?: string[], patterns?: string[] }` | Block all known AI-agent markers |
| `max-commits` | git | `{ max?: number }` | 10 commits per range |

> **`agent-attribution` known agents:** `claude`, `copilot`, `cursor`, `gemini`, `codex`, `vibe` (Mistral), `aider`, `opencode`, `windsurf` (Cascade). Use `allow` to exempt specific agents; `patterns` to add extra deny regexes for agents not yet in the built-in set. Unknown IDs in `allow` fail at validation time. `patterns` entries are plain regex sources — the `i` and `m` flags are applied automatically.

> **`body-min-length` only measures an existing body:** commits without a body pass the rule — pair it with `body-required` to also enforce that a body exists (the hardened preset enables both).

> **`max-commits` is range-scoped:** it is only evaluated when validating a range (`--range`, `--base`) and counts the commits in the range, not any single message. In single-message modes (`--message`, `--file`, `--commit`, `--stdin`) it is silently inapplicable (no skip notice). Merge commits never count toward the limit — ranges are enumerated with `git rev-list --no-merges` by design.

**Git-metadata rules** (`author-email`, `signed`) require an actual git commit ref. They are automatically skipped (with a notice) when validating message text directly (`--message`, `--stdin`, `--file`).

> **Note:** Ignore matching runs before any rule — git-generated messages (merge, revert/reapply, `fixup!`/`squash!`/`amend!`) skip all rules, including `format`, by default. See [configuration.md](./configuration.md#ignoring-auto-generated-commits). Explicit `revert: …` / `revert(scope): …` messages are validated normally — every preset allows the `revert` type via `type-enum`.

> **Note:** Rules execute in the order they appear in the resolved config (preset order, then user overrides). This order is deterministic but implicit — if rule ordering matters for your use case, define them explicitly in your config.
