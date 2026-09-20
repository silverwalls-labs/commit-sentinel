/**
 * A parsed footer from a commit message.
 *
 * @example
 * ```
 * { token: 'Reviewed-by', value: 'Alice' }
 * { token: 'BREAKING CHANGE', value: 'removed /v1 endpoint' }
 * ```
 */
export interface Footer {
  /** The footer token (e.g. `"Reviewed-by"`, `"BREAKING CHANGE"`, `"Refs"`). */
  token: string;
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
const FOOTER_LINE_RE = /^(?<token>BREAKING[ -]CHANGE|[\w-]+)(?:: | #)(?<value>.*)$/;

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
 * commit.footers[0] // { token: 'BREAKING CHANGE', value: 'removed /v1' }
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

  if (start >= lines.length) {
    return { body: null, footers: [] };
  }

  // Find the last paragraph block — if it consists entirely of footer lines
  // (and their continuations), treat it as the footer section.
  const lastBlank = findLastBlankLine(lines, start);

  if (lastBlank === -1) {
    // No blank line in the remainder — everything is one block.
    // Check if the entire block is footers.
    const footers = tryParseFooters(lines, start);
    if (footers !== null) {
      return { body: null, footers };
    }
    return { body: joinLines(lines, start, lines.length), footers: [] };
  }

  // Try to parse the last paragraph as footers.
  const footerStart = lastBlank + 1;
  const footers = tryParseFooters(lines, footerStart);
  if (footers !== null) {
    const body = joinLines(lines, start, lastBlank);
    return { body, footers };
  }

  // Last paragraph is not footers — treat everything as body.
  return { body: joinLines(lines, start, lines.length), footers: [] };
}

function findLastBlankLine(lines: string[], from: number): number {
  for (let i = lines.length - 1; i >= from; i--) {
    if (lines[i]!.trim() === '') return i;
  }
  return -1;
}

function tryParseFooters(lines: string[], from: number): Footer[] | null {
  const footers: Footer[] = [];
  let current: Footer | null = null;

  for (let i = from; i < lines.length; i++) {
    const line = lines[i]!;
    // Skip trailing empty lines
    if (line.trim() === '' && i === lines.length - 1) continue;

    const match = FOOTER_LINE_RE.exec(line);
    if (match?.groups) {
      current = { token: match.groups.token!, value: match.groups.value! };
      footers.push(current);
    } else if (current !== null) {
      // Continuation line — append to current footer value.
      current.value += `\n${line}`;
    } else {
      // First line is not a footer — this paragraph is not a footer section.
      return null;
    }
  }

  return footers.length > 0 ? footers : null;
}

function joinLines(lines: string[], from: number, to: number): string {
  // Trim trailing blank lines
  let end = to;
  while (end > from && lines[end - 1]!.trim() === '') {
    end--;
  }
  return lines.slice(from, end).join('\n');
}
