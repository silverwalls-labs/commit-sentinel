# Integrations

## Git hooks

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
