/**
 * Ignore patterns for git-generated commit messages.
 *
 * Git writes its own messages for merges, reverts, and autosquash commits
 * (`fixup!`/`squash!`/`amend!`). Those never follow the conventional format,
 * so validating them is pure noise — the runner short-circuits to a valid,
 * self-describing "ignored" report when a message matches one of these
 * patterns (see {@link ../runner.ts | validate}).
 *
 * Matching is intentionally conservative: only git's exact productions are
 * recognized (case-sensitive, anchored at column 0, first line only), so a
 * hand-written header like `Merge the two config loaders` is still validated.
 *
 * @module
 */

/** A user-supplied ignore predicate — receives the full raw commit message. */
export type IgnorePredicate = (message: string) => boolean;

/** A named ignore entry; the name feeds `ValidationReport.ignoredBy`. */
export interface ResolvedIgnore {
  /** Pattern name reported when it matches (e.g. `"revert"`, `"merge"`). */
  name: string;
  /** Returns `true` when the message should skip validation entirely. */
  test: IgnorePredicate;
}

/** Extract the first line of a message (git never generates multi-line headers). */
function firstLine(message: string): string {
  return message.split(/\r?\n/, 1)[0]!;
}

/** Build a {@link ResolvedIgnore} that tests a regex against the first line. */
function headerIgnore(name: string, re: RegExp): ResolvedIgnore {
  return { name, test: (message) => re.test(firstLine(message)) };
}

/**
 * Built-in ignore patterns for git-generated commit messages.
 *
 * | Name | Matches |
 * |---|---|
 * | `merge` | `Merge branch '…'`, `Merge branches '…' and '…'`, `Merge remote-tracking branch '…'`, `Merge tag '…'`, `Merge commit '…'`, `Merge pull request #N from …` |
 * | `revert` | `Revert "…"` and `Reapply "…"` (git's revert-of-a-revert) |
 * | `fixup` | `fixup! …` (autosquash) |
 * | `squash` | `squash! …` (autosquash) |
 * | `amend` | `amend! …` (autosquash, git ≥ 2.32) |
 *
 * The merge patterns require git's quoted ref name (and GitHub's `from`), and
 * the revert pattern is anchored to the end of the header, so hand-written
 * prose like `Merge branch protection rules` or `Revert "flag" rollout` is
 * still validated.
 *
 * Disable via `defaultIgnores: false` in the config; add custom predicates
 * via `ignores`.
 */
export const defaultIgnores: ReadonlyArray<ResolvedIgnore> = [
  headerIgnore('merge', /^Merge (?:(?:remote-tracking )?branch(?:es)? '|tag '|commit '|pull request #\d+ from )/),
  headerIgnore('revert', /^(?:Revert|Reapply) ".*"$/),
  headerIgnore('fixup', /^fixup! /),
  headerIgnore('squash', /^squash! /),
  headerIgnore('amend', /^amend! /),
];

const builtinIgnoreNames = new Set(defaultIgnores.map((ignore) => ignore.name));

/**
 * Combine the built-in ignores with user-supplied predicates.
 *
 * @param defaultIgnoresEnabled - `false` drops the built-in patterns; `true`
 * or `undefined` keeps them.
 * @param custom - Custom predicates, appended after the defaults. Each is
 * named after its function name, falling back to `"custom"` for anonymous
 * functions.
 * @returns The resolved ignore list (empty when defaults are disabled and no
 * custom predicates are given).
 * @throws When a custom predicate's name collides with a built-in pattern
 * name — mirroring the plugin-rule collision check — so `ignoredBy` in the
 * output always distinguishes custom entries from the built-ins.
 */
export function resolveIgnores(
  defaultIgnoresEnabled: boolean | undefined,
  custom: ReadonlyArray<IgnorePredicate> | undefined,
): ReadonlyArray<ResolvedIgnore> {
  const resolved: ResolvedIgnore[] = defaultIgnoresEnabled === false ? [] : [...defaultIgnores];
  for (const predicate of custom ?? []) {
    const name = predicate.name !== '' ? predicate.name : 'custom';
    if (builtinIgnoreNames.has(name)) {
      throw new Error(
        `Custom ignore "${name}" conflicts with a built-in ignore pattern of the same name.`,
      );
    }
    resolved.push({ name, test: predicate });
  }
  return resolved;
}

/**
 * Find the first ignore entry matching a commit message.
 *
 * @param message - The raw commit message.
 * @param ignores - The resolved ignore list to test against, in order.
 * @returns The name of the first matching entry, or `null` when none match.
 */
export function findIgnoreMatch(
  message: string,
  ignores: ReadonlyArray<ResolvedIgnore>,
): string | null {
  for (const ignore of ignores) {
    if (ignore.test(message)) return ignore.name;
  }
  return null;
}
