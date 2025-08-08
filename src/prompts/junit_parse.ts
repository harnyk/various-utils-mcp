import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import { listJUnitXmlPaths } from '../junit.js';

export function registerJunitParsePrompt(server: McpServer) {
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
}
