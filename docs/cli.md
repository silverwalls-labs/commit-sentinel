# CLI reference

```
Usage: commit-sentinel [options]

Options:
  -m, --message <message>    Validate a commit message string
  -F, --file <path>          Validate a commit message from a file
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

## Examples

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

## Comment stripping (`--file` / `--stdin`)

`--file` and `--stdin` are treated as raw editor input (e.g. `.git/COMMIT_EDITMSG` in a `commit-msg` hook, which git cleans only *after* the hook runs), so commit-sentinel cleans them like git's editor flow (`--cleanup=default`) before validating:

- When a scissors line (`# ------------------------ >8 ------------------------`) is present (`cleanup=scissors` mode), everything from it onward is dropped — including the verbatim diff `commit --verbose` places below it — and the text above is kept **verbatim**, `#` lines included, exactly like git.
- Otherwise (default cleanup), lines whose **first** character is `#` are removed (indented `#` lines are kept, like git).

`--message` and `--commit` are post-cleanup sources and are never stripped — a stored commit that genuinely contains `#` lines (committed with `--cleanup=verbatim`) is validated as stored. For the same reason, validate stored commits with `--commit`/`--range` rather than piping `git log` output into `--stdin`, which would strip their `#` lines.

> **Note:** the stripping matches the *editor* flow, not `git commit -F`/`-m`. With `-F`/`-m`, git's default cleanup is `whitespace`, which keeps `#` lines — so a message file you intend to pass to `git commit -F` is stripped here but stored by git with its `#` lines intact. Validate the resulting commit with `--commit`/`--range` when that difference matters. A custom `core.commentChar` is not supported; only `#` is recognized.

## Ignored commits

Git-generated messages (merge, revert/reapply, `fixup!`/`squash!`/`amend!`) are ignored by default — validation short-circuits to valid without running any rule. See [configuration.md](./configuration.md#ignoring-auto-generated-commits) for the pattern list and the `defaultIgnores`/`ignores` config fields. Ignored commits exit `0` and are always visible in the output:

- **Human**: a single informational line — `ℹ Ignored revert commit message: Revert "feat: add login"`.
- **JSON**: the report carries `ignored: true` and `ignoredBy: "<pattern name>"` (both absent on normal reports).
- **SARIF**: the commit's run has zero `results` and a run-level `properties` bag — `{ "ignored": true, "ignoredBy": "<pattern name>", "commitSha": "<sha>" }` (`commitSha` in range mode only).

## Exit codes

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

Full `ValidationReport` object with `valid`, `commit`, `results`, `errorCount`, `warningCount` (plus `ignored`/`ignoredBy` on ignored commits).

### Range output

With `--range`/`--base`, output covers every commit in the range. Range-scoped rules also run on empty ranges, so a range-level finding can be the only thing in the output. The two structured formats surface it differently:

- **JSON**: output is an **array** of reports, one per commit (each carrying its `sha`). When a range-scoped rule (e.g. `max-commits`) finds a problem, one extra report is appended: it carries a `range` field and a `kind: "range"` discriminator instead of a `sha`, and is not tied to any single commit.
- **SARIF**: output contains one run per commit. A range-scoped rule finding becomes one extra run whose results carry the range in `properties.range` and prefix the message with `[range <range>]`; there is no `kind` discriminator in SARIF.

### SARIF (`--sarif`)

[SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) for integration with GitHub Code Scanning and other static analysis tools.
