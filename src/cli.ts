import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readCommitMessage, readGitMetaOrNull, listCommitsInRange } from './git.ts';
import { loadConfig } from './config/loader.ts';
import type { ResolvedConfig } from './config/loader.ts';
import { validate } from './runner.ts';
import type { ValidationReport } from './runner.ts';
import { humanFormatter } from './formatters/human.ts';
import { jsonFormatter } from './formatters/json.ts';
import { sarifFormatter } from './formatters/sarif.ts';
import type { Formatter } from './formatters/types.ts';
import { VERSION } from './version.ts';

const HELP = `Usage: commit-sentinel [options]

Validate git commit messages.

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

Examples:
  commit-sentinel --message "feat: add login"
  commit-sentinel --file .git/COMMIT_EDITMSG
  commit-sentinel --commit HEAD
  commit-sentinel --range main..HEAD
  commit-sentinel --base main
`;


export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function run(argv: ReadonlyArray<string>): Promise<RunResult> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: {
        message: { type: 'string', short: 'm' },
        file: { type: 'string', short: 'F' },
        commit: { type: 'string', short: 'c' },
        stdin: { type: 'boolean', default: false },
        range: { type: 'string' },
        base: { type: 'string' },
        config: { type: 'string' },
        json: { type: 'boolean', default: false },
        sarif: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (err) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${(err as Error).message}\n${HELP}`,
    };
  }

  const values = parsed.values as {
    message?: string;
    file?: string;
    commit?: string;
    stdin: boolean;
    range?: string;
    base?: string;
    config?: string;
    json: boolean;
    sarif: boolean;
    help: boolean;
    version: boolean;
  };

  if (values.help) return { exitCode: 0, stdout: HELP, stderr: '' };
  if (values.version) return { exitCode: 0, stdout: `${VERSION}\n`, stderr: '' };

  if (values.json && values.sarif) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'Cannot use both --json and --sarif.\n',
    };
  }

  const sourceCount = [
    values.message,
    values.file,
    values.commit,
    values.stdin ? 'stdin' : undefined,
    values.range,
    values.base,
  ].filter((value) => value !== undefined).length;

  if (sourceCount > 1) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'Choose only one commit message source: --message, --file, --commit, --stdin, --range, or --base.\n',
    };
  }

  try {
    const config = await loadConfig(undefined, values.config);
    const formatter = values.sarif
      ? sarifFormatter
      : values.json
        ? jsonFormatter
        : humanFormatter;

    // Range-based validation (--range or --base)
    if (values.range || values.base) {
      const range = values.range ?? `${values.base}..HEAD`;
      return await validateRange(range, config, formatter);
    }

    // Single commit validation
    const message = await resolveMessage(values);
    const hasGitSource = values.commit !== undefined || sourceCount === 0;
    const ref = values.commit ?? 'HEAD';
    const git = hasGitSource ? await readGitMetaOrNull(ref) : null;

    const report = validate(message, config, git);
    const output = formatter.format(report);

    if (report.valid) {
      return { exitCode: 0, stdout: output, stderr: '' };
    }
    return { exitCode: 2, stdout: '', stderr: output };
  } catch (err) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `${(err as Error).message}\n`,
    };
  }
}

async function validateRange(
  range: string,
  config: ResolvedConfig,
  formatter: Formatter,
): Promise<RunResult> {
  const shas = await listCommitsInRange(range);
  if (shas.length === 0) {
    return {
      exitCode: 0,
      stdout: `No commits found in range "${range}".\n`,
      stderr: '',
    };
  }

  const reports: ValidationReport[] = [];
  let hasError = false;

  for (const sha of shas) {
    const message = await readCommitMessage(sha);
    const git = await readGitMetaOrNull(sha);
    const report = validate(message, config, git);
    reports.push(report);
    if (!report.valid) hasError = true;
  }

  // For structured formats, wrap multiple reports in a single valid document.
  let output: string;
  if (formatter === jsonFormatter) {
    output = JSON.stringify(reports, null, 2) + '\n';
  } else if (formatter === sarifFormatter) {
    // Merge all results into a single SARIF run.
    output = formatter.format(mergeReports(reports));
  } else {
    output = reports.map((r) => formatter.format(r)).join('');
  }

  if (hasError) {
    return { exitCode: 2, stdout: '', stderr: output };
  }
  return { exitCode: 0, stdout: output, stderr: '' };
}

async function resolveMessage(values: {
  message?: string;
  file?: string;
  commit?: string;
  stdin: boolean;
}): Promise<string> {
  if (values.message !== undefined) return values.message;
  if (values.file !== undefined) return readFile(values.file, 'utf8');
  if (values.stdin) return readStdin();
  return readCommitMessage(values.commit ?? 'HEAD');
}

function mergeReports(reports: ValidationReport[]): ValidationReport {
  const merged: ValidationReport = {
    valid: reports.every((r) => r.valid),
    commit: reports[0]!.commit,
    results: reports.flatMap((r) => r.results),
    errorCount: reports.reduce((sum, r) => sum + r.errorCount, 0),
    warningCount: reports.reduce((sum, r) => sum + r.warningCount, 0),
    skippedGitRules: [...new Set(reports.flatMap((r) => r.skippedGitRules))],
  };
  return merged;
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
