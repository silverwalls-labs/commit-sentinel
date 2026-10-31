import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { cleanCommitMessage } from './cleanup.ts';
import { readCommitMessage, readGitMetaOrNull, readCommitsInRange } from './git.ts';
import { loadConfig } from './config/loader.ts';
import type { ResolvedConfig } from './config/loader.ts';
import { validate, validateRangeRules } from './runner.ts';
import type { ValidationReport } from './runner.ts';
import type { RangeCommit } from './rules/types.ts';
import { detectColor, formatTooManyWarnings, humanFormatter } from './formatters/human.ts';
import { jsonFormatter } from './formatters/json.ts';
import { sarifFormatter } from './formatters/sarif.ts';
import type { Formatter, FormatOptions } from './formatters/types.ts';
import { VERSION } from './version.ts';

const HELP = `Usage: commit-sentinel [options]

Validate git commit messages.

Options:
  -m, --message <message>    Validate a commit message string
  -F, --file <path>          Validate a commit message from a file
  -c, --commit <ref>         Validate a git commit message (default: HEAD)
      --stdin                Read the commit message from stdin
      --range <range>        Validate all commits in a git range (e.g., main..HEAD)
      --base <ref>           Validate all commits from <ref>..HEAD (PR shorthand)
      --config <path>        Path to config file (default: nearest commit-sentinel.config.ts, searching upward)
      --json                 Output results as JSON
      --sarif                Output results as SARIF 2.1.0
      --max-warnings <n>     Fail with exit 2 when more than <n> warnings are found
      --quiet                Suppress all non-error output (human format only)
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
        'max-warnings': { type: 'string' },
        quiet: { type: 'boolean', default: false },
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
    'max-warnings'?: string;
    quiet: boolean;
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

  // An empty --range/--base is almost always an unset CI variable. Fail fast:
  // an empty string is falsy, and `..HEAD` is an empty range, so without these
  // guards the run would silently validate nothing and exit 0.
  if (values.range === '') {
    return { exitCode: 1, stdout: '', stderr: 'Option --range requires a non-empty value.\n' };
  }
  if (values.base === '') {
    return { exitCode: 1, stdout: '', stderr: 'Option --base requires a non-empty value.\n' };
  }
  // Same unset-CI-variable hazard: an empty --config is falsy and would
  // silently fall through to the config walk instead of the explicit path.
  if (values.config === '') {
    return { exitCode: 1, stdout: '', stderr: 'Option --config requires a non-empty value.\n' };
  }

  // No threshold means no limit: warningCount > Infinity is never true, so the
  // unset case needs no separate code path.
  let maxWarnings = Number.POSITIVE_INFINITY;
  if (values['max-warnings'] !== undefined) {
    const raw = values['max-warnings'];
    // The safe-integer check rejects digit strings Number() cannot represent
    // exactly (they would silently enforce a different limit than typed).
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Option --max-warnings requires a non-negative integer, got: "${raw}".\n`,
      };
    }
    maxWarnings = Number(raw);
  }

  try {
    const config = await loadConfig(undefined, values.config);
    const formatter = values.sarif
      ? sarifFormatter
      : values.json
        ? jsonFormatter
        : humanFormatter;

    // Range-based validation (--range or --base)
    if (values.range !== undefined || values.base !== undefined) {
      const range = values.range ?? `${values.base}..HEAD`;
      return await validateRange(range, config, formatter, { maxWarnings, quiet: values.quiet });
    }

    // Single commit validation
    const message = await resolveMessage(values);
    const hasGitSource = values.commit !== undefined || sourceCount === 0;
    const ref = values.commit ?? 'HEAD';
    const git = hasGitSource ? await readGitMetaOrNull(ref) : null;

    const report = validate(message, config, git);
    return finishRun(
      [report],
      formatter,
      (options) => formatter.format(report, options),
      { maxWarnings, quiet: values.quiet },
    );
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
  opts: { maxWarnings: number; quiet: boolean },
): Promise<RunResult> {
  // One `git log` spawn yields sha, message, and metadata for every commit.
  const commits = await readCommitsInRange(range);

  const reports: ValidationReport[] = [];
  const rangeCommits: RangeCommit[] = [];

  for (const { sha, message, meta } of commits) {
    const report = validate(message, config, meta);
    // Attach SHA for structured formatters that need commit identity (F13).
    report.sha = sha;
    reports.push(report);
    // Reuse the already-parsed commit for range-scoped rules.
    rangeCommits.push({ sha, commit: report.commit, git: meta });
  }

  // Range-scoped rules (e.g. max-commits) run once against the whole range —
  // after every commit has been validated individually, and including empty
  // ranges, so plugin rules can observe a commitCount of 0.
  const rangeReport = validateRangeRules(range, rangeCommits, config);

  // Range-scoped rule findings ride along after the per-commit reports; on an
  // empty range this is the only report.
  if (rangeReport) {
    reports.push(rangeReport);
  }

  // Empty range with nothing to report — return structured empty output per
  // format (F11).
  if (commits.length === 0 && rangeReport === null) {
    if (formatter === jsonFormatter) {
      return { exitCode: 0, stdout: '[]\n', stderr: '' };
    }
    if (formatter === sarifFormatter) {
      const emptySarif = JSON.stringify({
        version: '2.1.0',
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        runs: [{
          tool: { driver: { name: 'commit-sentinel', version: VERSION, rules: [] } },
          results: [],
        }],
      }, null, 2) + '\n';
      return { exitCode: 0, stdout: emptySarif, stderr: '' };
    }
    return {
      exitCode: 0,
      stdout: opts.quiet ? '' : `No commits found in range "${range}".\n`,
      stderr: '',
    };
  }

  return finishRun(reports, formatter, (options) => {
    // For structured formats, wrap multiple reports in a single valid document.
    if (formatter === jsonFormatter) {
      return JSON.stringify(reports, null, 2) + '\n';
    }
    if (formatter === sarifFormatter) {
      // Format each report individually, then combine into a multi-run SARIF
      // log so that each commit's findings are identifiable (F13).
      return formatSarifRange(reports);
    }
    return reports.map((r) => formatter.format(r, options)).join('');
  }, opts);
}

