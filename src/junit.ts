import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import fg from 'fast-glob';

export type FailedTest = {
    suiteName?: string;
    className?: string;
    testName: string;
    time?: number;
    status: 'failure' | 'error';
    message?: string;
    type?: string;
    details?: string;
    file?: string;
};

export type SlowTest = {
    suiteName?: string;
    className?: string;
    testName: string;
    time: number; // seconds
    file?: string;
};

export type SlowSuite = {
    suiteName?: string;
    totalTime: number; // seconds
    totalTests: number;
    failedTests: number;
    file?: string;
};

export type TestStats = {
    totalSuites: number;
    failedSuites: number;
    totalTests: number;
    failedTests: number;
    passedTests: number;
};

export type JUnitReport = {
    stats: TestStats;
    failed: FailedTest[];
    /** Slow tests selected by fixed threshold + top-N */
    slowTopQuantileTests: SlowTest[];
    /** Slow suites selected by percentile (inclusive) */
    slowTopQuantileSuites: SlowSuite[];
};

export type JUnitOptions = {
    /** Threshold in seconds to consider a test "slow". Default: 5. */
    slowTestThresholdSec?: number;
    /** Max number of slow tests to keep. Default: 20. */
    topSlowTests?: number;
    /** Quantile for slow suites. Default: 0.8 (slowest ~20%). */
    slowSuitesQuantile?: number;
    /** Minimum suites to keep regardless of quantile. Default: 1. */
    minKeepSuites?: number;
};

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) =>
        ['testsuite', 'testcase', 'failure', 'error'].includes(name),
});

/** Compute quantile threshold (inclusive nearest-rank) on an array of numbers. */
function quantileInclusive(values: number[], q: number): number | undefined {
    if (!values.length) return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.max(1, Math.ceil(q * sorted.length)); // nearest-rank (1-based)
    return sorted[rank - 1];
}

