/**
 * Config source that downgrades the agent-attribution rule to a warning, so
 * the `attribution` message fixtures produce warn-severity findings instead
 * of errors. `extraRules` is spliced into the rules object (e.g.
 * `", 'author-email': 'warn'"`).
 */
export function agentWarnConfigSource(extraRules = ''): string {
  return `export default { extends: 'strict', rules: { 'agent-attribution': 'warn'${extraRules} } };`;
}
