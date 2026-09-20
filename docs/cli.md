# CLI reference

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

Full `ValidationReport` object with `valid`, `commit`, `results`, `errorCount`, `warningCount`.

### SARIF (`--sarif`)

[SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) for integration with GitHub Code Scanning and other static analysis tools.
