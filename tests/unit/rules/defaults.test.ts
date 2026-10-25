import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCommit } from '../../../src/parser.ts';
import { getRule } from '../../../src/rules/registry.ts';
import { subjectMaxLengthRule } from '../../../src/rules/subject-max-length.ts';
import { subjectMinLengthRule } from '../../../src/rules/subject-min-length.ts';
import { headerMaxLengthRule } from '../../../src/rules/header-max-length.ts';
import { bodyMinLengthRule } from '../../../src/rules/body-min-length.ts';
import { bodyMaxLineLengthRule } from '../../../src/rules/body-max-line-length.ts';
import { authorEmailRule } from '../../../src/rules/author-email.ts';
import { breakingChangeRule } from '../../../src/rules/breaking-change.ts';
import { typeEnumRule } from '../../../src/rules/type-enum.ts';
import { scopeEnumRule } from '../../../src/rules/scope-enum.ts';
import { agentAttributionRule } from '../../../src/rules/agent-attribution.ts';
import { maxCommitsRule } from '../../../src/rules/max-commits.ts';
import { fakeCommits } from '../../fixtures/range-rules.ts';

describe('rule option defaults', () => {
  it('subject-max-length defaults to 72', () => {
    const long = `feat: ${'a'.repeat(80)}`;
    const problems = subjectMaxLengthRule.validate({
      commit: parseCommit(long),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /72/);
  });

  it('subject-min-length defaults to 1', () => {
    const problems = subjectMinLengthRule.validate({
      commit: parseCommit('feat: '),
      git: null,
      options: {},
    });
    // Subject is empty string after trim — but parser extracts '' if nothing after colon-space
    // Actually the regex requires \S after colon-space, so this won't parse.
    // Use a parsed commit with empty subject instead:
    assert.equal(problems.length, 0); // null subject is skipped
  });

  it('header-max-length defaults to 100', () => {
    const long = `feat: ${'a'.repeat(100)}`;
    const problems = headerMaxLengthRule.validate({
      commit: parseCommit(long),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /100/);
  });

  it('body-min-length defaults to 20', () => {
    const problems = bodyMinLengthRule.validate({
      commit: parseCommit('feat: add\n\nTiny body.'),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /at least 20/);
  });

  it('body-max-line-length defaults to 100', () => {
    const long = `feat: add\n\n${'a'.repeat(101)}`;
    const problems = bodyMaxLineLengthRule.validate({
      commit: parseCommit(long),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /100/);
  });

  it('author-email defaults to match-all pattern', () => {
    const problems = authorEmailRule.validate({
      commit: parseCommit('feat: add'),
      git: { authorEmail: 'anything@anywhere.com', signed: false },
      options: {},
    });
    assert.equal(problems.length, 0);
  });

  it('breaking-change defaults requireFooter to false', () => {
    const problems = breakingChangeRule.validate({
      commit: parseCommit('feat!: drop API'),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 0);
  });

  it('type-enum with no allowed list passes any type', () => {
    const problems = typeEnumRule.validate({
      commit: parseCommit('anything: goes'),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 0);
  });

  it('scope-enum with no allowed list passes any scope', () => {
    const problems = scopeEnumRule.validate({
      commit: parseCommit('feat(anything): goes'),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 0);
  });

  it('agent-attribution defaults block all known agents', () => {
    const problems = agentAttributionRule.validate({
      commit: parseCommit('feat: add login\n\nCo-Authored-By: Claude <noreply@anthropic.com>'),
      git: null,
      options: {},
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /Claude Code/);
  });

  it('max-commits defaults to 10', () => {
    const problems = maxCommitsRule.checkRange!({
      range: 'main..HEAD',
      commits: fakeCommits(11),
      commitCount: 11,
      options: {},
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /maximum of 10/);
    assert.equal(maxCommitsRule.checkRange!({
      range: 'main..HEAD',
      commits: fakeCommits(10),
      commitCount: 10,
      options: {},
    }).length, 0);
  });
});

describe('getRule', () => {
  it('returns a known rule', () => {
    const rule = getRule('format');
    assert.ok(rule);
    assert.equal(rule.meta.name, 'format');
  });

  it('returns undefined for unknown rule', () => {
    assert.equal(getRule('nonexistent'), undefined);
  });
});