/** Pick the most frequent string; return undefined if array is empty or all falsy. */
function mostFrequent(items: (string | undefined)[]): string | undefined {
    const map = new Map<string, number>();
    for (const it of items) {
        if (!it) continue;
        map.set(it, (map.get(it) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestN = 0;
    for (const [k, n] of map.entries()) {
        if (n > bestN) {
            best = k;
            bestN = n;
        }
    }
    return best;
}

/** Parse a JUnit XML string and return stats + failures + slow tests/suites. */
export function getJUnitReportFromXml(
    xml: string,
    opts: JUnitOptions = {}
): JUnitReport {
    const {
        slowTestThresholdSec = 5,
        topSlowTests = 20,
        slowSuitesQuantile = 0.8,
        minKeepSuites = 1,
    } = opts;

    const root = parser.parse(xml);

    // Collect testsuites regardless of wrapping
    const suites: any[] = [];
    if (root.testsuites?.testsuite) suites.push(...root.testsuites.testsuite);
    else if (root.testsuite)
        suites.push(
            ...(Array.isArray(root.testsuite)
                ? root.testsuite
                : [root.testsuite])
        );

    let totalSuites = suites.length;
    let failedSuites = 0;
    let totalTests = 0;
    let failedTests = 0;

    const failed: FailedTest[] = [];
    const allTimedTests: SlowTest[] = [];
    const allSuites: SlowSuite[] = [];

    for (const suite of suites) {
        const suiteName: string | undefined = suite.name;
        const suiteFile: string | undefined =
            suite.file ?? suite.filename ?? undefined;

        const testcases: any[] = Array.isArray(suite.testcase)
            ? suite.testcase
            : suite.testcase
            ? [suite.testcase]
            : [];

        totalTests += testcases.length;

        let suiteFailed = false;
        let suiteFailedCount = 0;

        const testcaseFiles: (string | undefined)[] = [];
        let suiteTimeFromCases = 0;

        for (const tc of testcases) {
            const className: string | undefined =
                tc.classname ?? tc.class ?? undefined;
            const testName: string = tc.name ?? '(unnamed)';
            const time = tc.time !== undefined ? Number(tc.time) : undefined;
            const file = tc.file ?? tc.filename ?? undefined;

            if (typeof time === 'number' && Number.isFinite(time)) {
                allTimedTests.push({
                    suiteName,
                    className,
                    testName,
                    time,
                    file,
                });
                suiteTimeFromCases += time;
            }

            if (file) testcaseFiles.push(file);

            const failNodes: any[] = Array.isArray(tc.failure)
                ? tc.failure
                : tc.failure
                ? [tc.failure]
                : [];
            const errNodes: any[] = Array.isArray(tc.error)
                ? tc.error
                : tc.error
                ? [tc.error]
                : [];

            const processNode = (node: any, status: 'failure' | 'error') => {
                suiteFailed = true;
                suiteFailedCount++;
                failedTests++;
                failed.push({
                    suiteName,
                    className,
                    testName,
                    time,
                    status,
                    message: node?.message,
                    type: node?.type,
                    details:
                        typeof node === 'string'
                            ? node
                            : node?.['#text'] ?? node?._ ?? undefined,
                    file,
                });
            };

            for (const f of failNodes) processNode(f, 'failure');
            for (const e of errNodes) processNode(e, 'error');
        }

        if (suiteFailed) failedSuites++;

        // Determine suite total time: prefer suite.time if present, else sum of testcases
        const suiteTimeAttr =
            suite.time !== undefined ? Number(suite.time) : undefined;
        const totalTime =
            typeof suiteTimeAttr === 'number' && Number.isFinite(suiteTimeAttr)
                ? suiteTimeAttr
                : suiteTimeFromCases;

        // Determine suite file: prefer suite.file, else most frequent testcase file
        const resolvedFile = suiteFile ?? mostFrequent(testcaseFiles);

        if (Number.isFinite(totalTime)) {
            allSuites.push({
                suiteName,
                totalTime,
                totalTests: testcases.length,
                failedTests: suiteFailedCount,
                file: resolvedFile,
            });
        }
    }

    const passedTests = totalTests - failedTests;

    // --- Slow tests: filter by threshold then take top-N ---
    const slowTopTests = allTimedTests
        .filter((t) => t.time > slowTestThresholdSec)
        .sort((a, b) => b.time - a.time)
        .slice(0, topSlowTests);

    // --- Slow suites: quantile method (inclusive nearest-rank) ---
    const suiteTimes = allSuites.map((s) => s.totalTime);
    const suiteThresh = quantileInclusive(suiteTimes, slowSuitesQuantile);
    let slowTopQuantileSuites =
        suiteThresh === undefined
            ? []
            : allSuites.filter((s) => s.totalTime >= suiteThresh);
    slowTopQuantileSuites.sort((a, b) => b.totalTime - a.totalTime);
    if (slowTopQuantileSuites.length < minKeepSuites && allSuites.length) {
        slowTopQuantileSuites = allSuites
            .slice()
            .sort((a, b) => b.totalTime - a.totalTime)
            .slice(0, minKeepSuites);
    }

    return {
        stats: {
            totalSuites,
            failedSuites,
            totalTests,
            failedTests,
            passedTests,
        },
        failed,
        slowTopQuantileTests: slowTopTests,
        slowTopQuantileSuites,
    };
}

/** Find JUnit-like XML files up to a given depth */
export async function listJUnitXmlPaths(
    cwd = process.cwd(),
    maxDepth = 3
): Promise<string[]> {
    // Grab *.xml and filter by common JUnit report name patterns
    const xmlPaths = await fg(['**/*.xml'], {
        cwd,
        onlyFiles: true,
        deep: maxDepth,
        dot: false,
        unique: true,
        caseSensitiveMatch: false, // case-insensitive matching
        ignore: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/out/**',
            '**/.next/**',
        ],
    });

    // Normalize separators and filter by name patterns
    const re = /(?:^|\/)(?:test-.*|.*junit.*)\.xml$/i;
    return xmlPaths
        .map((p: string) => p.replace(/\\/g, '/'))
        .filter((p: string) => re.test(p));
}

/** Convenience: read from a file path */
export function getFailedTestsFromFile(
    path: string,
    opts?: JUnitOptions
): JUnitReport {
    const xml = readFileSync(path, 'utf8');
    return getJUnitReportFromXml(xml, opts);
}
