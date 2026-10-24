import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ActiveSeverity, Rule, RuleConfig, Severity } from '../rules/types.ts';
import type { UserConfig } from './define-config.ts';
import { type ResolvedIgnore, resolveIgnores } from '../ignores.ts';
import { builtinRules } from '../rules/registry.ts';
import { getPreset, strict } from './presets.ts';

/** A single rule entry after preset merging and normalization. */
export interface ResolvedRuleEntry {
  /** The active severity for this rule. */
  severity: ActiveSeverity;
  /** Rule-specific options (may be `{}` when defaults apply). */
  options: unknown;
}

/** Fully resolved configuration ready for the validation runner. */
export interface ResolvedConfig {
  /** Map of rule name → resolved entry. Rules set to `'off'` are excluded. */
  rules: Record<string, ResolvedRuleEntry>;
  /**
   * Merged rule registry: built-in rules plus any `plugins` from the user
   * config. When absent, the runner falls back to the built-in rules only.
   */
  ruleRegistry?: ReadonlyMap<string, Rule>;
  /**
   * Resolved ignore list (built-in patterns plus custom predicates). When
   * absent — e.g. on hand-built configs — the runner falls back to the
   * built-in default ignores; pass `[]` to disable ignoring entirely.
   */
  ignores?: ReadonlyArray<ResolvedIgnore>;
}

const CONFIG_FILE = 'commit-sentinel.config.ts';

/**
 * Discover, load, and resolve a commit-sentinel configuration.
 *
 * Resolution order:
 * 1. Look for `commit-sentinel.config.ts` in `cwd` (or an explicit `configPath`).
 * 2. If found, `import()` it and read its default export.
 * 3. Merge `plugins` into the rule registry and auto-enable each plugin rule
 *    at its `meta.defaultSeverity`.
 * 4. Resolve the `extends` preset, then merge user overrides on top.
 * 5. If no config file is found, fall back to the `strict` preset.
 *
 * @param cwd - Directory to search for the config file. Defaults to `process.cwd()`.
 * @param configPath - Explicit path to a config file (relative to `cwd`).
 * @returns A fully resolved config with only active rules.
 * @throws When an explicit `configPath` does not exist, the config file fails
 * to import, a plugin rule is malformed or its name collides with a built-in
 * rule or another plugin, a `rules` entry references an unknown rule, or a
 * rule entry has an unknown severity or malformed configuration shape.
 */
export async function loadConfig(cwd?: string, configPath?: string): Promise<ResolvedConfig> {
  const dir = cwd ?? process.cwd();
  const userConfig = await loadUserConfig(dir, configPath);

  if (userConfig === null) {
    return resolveConfig({ extends: undefined, rules: undefined }, strict);
  }

  const presetName = userConfig.extends;
  const preset = presetName ? getPreset(presetName) : strict;
  return resolveConfig(userConfig, preset);
}

async function loadUserConfig(
  dir: string,
  configPath?: string,
): Promise<UserConfig | null> {
  const filePath = configPath ? resolve(dir, configPath) : resolve(dir, CONFIG_FILE);

  try {
    await access(filePath);
  } catch {
    if (configPath) {
      throw new Error(`Config file not found: ${filePath}`);
    }
    return null;
  }

  try {
    const mod = (await import(pathToFileURL(filePath).href)) as { default?: UserConfig };
    return mod.default ?? null;
  } catch (err) {
    throw new Error(
      `Failed to load config file "${filePath}": ${(err as Error).message}`,
    );
  }
}

function resolveConfig(
  userConfig: UserConfig,
  preset: Record<string, RuleConfig>,
): ResolvedConfig {
  const plugins = userConfig.plugins ?? [];
  const ruleRegistry = buildRegistry(plugins);

  const merged: Record<string, RuleConfig> = Object.create(null);
  for (const [key, value] of Object.entries(preset)) {
    // Deep clone array configs to prevent shared mutable state (F16)
    merged[key] = Array.isArray(value) ? [value[0], structuredClone(value[1])] as RuleConfig : value;
  }

  // Auto-enable plugin rules at their declared default severity
  for (const plugin of plugins) {
    merged[plugin.meta.name] = plugin.meta.defaultSeverity;
  }

  // Apply user overrides
  if (userConfig.rules) {
    for (const [name, config] of Object.entries(userConfig.rules)) {
      if (!ruleRegistry.has(name)) {
        throw new Error(
          `Unknown rule "${name}" in config: not a built-in rule or a plugin rule.`,
        );
      }
      merged[name] = config;
    }
  }

  // Normalize to ResolvedRuleEntry, filtering out 'off' rules
  const rules: Record<string, ResolvedRuleEntry> = Object.create(null);
  for (const [name, config] of Object.entries(merged)) {
    const entry = normalizeRuleConfig(name, config);
    if (entry !== null) {
      rules[name] = entry;
    }
  }

  validateAllRuleOptions(rules, ruleRegistry);

  validateIgnoresConfig(userConfig);
  const ignores = resolveIgnores(userConfig.defaultIgnores, userConfig.ignores);

  return { rules, ruleRegistry, ignores };
}

