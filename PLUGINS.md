# Writing custom rules (plugins)

commit-sentinel can run your own validation rules alongside the built-in ones. A plugin rule is a **pure function over a parsed commit**: it receives the parsed message (and optionally git metadata), and returns a list of problems — an empty list means the commit passes. No plugin API to learn beyond one object shape, no registration ceremony: create the rule with `defineRule()`, list it in your config's `plugins` field, done.

## Quick start

**1. Write a rule** — in `commit-sentinel.config.ts` directly, or in a separate file:

```typescript
// commit-sentinel.config.ts
import { defineConfig, defineRule } from '@silverwalls-labs/commit-sentinel';

const noWipRule = defineRule({
  meta: {
    name: 'no-wip',                  // unique id — shown in output as [no-wip]
    description: 'Subject must not start with WIP',
    category: 'content',             // 'format' | 'content' | 'git'
    requiresGit: false,              // true → rule needs git metadata (see below)
    defaultSeverity: 'error',        // severity used when auto-enabled
  },
  validate({ commit }) {
    if (commit.subject?.toUpperCase().startsWith('WIP')) {
      return [{ message: 'WIP commits are not allowed.', suggestion: 'Remove the WIP prefix.' }];
    }
    return [];                       // empty array = commit passes this rule
  },
});

export default defineConfig({
  extends: 'conventional',
  plugins: [noWipRule],              // ← that's the registration
});
```

**2. Run the CLI** — the rule is active immediately:

```
$ commit-sentinel --message "feat: WIP do not merge"
✖ Invalid commit message: feat: WIP do not merge

  ✖ WIP commits are not allowed. [no-wip]
    Suggestion: Remove the WIP prefix.

1 error(s)
$ echo $?
2
```

Plugin problems render exactly like built-in ones — in human, `--json`, and `--sarif` output, keyed by the rule's `meta.name`.

## Registration semantics

- **Auto-enabled.** Listing a rule in `plugins` enables it at its `meta.defaultSeverity`. No second step.
- **Tunable via `rules`.** An entry keyed by the rule's `meta.name` overrides severity and options, or disables it:

  ```typescript
  export default defineConfig({
    extends: 'conventional',
    plugins: [noWipRule, issueReferenceRule],
    rules: {
      'no-wip': 'warn',                                    // downgrade
      'issue-reference-required': ['error', { pattern: 'JIRA-\\d+' }],  // options
      // 'no-wip': 'off',                                  // or disable entirely
    },
  });
  ```

