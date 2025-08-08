import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getFailedTestsFromFile } from '../junit.js';

export function registerParseJunitXmlTool(server: McpServer) {
    server.registerTool(
        'parse_junit_xml',
        {
            title: 'Parse JUnit XML: failures + slow tests (threshold) & slow suites (percentile)',
            description: `
Parses a JUnit XML report file and returns:
- General stats: total suites, failed suites, total tests, failed tests, passed tests.
- List of failed tests with suite/class names, execution time, status, message, type, details, and file.
- Slow tests selected by fixed threshold and top-N (time > thresholdSec, sorted desc, take first topN).
- Slow suites selected by percentile threshold (inclusive nearest-rank), includes suite file if available.

Parameters:
- slowTestThresholdSec: Threshold in seconds to consider a test "slow". Default: 5.
- topSlowTests: Max number of slow tests to keep after sorting desc. Default: 20.
- slowSuitesQuantile: Percentile in range 0..1 for slow suites (default: 0.8 → slowest ~20%).
- minKeepSuites: Minimum number of suites to keep regardless of percentile. Default: 1.

Returned object:
{
  stats: { totalSuites, failedSuites, totalTests, failedTests, passedTests },
  failed: FailedTest[],
  slowTopQuantileTests: SlowTest[],      // tests with time > slowTestThresholdSec, top N
  slowTopQuantileSuites: SlowSuite[]     // suites >= percentile threshold
}

FailedTest: { suiteName?, className?, testName, time?, status, message?, type?, details?, file? }
SlowTest:   { suiteName?, className?, testName, time, file? }
SlowSuite:  { suiteName?, totalTime, totalTests, failedTests, file? }
    `.trim(),
            inputSchema: {
                junit_xml_path: z
                    .string()
                    .describe(
                        'Absolute or relative path to a JUnit XML report file to parse'
                    ),
                slowTestThresholdSec: z
                    .number()
                    .positive()
                    .optional()
                    .describe('Threshold in seconds for slow tests (default: 5)'),
                topSlowTests: z
                    .number()
                    .int()
                    .min(1)
                    .optional()
                    .describe('Max number of slow tests to return (default: 20)'),
                slowSuitesQuantile: z
                    .number()
                    .min(0)
                    .max(1)
                    .optional()
                    .describe(
                        'Percentile threshold for slow suites (0..1). Default: 0.8 (slowest ~20%)'
                    ),
                minKeepSuites: z
                    .number()
                    .int()
                    .min(1)
                    .optional()
                    .describe('Minimum number of suites to keep (default: 1)'),
            },
        },
        async ({
            junit_xml_path,
            slowTestThresholdSec = 5,
            topSlowTests = 20,
            slowSuitesQuantile = 0.8,
            minKeepSuites = 1,
        }) => {
            const result = getFailedTestsFromFile(junit_xml_path, {
                slowTestThresholdSec,
                topSlowTests,
                slowSuitesQuantile,
                minKeepSuites,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
    );
}
