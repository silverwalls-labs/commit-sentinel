import type { RuleProblem } from './types.ts';

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validatePositiveInteger(name: string, value: unknown): RuleProblem[] {
  if (value === undefined) return [];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return [{ message: `"${name}" must be a positive integer, got: ${JSON.stringify(value)}.` }];
  }
  return [];
}