- **Unique names.** A plugin name must not collide with a built-in rule or another plugin — config loading fails otherwise (see [Errors](#errors--troubleshooting)).
- **Execution order.** Rules run in resolved-config order: preset rules first, then plugins (in array order), with `rules` overrides keeping their original position.

## API reference

### `Rule`

| Field | Type | Description |
|-------|------|-------------|
| `meta` | `RuleMeta` | Static metadata (below) |
| `validate(context)` | `(ctx: RuleContext) => RuleProblem[]` | The check itself — must be pure and must not throw |

### `RuleMeta`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique identifier, used as the `rules` config key and shown in output |
| `description` | `string` | One-line human-readable summary |
| `category` | `'format' \| 'content' \| 'git'` | Grouping only — no behavioral effect |
| `requiresGit` | `boolean` | `true` → rule is skipped when git metadata is unavailable |
| `defaultSeverity` | `'warn' \| 'error'` | Severity when auto-enabled via `plugins` |

### `RuleContext` — what `validate()` receives

| Field | Type | Description |
|-------|------|-------------|
| `commit` | `ParsedCommit` | The parsed commit message (below) |
| `git` | `GitMeta \| null` | Git metadata, or `null` in message-only mode |
| `options` | your options type | From the `rules` config tuple, `{}` otherwise |

### `ParsedCommit`

The parser is lenient and never throws — malformed input yields `null` fields, so **always guard with `?.` or null checks**.

| Field | Type | Description |
|-------|------|-------------|
| `raw` | `string` | The original, unmodified message |
| `header` | `string` | First line, trimmed |
| `type` | `string \| null` | e.g. `'feat'` — `null` if the header is malformed |
| `scope` | `string \| null` | e.g. `'api'` — `null` if absent |
| `breaking` | `boolean` | `true` when the `!` marker appears before the colon |
| `hasBreakingChange` | `boolean` | `!` marker **or** a `BREAKING CHANGE` footer |
| `subject` | `string \| null` | Text after `": "` — `null` if malformed |
| `body` | `string \| null` | Text between header and footers |
| `footers` | `Footer[]` | Parsed trailers: `{ token, value }` (e.g. `{ token: 'Refs', value: '#42' }`) |

### `RuleProblem` — what `validate()` returns

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | What is wrong |
| `suggestion` | `string?` | Optional actionable fix hint |

### `GitMeta`

| Field | Type | Description |
|-------|------|-------------|
| `authorEmail` | `string` | From `git log --format=%ae` |
| `signed` | `boolean` | Signature **presence** (GPG or SSH) — validity is not verified |

## Typed options

Pass an options shape to `defineRule<Options>()` and it flows into `validate()` with full inference. Follow the built-in rules' pattern: every option is optional, with defaults applied via `??`:

```typescript
const issueReferenceRule = defineRule<{ pattern?: string }>({
  meta: {
    name: 'issue-reference-required',
    description: 'Commit must reference an issue',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validate({ commit, options }) {
    const re = new RegExp(options.pattern ?? '#\\d+');   // default when no options configured
    if (re.test(commit.raw)) return [];
    return [{
      message: 'Commit must reference an issue (e.g. "#123").',
      suggestion: 'Mention the issue in the subject, body, or a "Refs: #123" footer.',
    }];
  },
});
```

Users of the rule then configure it like any built-in: `'issue-reference-required': ['warn', { pattern: 'JIRA-\\d+' }]`.

## Validating options

Define `validateOptions()` alongside `validate()` to catch bad rule options early. The loader calls it at config load for every enabled rule; any returned problem is a hard config error (exit code 1), regardless of the rule's severity:

```typescript
const issueReferenceRule = defineRule<{ pattern?: string }>({
  meta: {
    name: 'issue-reference-required',
    description: 'Commit must reference an issue',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validateOptions(options) {
    try {
      new RegExp(options.pattern ?? '#\\d+');
      return [];
    } catch {
      return [{ message: '"pattern" is not a valid regex.', suggestion: 'Fix the regex in your config.' }];
    }
  },
  validate({ commit, options }) {
    const re = new RegExp(options.pattern ?? '#\\d+');
    // ...
  },
});
```

Two requirements to keep in mind:

- **`validateOptions` must accept `{}`.** Plugin rules are auto-enabled with empty options — the plugin API has no way to declare default option values — so treat every absent field as "use my default". A rule whose `validateOptions` rejects `{}` cannot be loaded at all.
- **`validate` should not throw on malformed options.** Configs built programmatically (bypassing `loadConfig`) skip load-time checks, so report a problem instead of throwing.

## Git-metadata rules

Set `requiresGit: true` when your rule needs more than the message text. The `git` context field is populated when validating real commits (`--commit`, `--range`, `--base`, or the default `HEAD`), and the rule is **automatically skipped** — never failed — when only text is available (`--message`, `--stdin`, `--file`). Skipped rules are listed in the report's `skippedGitRules` and shown as a notice:

```
ℹ Skipped git-metadata rules (not available): company-email
```

```typescript
const companyEmailRule = defineRule<{ domain?: string }>({
  meta: {
    name: 'company-email',
    description: 'Author must use the company email domain',
    category: 'git',
    requiresGit: true,
    defaultSeverity: 'error',
  },
  validate({ git, options }) {
    const domain = options.domain ?? 'example.com';
    if (git === null || git.authorEmail.endsWith(`@${domain}`)) return [];
    return [{
      message: `Author email "${git.authorEmail}" is not on @${domain}.`,
      suggestion: `Run: git config user.email "you@${domain}".`,
    }];
  },
});
```

> For this specific check, the built-in `author-email` rule with a `pattern` option is usually enough — the recipe above demonstrates the `requiresGit` mechanics.

## Recipes

Ready-to-paste rules for common gaps. (Some of these are planned as built-ins — see issues [#22](https://github.com/silverwalls-labs/commit-sentinel/issues/22) and [#23](https://github.com/silverwalls-labs/commit-sentinel/issues/23) — but work as plugins today.)

**No trailing period on the subject:**

```typescript
const subjectFullStopRule = defineRule({
  meta: {
    name: 'subject-full-stop',
    description: 'Subject must not end with a period',
    category: 'content',
    requiresGit: false,
    defaultSeverity: 'error',
  },
  validate({ commit }) {
    if (commit.subject?.endsWith('.')) {
      return [{ message: 'Subject must not end with a period.', suggestion: 'Drop the trailing ".".' }];
    }
    return [];
  },
});
```

Together with `no-wip`, `issue-reference-required`, and `company-email` above, these cover the most common team policies. Combine freely:

```typescript
export default defineConfig({
  extends: 'conventional',
  plugins: [noWipRule, subjectFullStopRule, issueReferenceRule, companyEmailRule],
  rules: {
    'issue-reference-required': ['warn', { pattern: '#\\d+' }],
    'company-email': ['error', { domain: 'yourcompany.com' }],
  },
});
```

## Testing your rule

Rules are pure functions, so they need no harness: build a `ParsedCommit` with the exported `parseCommit()` and call `validate()` directly.

```typescript
// no-wip.test.ts
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseCommit } from '@silverwalls-labs/commit-sentinel';
import { noWipRule } from './rules/no-wip.ts';

test('flags WIP subjects', () => {
  const problems = noWipRule.validate({
    commit: parseCommit('feat: WIP do not merge'),
    git: null,
    options: {},
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.message, /WIP/);
});

test('passes normal subjects', () => {
  const problems = noWipRule.validate({
    commit: parseCommit('feat: add login'),
    git: null,
    options: {},
  });
  assert.deepEqual(problems, []);
});
```

```bash
node --test no-wip.test.ts
```

For `requiresGit` rules, pass a `GitMeta` object literal instead of `null`: `{ authorEmail: 'a@b.com', signed: true }`.

## Sharing & distribution

The config file is loaded with native ESM `import()`, so rules can live anywhere you can import from:

**A local folder:**

```
your-repo/
├── commit-sentinel.config.ts
└── rules/
    ├── no-wip.ts
    └── issue-reference.ts
```

```typescript
// commit-sentinel.config.ts
import { defineConfig } from '@silverwalls-labs/commit-sentinel';
import { noWipRule } from './rules/no-wip.ts';
import { issueReferenceRule } from './rules/issue-reference.ts';

export default defineConfig({ extends: 'conventional', plugins: [noWipRule, issueReferenceRule] });
```

**An npm package** — export `Rule` objects from a regular package (declare `@silverwalls-labs/commit-sentinel` as a peer dependency for the `defineRule` types):

```typescript
// @yourorg/commit-rules — index.ts
export { noWipRule } from './no-wip.ts';
export { issueReferenceRule } from './issue-reference.ts';
```

```typescript
// consumer's commit-sentinel.config.ts
import { defineConfig } from '@silverwalls-labs/commit-sentinel';
import { noWipRule, issueReferenceRule } from '@yourorg/commit-rules';

export default defineConfig({ extends: 'conventional', plugins: [noWipRule, issueReferenceRule] });
```

## Errors & troubleshooting

All plugin problems are caught at config load time, before any validation runs — the CLI exits with code `1` (config error), not `2` (validation failure):

| Situation | Error |
|-----------|-------|
| Entry in `plugins` isn't a rule object | `Invalid entry in "plugins": expected a rule created with defineRule() (an object with meta.name and a validate function).` |
| Plugin name matches a built-in rule | `Plugin rule "<name>" conflicts with a built-in rule of the same name.` |
| Two plugins share a name | `Duplicate plugin rule "<name>": plugin rule names must be unique.` |
| `rules` entry references a name that is neither built-in nor plugin | `Unknown rule "<name>" in config: not a built-in rule or a plugin rule.` |

**Rule doesn't seem to run?**

- Check `skippedGitRules` / the `ℹ Skipped git-metadata rules` notice — `requiresGit: true` rules are skipped in `--message` / `--stdin` / `--file` mode.
- Check for an `'off'` entry under `rules` for your rule's name.
- Node.js caches ESM `import()` by URL: if you edit the config (or a rule file it imports) inside a long-running process, restart it to pick up changes.
