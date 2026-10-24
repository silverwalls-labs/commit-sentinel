/**
 * Human-readable terminal formatter with optional ANSI color output.
 *
 * Respects `NO_COLOR` / `FORCE_COLOR` environment variables and accepts an
 * explicit `color` option that always takes effect regardless of TTY status.
 *
 * @module
 */
import type { ValidationReport } from '../runner.ts';
import type { Formatter, FormatOptions } from './types.ts';

function hasColors(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return process.stdout.isTTY === true;
}

// ANSI SGR open/close pairs used by the formatter.
const ANSI: Record<string, [string, string]> = {
  red: ['\x1b[31m', '\x1b[39m'],
  green: ['\x1b[32m', '\x1b[39m'],
  yellow: ['\x1b[33m', '\x1b[39m'],
  blue: ['\x1b[34m', '\x1b[39m'],
  dim: ['\x1b[2m', '\x1b[22m'],
};

/**
 * Apply ANSI styling when {@link color} is `true`.
 *
 * Uses manual ANSI codes rather than `styleText()` so that an explicit
 * `color: true` option is honoured even on non-TTY streams (F21).
 */
function style(text: string, format: string, color: boolean): string {
  if (!color) return text;
  const pair = ANSI[format]!;
  return `${pair[0]}${text}${pair[1]}`;
}

/**
 * Strip C0/C1 control characters except newline (`\n`) and carriage return
 * (`\r`) so that commit-controlled escape sequences cannot manipulate the
 * terminal display (F15).
 */
function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
}

/** Default terminal formatter with colored icons and suggestions. */
export const humanFormatter: Formatter = {
  format(report: ValidationReport, options?: FormatOptions): string {
    const color = options?.color ?? hasColors();

    if (report.ignored) {
      const header = report.commit.header.length > 0 ? sanitize(report.commit.header) : '<empty>';
      // Tolerate hand-built reports without ignoredBy, like the header fallback.
      const label = report.ignoredBy ? `${sanitize(report.ignoredBy)} ` : '';
      return (
        style('ℹ', 'blue', color) +
        ` Ignored ${label}commit message: ${header}\n`
      );
    }

    const lines: string[] = [];
    // Synthetic range-level reports identify themselves by range, not header.
    const rangeLabel = report.range === undefined ? null : `commit range: ${sanitize(report.range)}`;

    if (report.valid && report.warningCount === 0) {
      // Defensive: the runner never produces a clean range report (it returns
      // null when no range rule fires), so the rangeLabel path below is
      // reachable only via direct formatter use with a hand-built report.
      lines.push(
        style('✔', 'green', color) +
          ` Valid ${rangeLabel ?? `commit message: ${sanitize(report.commit.header)}`}`,
      );
      if (report.skippedGitRules.length > 0) {
        lines.push(
          style('ℹ', 'blue', color) +
            ` Skipped git-metadata rules (not available): ${report.skippedGitRules.join(', ')}`,
        );
      }
      return lines.join('\n') + '\n';
    }

    const header = report.commit.header.length > 0 ? sanitize(report.commit.header) : '<empty>';
    const target = rangeLabel ?? `commit message: ${header}`;
    if (report.valid) {
      lines.push(style('✔', 'green', color) + ` Valid ${target}`);
    } else {
      lines.push(style('✖', 'red', color) + ` Invalid ${target}`);
    }

    lines.push('');

    for (const result of report.results) {
      const icon = result.severity === 'error'
        ? style('✖', 'red', color)
        : style('⚠', 'yellow', color);
      const ruleTag = style(`[${result.ruleName}]`, 'dim', color);

      for (const problem of result.problems) {
        lines.push(`  ${icon} ${sanitize(problem.message)} ${ruleTag}`);
        if (problem.suggestion) {
          lines.push(`    ${style('Suggestion:', 'dim', color)} ${sanitize(problem.suggestion)}`);
        }
      }
    }

    if (report.skippedGitRules.length > 0) {
      lines.push('');
      lines.push(
        style('ℹ', 'blue', color) +
          ` Skipped git-metadata rules (not available): ${report.skippedGitRules.join(', ')}`,
      );
    }

    lines.push('');
    const parts: string[] = [];
    if (report.errorCount > 0) {
      parts.push(style(`${report.errorCount} error(s)`, 'red', color));
    }
    if (report.warningCount > 0) {
      parts.push(style(`${report.warningCount} warning(s)`, 'yellow', color));
    }
    lines.push(parts.join(', '));

    return lines.join('\n') + '\n';
  },
};
