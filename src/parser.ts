/**
 * A parsed footer from a commit message.
 *
 * @example
 * ```
 * { token: 'Reviewed-by', separator: ': ', value: 'Alice' }
 * { token: 'Fixes', separator: ' #', value: '42' }
 * ```
 */
export interface Footer {
  /** The footer token (e.g. `"Reviewed-by"`, `"BREAKING CHANGE"`, `"Refs"`). */
  token: string;
  /** The separator as written: `": "` (`Token: value`) or `" #"` (`Token #value`). */
  separator: ': ' | ' #';
  /** The footer value after the separator. May span multiple lines. */
  value: string;
}

/**
 * The result of parsing a commit message following the
 * {@link https://www.conventionalcommits.org | Conventional Commits} specification.
 *
 * The parser is lenient — it always returns a value and never throws.
 * When the header cannot be parsed, {@link type} and {@link subject} are `null`.
 */
export interface ParsedCommit {
  /** The original, unmodified commit message. */
  raw: string;
  /** The first line of the message, trimmed. */
  header: string;
  /** The commit type (e.g. `"feat"`, `"fix"`), or `null` if the header is malformed. */
  type: string | null;
  /** The optional scope (e.g. `"api"`), or `null` if absent. */
  scope: string | null;
  /** `true` when the `!` breaking-change marker appears before the colon. */
  breaking: boolean;
  /** `true` when either the `!` marker is present or a `BREAKING CHANGE` footer exists. */
  hasBreakingChange: boolean;
  /** The subject text after `": "`, or `null` if the header is malformed. */
  subject: string | null;
  /** The commit body (text between the header and footers), or `null` if absent. */
  body: string | null;
  /** Parsed footers, including `BREAKING CHANGE` / `BREAKING-CHANGE`. */
  footers: Footer[];
}

