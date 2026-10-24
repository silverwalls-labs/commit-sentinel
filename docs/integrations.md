# Integrations

## Git hooks

In a `commit-msg` hook the message file (`$1`, typically `.git/COMMIT_EDITMSG`) still contains git's `#` template comments — commit-sentinel strips them (and any scissors section) automatically when reading via `--file` or `--stdin`, so no pre-processing is needed.

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

## CI/CD

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

> **Note:** every preset enables the range-scoped `max-commits` rule at `error` (10 commits per validated range, 5 in hardened). Large PRs will fail the step above until you raise or disable it — e.g. `'max-commits': ['error', { max: 20 }]` or `'off'` in `commit-sentinel.config.ts`. See [rules.md](./rules.md).