function validateIgnoresConfig(userConfig: UserConfig): void {
  if (userConfig.defaultIgnores !== undefined && typeof userConfig.defaultIgnores !== 'boolean') {
    throw new Error(
      `Invalid "defaultIgnores" in config: expected a boolean, got: ${typeof userConfig.defaultIgnores}.`,
    );
  }
  if (userConfig.ignores === undefined) return;
  if (!Array.isArray(userConfig.ignores)) {
    throw new Error('Invalid "ignores" in config: expected an array of functions.');
  }
  for (const entry of userConfig.ignores) {
    if (typeof entry !== 'function') {
      throw new Error(
        'Invalid entry in "ignores": expected a function (message: string) => boolean.',
      );
    }
  }
}

function validateAllRuleOptions(
  rules: Record<string, ResolvedRuleEntry>,
  registry: ReadonlyMap<string, Rule>,
): void {
  for (const [name, entry] of Object.entries(rules)) {
    const rule = registry.get(name);
    if (!rule?.validateOptions) continue;

    const problems = rule.validateOptions(entry.options);
    if (problems.length === 0) continue;

    const details = problems.map((p) => p.message).join(' ');
    throw new Error(`Invalid options for rule "${name}": ${details}`);
  }
}

function buildRegistry(plugins: readonly Rule[]): ReadonlyMap<string, Rule> {
  if (plugins.length === 0) return builtinRules;

  const registry = new Map(builtinRules);
  for (const plugin of plugins) {
    if (!isRule(plugin)) {
      throw new Error(
        'Invalid entry in "plugins": expected a rule created with defineRule() (an object with meta.name and a validate function; validateOptions and checkRange, when present, must also be functions).',
      );
    }
    const name = plugin.meta.name;
    if (builtinRules.has(name)) {
      throw new Error(`Plugin rule "${name}" conflicts with a built-in rule of the same name.`);
    }
    if (registry.has(name)) {
      throw new Error(`Duplicate plugin rule "${name}": plugin rule names must be unique.`);
    }
    registry.set(name, plugin);
  }
  return registry;
}

function isRule(value: unknown): value is Rule {
  const candidate = value as {
    meta?: { name?: unknown };
    validate?: unknown;
    validateOptions?: unknown;
    checkRange?: unknown;
  } | null;
  if (typeof candidate?.meta?.name !== 'string' || typeof candidate.validate !== 'function') {
    return false;
  }
  if (candidate.validateOptions !== undefined && typeof candidate.validateOptions !== 'function') {
    return false;
  }
  return candidate.checkRange === undefined || typeof candidate.checkRange === 'function';
}

function normalizeRuleConfig(name: string, config: RuleConfig): ResolvedRuleEntry | null {
  if (config === 'off') return null;
  if (config === 'warn' || config === 'error') return { severity: config, options: {} };

  if (typeof config === 'string') {
    throw new Error(
      `Unknown severity "${config}" for rule "${name}". Use 'off', 'warn', or 'error'.`,
    );
  }
  if (!Array.isArray(config)) {
    throw new Error(
      `Invalid configuration for rule "${name}": expected 'off', 'warn', 'error', or a [severity, options] tuple.`,
    );
  }

  const severity = config[0] as Severity;
  if (severity === 'off') return null;
  if (severity !== 'warn' && severity !== 'error') {
    throw new Error(
      `Unknown severity ${JSON.stringify(severity)} for rule "${name}". Use 'off', 'warn', or 'error'.`,
    );
  }

  if (config[1] !== undefined && (typeof config[1] !== 'object' || config[1] === null)) {
    throw new Error(
      `Invalid options for rule "${name}": expected an object, got: ${typeof config[1]}.`,
    );
  }
  return { severity, options: config[1] !== undefined ? structuredClone(config[1]) : {} };
}
