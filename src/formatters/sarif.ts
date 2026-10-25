/**
 * SARIF 2.1.0 formatter for GitHub Code Scanning integration.
 *
 * Each rule maps to a `reportingDescriptor`, each problem to a `result`.
 * Every result includes a placeholder `locations` entry pointing at the
 * repository root (`%SRCROOT%`) — GitHub Code Scanning requires at least
 * one location per result to display it.  The location's `message` carries
 * the commit header (or the range spec for range-level reports) so the
 * finding remains identifiable in the UI.
 *
 * When a {@link ValidationReport} carries a `sha`, each result includes a
 * `properties.commitSha` bag so consumers can identify the source commit.
 * Range-level reports (carrying `range` instead of `sha`) include a
 * `properties.range` bag instead — and a `[range ...]` message prefix, since
 * the range is the only identifying context.
 *
 * @see {@link https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html | SARIF 2.1.0 spec}
 * @module
 */
import type { ValidationReport } from '../runner.ts';
import type { Formatter } from './types.ts';
import { builtinRules } from '../rules/registry.ts';
import { VERSION } from '../version.ts';

interface SarifReportingDescriptor {
  id: string;
  shortDescription: { text: string };
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string; uriBaseId: string };
  };
  message?: { text: string };
}

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: SarifLocation[];
  properties?: Record<string, unknown>;
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      rules: SarifReportingDescriptor[];
    };
  };
  results: SarifResult[];
  properties?: Record<string, unknown>;
}

interface SarifLog {
  version: string;
  $schema: string;
  runs: SarifRun[];
}

/** SARIF 2.1.0 formatter for static-analysis tool integration. */
export const sarifFormatter: Formatter = {
  format(report: ValidationReport): string {
    const ruleDescriptors: SarifReportingDescriptor[] = [];
    const ruleIndexMap = new Map<string, number>();

    // Build rule descriptors from all rules that produced results
    for (const result of report.results) {
      if (!ruleIndexMap.has(result.ruleName)) {
        const index = ruleDescriptors.length;
        ruleIndexMap.set(result.ruleName, index);

        const rule = builtinRules.get(result.ruleName);
        ruleDescriptors.push({
          id: result.ruleName,
          shortDescription: {
            text: rule?.meta.description ?? result.ruleName,
          },
        });
      }
    }

    const results: SarifResult[] = [];
    for (const result of report.results) {
      const ruleIndex = ruleIndexMap.get(result.ruleName)!;
      const level = result.severity === 'error' ? 'error' : 'warning';

      for (const problem of result.problems) {
        const locationMessage =
          report.kind === 'range'
            ? `range: ${report.range}`
            : `commit: ${report.commit.header || '<empty>'}`;

        const sarifResult: SarifResult = {
          ruleId: result.ruleName,
          ruleIndex,
          level,
          message: { text: problem.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: '', uriBaseId: '%SRCROOT%' },
              },
              message: { text: locationMessage },
            },
          ],
        };

        // Include commit identity when available (F13)
        if (report.sha) {
          sarifResult.properties = { commitSha: report.sha };
          sarifResult.message = {
            text: `[${report.sha.slice(0, 8)}] ${problem.message}`,
          };
        }

        // Range-level reports carry the range instead of a commit SHA; prefix
        // it into the message (unless a sha already prefixed it above) so the
        // text alone identifies the finding's context.
        if (report.range) {
          sarifResult.properties = { ...sarifResult.properties, range: report.range };
          if (!report.sha) {
            sarifResult.message = {
              text: `[range ${report.range}] ${problem.message}`,
            };
          }
        }

        results.push(sarifResult);
      }
    }

    const run: SarifRun = {
      tool: {
        driver: {
          name: 'commit-sentinel',
          version: VERSION,
          rules: ruleDescriptors,
        },
      },
      results,
    };

    // Ignored commits produce zero results; a run-level properties bag keeps
    // the SARIF log self-describing about why.
    if (report.ignored) {
      run.properties = { ignored: true, ignoredBy: report.ignoredBy };
      if (report.sha) {
        run.properties.commitSha = report.sha;
      }
    }

    const sarif: SarifLog = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [run],
    };

    return JSON.stringify(sarif, null, 2) + '\n';
  },
};
