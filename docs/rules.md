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
| `footer-leading-blank` | format | `{ extraTokens?: string[] }` | Blank line required before the footer block |
| `footer-max-line-length` | content | `{ max?: number }` | 100 characters |
| `breaking-change` | content | `{ requireFooter?: boolean }` | Footer not required |
| `references-required` | content | `{ pattern?: string }` | `#123`-style reference in header or footers |
| `signed-off-by` | content | — | `Signed-off-by: Name <email>` footer required |
| `author-email` | git | `{ pattern?: string }` | Match any (`.+`) |
| `signed` | git | — | Signing not required |
| `agent-attribution` | content | `{ allow?: string[], patterns?: string[] }` | Block all known AI-agent markers |
| `max-commits` | git | `{ max?: number }` | 10 commits per range |

> **`agent-attribution` known agents:** `claude`, `copilot`, `cursor`, `gemini`, `codex`, `vibe` (Mistral), `aider`, `opencode`, `windsurf` (Cascade). Use `allow` to exempt specific agents; `patterns` to add extra deny regexes for agents not yet in the built-in set. Unknown IDs in `allow` fail at validation time. `patterns` entries are plain regex sources — the `i` and `m` flags are applied automatically.

> **`body-min-length` only measures an existing body:** commits without a body pass the rule — pair it with `body-required` to also enforce that a body exists (the hardened preset enables both).

> **URL exemption in `body-max-line-length` and `footer-max-line-length`:** a line over the limit passes when it contains an `http(s)://` URL and the line without its URLs fits within the limit — unbreakable URLs never force a violation, but prose overflow is never masked.

> **`footer-leading-blank` detects glued trailers heuristically:** the parser only extracts footers preceded by a blank line, so trailer lines glued to the body are absorbed into it. The rule flags trailing body lines whose token is a well-known git trailer (`Signed-off-by`, `Co-authored-by`, `Reviewed-by`, `Refs`, `Fixes`, `BREAKING CHANGE`, …) or that use the `Token #value` form with a bare numeric reference (`GH #42` counts, prose like `Bug #123 was the root cause` does not). Extend the recognized tokens with `extraTokens` (matched case-insensitively).

> **`references-required` looks in the header and footers only** — references buried in the body do not count. Footers are matched as written, so both separator forms work: `Refs: #42` and `Fixes #42` (but a hashless `Refs: 42` does not count). Use `pattern` for other trackers, e.g. `'[A-Z]+-\\d+'` for JIRA keys.

> **`signed-off-by` is the DCO trailer, not a cryptographic signature:** it requires a `Signed-off-by: Name <email>` footer (`git commit --signoff`) and validates purely from the message text. For GPG/SSH signature enforcement use the `signed` rule.

> **`max-commits` is range-scoped:** it is only evaluated when validating a range (`--range`, `--base`) and counts the commits in the range, not any single message. In single-message modes (`--message`, `--file`, `--commit`, `--stdin`) it is silently inapplicable (no skip notice). Merge commits never count toward the limit — ranges are enumerated with `git rev-list --no-merges` by design.

**Git-metadata rules** (`author-email`, `signed`) require an actual git commit ref. They are automatically skipped (with a notice) when validating message text directly (`--message`, `--stdin`, `--file`).

> **Note:** Ignore matching runs before any rule — git-generated messages (merge, revert/reapply, `fixup!`/`squash!`/`amend!`) skip all rules, including `format`, by default. See [configuration.md](./configuration.md#ignoring-auto-generated-commits). Explicit `revert: …` / `revert(scope): …` messages are validated normally — every preset allows the `revert` type via `type-enum`.

> **Note:** Rules execute in the order they appear in the resolved config (preset order, then user overrides). This order is deterministic but implicit — if rule ordering matters for your use case, define them explicitly in your config.