const HEADER_RE = /^(?<type>[a-zA-Z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?:\s(?<subject>.+)$/;
/** Footer line shape: `Token: value` or `Token #value` (Conventional Commits rules 8–9). */
export const FOOTER_LINE_RE = /^(?<token>BREAKING[ -]CHANGE|[\w-]+)(?<sep>: | #)(?<value>.*)$/;

/**
 * Parse a raw commit message into its constituent parts.
 *
 * Follows the {@link https://www.conventionalcommits.org | Conventional Commits} specification:
 * `type(scope)!: subject`, optional body, optional footers.
 *
 * The parser never throws. When the header does not match the conventional
 * format, {@link ParsedCommit.type | type} and {@link ParsedCommit.subject | subject}
 * are set to `null`.
 *
 * @param message - The full commit message string.
 * @returns A {@link ParsedCommit} with all extracted parts.
 *
 * @example
 * ```ts
 * const commit = parseCommit('feat(api)!: drop v1\n\nBREAKING CHANGE: removed /v1');
 * commit.type       // 'feat'
 * commit.scope      // 'api'
 * commit.breaking   // true
 * commit.subject    // 'drop v1'
 * commit.footers[0] // { token: 'BREAKING CHANGE', separator: ': ', value: 'removed /v1' }
 * ```
 */
export function parseCommit(message: string): ParsedCommit {
  const raw = message;
  const lines = message.split(/\r?\n/);

  const header = lines[0]!.trim();
  const headerMatch = HEADER_RE.exec(header);

  const type = headerMatch?.groups?.type ?? null;
  const scope = headerMatch?.groups?.scope ?? null;
  const breaking = headerMatch?.groups?.breaking === '!';
  const subject = headerMatch?.groups?.subject?.trim() ?? null;

  const { body, footers } = extractBodyAndFooters(lines.slice(1));

  const hasBreakingFooter = footers.some(
    (f) => f.token === 'BREAKING CHANGE' || f.token === 'BREAKING-CHANGE',
  );
  const hasBreakingChange = breaking || hasBreakingFooter;

  return { raw, header, type, scope, breaking, hasBreakingChange, subject, body, footers };
}

function extractBodyAndFooters(lines: string[]): {
  body: string | null;
  footers: Footer[];
} {
  // Skip leading blank line(s) after header
  let start = 0;
  while (start < lines.length && lines[start]!.trim() === '') {
    start++;
  }

  // F01: Trim trailing blank lines before footer search so that a trailing
  // newline (from files, git %B, stdin) does not push footerStart past the end.
  let end = lines.length;
  while (end > start && lines[end - 1]!.trim() === '') {
    end--;
  }

  if (start >= end) {
    return { body: null, footers: [] };
  }

  // F02: Find the footer section by scanning backward through paragraph
  // boundaries. This supports multi-paragraph footer values (spec rule 10).
  const footerStart = findFooterSectionStart(lines, start, end);

  if (footerStart === start) {
    // The entire content block is footers (no body). findFooterSectionStart
    // only returns `start` when the block parses as a footer section.
    return { body: null, footers: parseFooterSection(lines, start, end)! };
  }

  if (footerStart === -1) {
    // No footer section found — everything is body.
    return { body: joinLines(lines, start, end), footers: [] };
  }

  // Footer section found after body — already validated by
  // findFooterSectionStart, so it always parses. The body ends at the blank
  // line preceding the footer section.
  const footers = parseFooterSection(lines, footerStart, end)!;
  const body = joinLines(lines, start, footerStart - 1);
  return { body, footers };
}

/**
 * Find where the footer section begins by trying candidate start positions.
 *
 * A footer section must begin with a line matching FOOTER_LINE_RE and must be
 * separated from the body by a blank line (or start at the very beginning of
 * the content). Multi-paragraph footer values (spec rule 10) mean blank lines
 * can appear *within* the footer section, so we cannot rely on the last blank
 * line alone.
 *
 * Strategy: collect all paragraph boundaries (blank lines), then try each one
 * as a potential footer section start — earliest first. The first boundary
 * whose following content parses entirely as footers (tokens + continuations)
 * is chosen. This finds the longest valid footer section.
 *
 * Returns the line index where the footer section starts, or -1 if no footer
 * section is found.
 */
function findFooterSectionStart(lines: string[], start: number, end: number): number {
  // Collect paragraph boundary indices (indices of blank lines within the range).
  const blanks: number[] = [];
  for (let i = start; i < end; i++) {
    if (lines[i]!.trim() === '') blanks.push(i);
  }

  if (blanks.length === 0) {
    // Single paragraph — check if it starts with a footer token.
    if (FOOTER_LINE_RE.test(lines[start]!)) return start;
    return -1;
  }

  // Also consider `start` itself — the entire block after the header might be
  // a footer section with multi-paragraph values and no body.
  const candidates: number[] = [];
  if (FOOTER_LINE_RE.test(lines[start]!)) candidates.push(start);
  for (const blank of blanks) {
    const paraStart = blank + 1;
    if (FOOTER_LINE_RE.test(lines[paraStart]!)) candidates.push(paraStart);
  }

  // Try each candidate, earliest first. The first one where everything from
  // that point parses as footers gives the longest valid footer section.
  for (const candidate of candidates) {
    if (parseFooterSection(lines, candidate, end) !== null) return candidate;
  }

  return -1;
}

/**
 * Parse the footer section from `from` to `end`. Blank lines within the section
 * are treated as part of multi-paragraph footer values (spec rule 10).
 */
function parseFooterSection(lines: string[], from: number, end: number): Footer[] | null {
  const footers: Footer[] = [];
  let current: Footer | null = null;

  for (let i = from; i < end; i++) {
    const line = lines[i]!;

    if (line.trim() === '') {
      // Blank line within the footer section — part of a multi-paragraph value.
      if (current !== null) {
        current.value += '\n';
      }
      continue;
    }

    const match = FOOTER_LINE_RE.exec(line);
    if (match?.groups) {
      current = {
        token: match.groups.token!,
        separator: match.groups.sep === ' #' ? ' #' : ': ',
        value: match.groups.value!,
      };
      footers.push(current);
    } else if (current !== null) {
      // Continuation line — append to current footer value.
      current.value += `\n${line}`;
    } else {
      // First non-blank line is not a footer — not a footer section.
      return null;
    }
  }

  return footers;
}

function joinLines(lines: string[], from: number, to: number): string {
  // Trim trailing blank lines
  let end = to;
  while (end > from && lines[end - 1]!.trim() === '') {
    end--;
  }
  return lines.slice(from, end).join('\n');
}
