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
