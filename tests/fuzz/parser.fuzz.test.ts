import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { parseCommit } from '../../src/parser.ts';

describe('parseCommit fuzz', () => {
  it('never throws for arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const result = parseCommit(input);
        assert.equal(typeof result.raw, 'string');
        assert.equal(typeof result.header, 'string');
        assert.equal(typeof result.breaking, 'boolean');
        assert.ok(Array.isArray(result.footers));
      }),
      { numRuns: 1000 },
    );
  });

  it('type is always null or a non-empty string', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const result = parseCommit(input);
        assert.ok(
          result.type === null || (typeof result.type === 'string' && result.type.length > 0),
        );
      }),
      { numRuns: 1000 },
    );
  });

  it('parses well-formed headers correctly', () => {
    const typeArb = fc.stringMatching(/^[a-z]{1,10}$/);
    const scopeArb = fc.option(fc.stringMatching(/^[a-z][a-z-]{0,19}$/));
    const breakingArb = fc.boolean();
    const subjectArb = fc.stringMatching(/^[a-z][a-z ]{0,49}$/);

    fc.assert(
      fc.property(
        typeArb,
        scopeArb,
        breakingArb,
        subjectArb,
        (type: string, scope: string | null, breaking: boolean, subject: string) => {
          const scopePart = scope !== null ? `(${scope})` : '';
          const bangPart = breaking ? '!' : '';
          const message = `${type}${scopePart}${bangPart}: ${subject}`;

          const result = parseCommit(message);
          assert.equal(result.type, type);
          assert.equal(result.scope, scope);
          assert.equal(result.breaking, breaking);
          assert.equal(result.subject, subject.trim());
        },
      ),
      { numRuns: 500 },
    );
  });

  it('raw always equals the original input', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const result = parseCommit(input);
        assert.equal(result.raw, input);
      }),
      { numRuns: 500 },
    );
  });

  it('header is always the first line of the message', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const result = parseCommit(input);
        const firstLine = input.split(/\r?\n/, 1)[0] ?? '';
        assert.equal(result.header, firstLine.trim());
      }),
      { numRuns: 500 },
    );
  });

  it('body is null when there is no blank line after header', () => {
    const headerArb = fc.stringMatching(/^[a-z]+: [a-z ]+$/);
    fc.assert(
      fc.property(headerArb, (header: string) => {
        const result = parseCommit(header);
        assert.equal(result.body, null);
      }),
      { numRuns: 200 },
    );
  });

  it('body never starts or ends with a blank line', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const { body } = parseCommit(input);
        if (body === null) return;
        const lines = body.split('\n');
        assert.notEqual(lines[0]!.trim(), '');
        assert.notEqual(lines[lines.length - 1]!.trim(), '');
      }),
      { numRuns: 1000 },
    );
  });

  it('handles messages with multiple blank lines without crashing', () => {
    const linesArb = fc.array(
      fc.oneof(fc.constant(''), fc.stringMatching(/^[a-z ]{1,40}$/)),
      { minLength: 1, maxLength: 20 },
    );
    fc.assert(
      fc.property(linesArb, (lines: string[]) => {
        const message = lines.join('\n');
        const result = parseCommit(message);
        assert.equal(typeof result.raw, 'string');
        assert.ok(result.body === null || typeof result.body === 'string');
      }),
      { numRuns: 500 },
    );
  });

  it('footers array is always valid', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const result = parseCommit(input);
        for (const footer of result.footers) {
          assert.equal(typeof footer.token, 'string');
          assert.ok(footer.token.length > 0);
          assert.equal(typeof footer.value, 'string');
        }
      }),
      { numRuns: 500 },
    );
  });

  it('handles CRLF line endings the same as LF', () => {
    const typeArb = fc.stringMatching(/^[a-z]{1,5}$/);
    const subjectArb = fc.stringMatching(/^[a-z ]{1,20}$/);
    const bodyArb = fc.stringMatching(/^[a-z ]{1,30}$/);

    fc.assert(
      fc.property(typeArb, subjectArb, bodyArb, (type: string, subject: string, body: string) => {
        const lf = `${type}: ${subject}\n\n${body}`;
        const crlf = `${type}: ${subject}\r\n\r\n${body}`;
        const lfResult = parseCommit(lf);
        const crlfResult = parseCommit(crlf);
        assert.equal(lfResult.type, crlfResult.type);
        assert.equal(lfResult.scope, crlfResult.scope);
        assert.equal(lfResult.subject, crlfResult.subject);
      }),
      { numRuns: 200 },
    );
  });

  it('handles very long messages without crashing', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1000, maxLength: 10000 }),
        (input: string) => {
          const result = parseCommit(input);
          assert.equal(result.raw, input);
        },
      ),
      { numRuns: 50 },
    );
  });
});
