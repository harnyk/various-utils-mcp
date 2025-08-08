#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import { getFailedTestsFromFile, listJUnitXmlPaths } from './junit.js';

const server = new McpServer({
    name: 'various-utils',
    version: '0.1.0',
    title: 'Various Utilities',
});

server.registerTool(
    'path_relative',
    {
        title: 'Get relative path',
        description:
            'Calculate the relative path from one file path to another using Node.js path.relative',
        inputSchema: {
            base_file_name: z
                .string()
                .describe('Base file path to resolve from'),
            target_file_name: z
                .string()
                .describe('Target file path to resolve to'),
        },
    },
    async ({ base_file_name, target_file_name }) => {
        const result = path.relative(base_file_name, target_file_name);
        return { content: [{ type: 'text', text: result }] };
    }
);

server.registerTool(
    'get_working_directory',
    {
        title: 'Get working directory',
        description: 'Get the current working directory',
        inputSchema: {},
    },
    async () => {
        const result = process.cwd();
        return { content: [{ type: 'text', text: result }] };
    }
);

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

server.registerPrompt(
    'JunitParse',
    {
        title: 'Analyze JUnit XML: failures + slow tests (threshold) & slow suites (percentile)',
        description:
            'Discover JUnit XML files, let the user pick, then analyze failures, slow tests by threshold+topN, and slow suites by percentile.',
        argsSchema: {}, // no args
    },
    async () => {
        const cwd = process.cwd();
        const maxDepth = 3;
        const files = await listJUnitXmlPaths(cwd, maxDepth);

        const header = files.length
            ? `Found ${files.length} JUnit-like XML file(s) within depth ≤ ${maxDepth}:`
            : `No JUnit-like XML files found within depth ≤ ${maxDepth}.`;

        const list = files
            .map((f, i) => `${i + 1}. ${path.resolve(cwd, f)}`)
            .join('\n');

        return {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `
You are a test analysis assistant. **Write the final answer in concise, technical English**.

${header}
${list || ''}

Behavior:
- If multiple files are listed and you're not sure which to analyze, ask the user to choose one or several (by number or path).
- If exactly one file is listed, use it directly.
- If no files are found, ask the user to provide a path to a JUnit XML file.

Once a file (or several) is selected, **call the tool** "parse_junit_xml" for each selected file with:
{
  junit_xml_path: "<ABSOLUTE_PATH>",
  slowTestThresholdSec: 5,
  topSlowTests: 20,
  slowSuitesQuantile: 0.8,
  minKeepSuites: 1
}

Then for each file, produce these sections (omit a section if empty):

### Summary
- File: <path>
- Suites: <totalSuites> (failed: <failedSuites>)
- Tests: <totalTests> (failed: <failedTests>, passed: <passedTests>)

### Slowest Tests (> 5s, top 20 by time)
Columns: time(s), suiteName, className, testName, file

### Slowest Suites (~top 20% by total time)
Columns: totalTime(s), suiteName, failed/total, file

### Failed Tests
Group by suiteName → className. For each test include:
- testName, time(s if available), status (failure|error)
- message
- concise details (~500 chars max, stripped of noise)

### Diagnosis & hypotheses (brief bullets)
- Summarize typical failure patterns (timeouts, assertions, OOM, network).
- Link slow suites/tests with failures where they intersect.
- Suggest targeted actions: caching/fixtures, parallelization, sharding, retries for flaky cases, raising timeouts when justified, profiling hot spots.

If the results feel too small/too large, suggest changing:
- slowTestThresholdSec (e.g., 3 or 10),
- topSlowTests (e.g., 10 or 50),
- slowSuitesQuantile (e.g., 0.9 or 0.7),
- minKeepSuites (e.g., 20).

Formatting rules:
- Use concise bullet points; group items where possible; round time values to 1 decimal.
- For multiple files, repeat blocks per file and add a short “Overall” section (1–3 bullets).

Edge cases:
- If the XML has no time fields — skip “Slowest Tests/Suites”.
- If there are no failures — state that all tests passed, but still show slow sections if available.
- If there are neither slow nor failed cases — state that all metrics are OK.

Now proceed following these instructions.
`.trim(),
                    },
                },
            ],
        };
    }
);
const transport = new StdioServerTransport();
await server.connect(transport);
