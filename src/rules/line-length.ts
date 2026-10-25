const URL_RE = /https?:\/\/\S+/g;

/**
 * Check whether a line exceeds the maximum length, exempting lines whose
 * overflow is caused by unbreakable http(s) URLs: a long line passes when
 * removing every URL brings it within the limit. Prose overflow is never
 * masked — a line that is too long without its URLs still violates.
 */
export function lineExceedsMax(line: string, max: number): boolean {
  if (line.length <= max) return false;
  // When no URL is removed, stripped === line and the comparison still holds.
  return line.replace(URL_RE, '').length > max;
}
