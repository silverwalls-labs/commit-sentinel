import type { ValidationReport } from '../runner.ts';

/** Options that control formatter output. */
export interface FormatOptions {
  /** Whether to emit ANSI color codes. Respects `NO_COLOR` / `FORCE_COLOR` by default. */
  color?: boolean;
  /**
   * Render errors only: valid reports (even with warnings) produce no output,
   * and invalid reports omit warnings and informational notes. Only the human
   * formatter honours this; structured formats always stay complete.
   */
  quiet?: boolean;
}

/**
 * A formatter converts a {@link ValidationReport} into a string.
 *
 * Built-in formatters: `humanFormatter`, `jsonFormatter`, `sarifFormatter`.
 */
export interface Formatter {
  /** Render the report as a string. */
  format(report: ValidationReport, options?: FormatOptions): string;
}
