/**
 * SARIF 2.1.0 formatter for GitHub Code Scanning integration.
 *
 * Each rule maps to a `reportingDescriptor`, each problem to a `result`.
 * No `locations` are emitted since commit messages are not source files.
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

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
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
      // The descriptor loop above registered every result's rule name.
      const ruleIndex = ruleIndexMap.get(result.ruleName)!;
      const level = result.severity === 'error' ? 'error' : 'warning';

      for (const problem of result.problems) {
        results.push({
          ruleId: result.ruleName,
          ruleIndex,
          level,
          message: { text: problem.message },
        });
      }
    }

    const sarif: SarifLog = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'commit-sentinel',
              version: VERSION,
              rules: ruleDescriptors,
            },
          },
          results,
        },
      ],
    };

    return JSON.stringify(sarif, null, 2) + '\n';
  },
};