/**
 * Turn validated reports into the final {@link RunResult} — shared by the
 * single-commit and range paths so the exit-code, `--quiet`, `--max-warnings`,
 * and stream-routing semantics cannot drift between them.
 */
function finishRun(
  reports: ValidationReport[],
  formatter: Formatter,
  composeOutput: (options?: FormatOptions) => string,
  opts: { maxWarnings: number; quiet: boolean },
): RunResult {
  // The warning budget applies to the whole run: every per-commit report plus
  // any synthetic range-level report.
  const totalWarnings = reports.reduce((sum, report) => sum + report.warningCount, 0);
  const warningsExceeded = totalWarnings > opts.maxWarnings;
  const failed = reports.some((report) => !report.valid) || warningsExceeded;

  // Structured formats always go to stdout (F12); their payload is unchanged
  // by --quiet/--max-warnings — the exit code alone signals a warning breach.
  if (formatter !== humanFormatter) {
    return { exitCode: failed ? 2 : 0, stdout: composeOutput(), stderr: '' };
  }

  // Human output goes to stderr on failure, stdout on success — so detect
  // color from the stream the output will actually be written to.
  const color = detectColor(failed ? process.stderr : process.stdout);
  let output = composeOutput({ color, quiet: opts.quiet });
  if (warningsExceeded) {
    output += formatTooManyWarnings(totalWarnings, opts.maxWarnings, color);
  }

  if (failed) {
    return { exitCode: 2, stdout: '', stderr: output };
  }
  return { exitCode: 0, stdout: output, stderr: '' };
}

/**
 * Build a multi-run SARIF log from per-commit reports.
 *
 * Each commit becomes its own SARIF run so consumers can identify which commit
 * produced each finding.
 */
function formatSarifRange(reports: ValidationReport[]): string {
  const runs = reports.map((report) => {
    const doc = JSON.parse(sarifFormatter.format(report));
    return doc.runs[0];
  });

  const sarif = {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs,
  };
  return JSON.stringify(sarif, null, 2) + '\n';
}

async function resolveMessage(values: {
  message?: string;
  file?: string;
  commit?: string;
  stdin: boolean;
}): Promise<string> {
  if (values.message !== undefined) return values.message;
  // File and stdin carry raw, pre-cleanup editor messages (e.g.
  // .git/COMMIT_EDITMSG in a commit-msg hook) — strip comments the way git
  // would. Stored commits and --message are post-cleanup and left as-is.
  if (values.file !== undefined) return cleanCommitMessage(await readFile(values.file, 'utf8'));
  if (values.stdin) return cleanCommitMessage(await readStdin());
  return readCommitMessage(values.commit ?? 'HEAD');
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
