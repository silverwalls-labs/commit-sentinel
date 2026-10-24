/**
 * Commit-message cleanup mirroring git's own behavior for editor input.
 *
 * `--file .git/COMMIT_EDITMSG` and `--stdin` carry the raw, pre-cleanup
 * message that git's editor flow would still clean before committing —
 * including `#` template comments and, in `cleanup=scissors` mode, the full
 * diff below the scissors line. Stored commits (`--commit`) and `--message`
 * are post-cleanup sources and are never stripped. (Note: `git commit -F`
 * keeps `#` lines by default — the `whitespace` cleanup — so `--file` follows
 * the editor flow, not `-F`.)
 *
 * Only the default comment character `#` is supported; a custom
 * `core.commentChar` is a documented limitation.
 *
 * @module
 */

// Git's exact scissors cut line (git never varies the dash count).
const SCISSORS_RE = /^# -{24} >8 -{24}$/;

/**
 * Clean a raw editor commit message the way git's own cleanup would:
 *
 * - When a scissors line (`# ------------------------ >8 ------------------------`)
 *   is present (`cleanup=scissors` mode), drop it and everything after (the
 *   verbatim diff) and keep the text above **verbatim** — git does not strip
 *   `#` lines in scissors mode.
 * - Otherwise (default cleanup), drop lines whose first character is `#`
 *   (column 0 only, like git — indented `#` lines are kept).
 *
 * Whitespace is left untouched; the parser already tolerates blank lines.
 *
 * @param message - The raw message as read from a file or stdin.
 * @returns The cleaned message (may be empty when every line was a comment).
 */
export function cleanCommitMessage(message: string): string {
  const lines = message.split(/\r?\n/);
  const scissorsIndex = lines.findIndex((line) => SCISSORS_RE.test(line));
  if (scissorsIndex !== -1) {
    return lines.slice(0, scissorsIndex).join('\n');
  }
  return lines.filter((line) => !line.startsWith('#')).join('\n');
}
