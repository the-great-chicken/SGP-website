import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const coverageDirectory = path.resolve("coverage");

// These are deliberately module-specific floors, not a repo-wide vanity target.
// Raise them when tests improve; do not lower them merely to make CI green.
const coverageTargets = [
  {
    name: "Historical statistics queries",
    slug: "historical-stats-query",
    source: "src/db/historical-stats-query.ts",
    tests: ["tests/historical-stats.test.ts"],
    thresholds: { lines: 90, branches: 75, functions: 80 },
  },
  {
    name: "Cosmetics service",
    slug: "cosmetics-service",
    source: "src/cosmetics/service.ts",
    tests: ["tests/cosmetics.test.ts"],
    thresholds: { lines: 90, branches: 85, functions: 85 },
  },
  {
    name: "Edition importer",
    slug: "edition-importer",
    source: "src/db/importer.ts",
    tests: ["tests/edition-import.test.ts"],
    thresholds: { lines: 80, branches: 70, functions: 85 },
  },
  {
    name: "Kit statistics query",
    slug: "kit-stats-query",
    source: "src/db/kit-stats-query.ts",
    tests: ["tests/kit-stats.test.ts"],
    thresholds: { lines: 90, branches: 50, functions: 75 },
  },
  {
    name: "Authentication session persistence",
    slug: "auth-session-query",
    source: "src/auth/session-query.ts",
    tests: ["tests/auth.test.ts"],
    thresholds: { lines: 90, branches: 80, functions: 80 },
  },
  {
    name: "Publishing workflow",
    slug: "publishing-workflow",
    source: "src/publishing/workflow.ts",
    tests: ["tests/publishing.test.ts"],
    thresholds: { lines: 80, branches: 70, functions: 65 },
  },
];

function nodeSupportsCoverageThresholds() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 8);
}

function percent(covered, total) {
  return total === 0 ? 100 : (covered / total) * 100;
}

function parseLcov(contents, source) {
  const normalizedSource = source.replaceAll("\\", "/");
  const records = contents
    .split("end_of_record")
    .map((record) => record.trim())
    .filter(Boolean);
  const record = records.find((candidate) => {
    const sf = candidate.match(/^SF:(.+)$/m)?.[1]?.replaceAll("\\", "/");
    return sf === normalizedSource || sf?.endsWith(`/${normalizedSource}`);
  });
  if (!record) return null;

  const metric = (foundKey, totalKey) => {
    const found = Number(record.match(new RegExp(`^${foundKey}:(\\d+)$`, "m"))?.[1] ?? 0);
    const total = Number(record.match(new RegExp(`^${totalKey}:(\\d+)$`, "m"))?.[1] ?? 0);
    return { covered: found, total, percent: percent(found, total) };
  };

  const uncoveredLines = [];
  for (const match of record.matchAll(/^DA:(\d+),(\d+)/gm)) {
    if (Number(match[2]) === 0) uncoveredLines.push(Number(match[1]));
  }

  return {
    lines: metric("LH", "LF"),
    branches: metric("BRH", "BRF"),
    functions: metric("FNH", "FNF"),
    uncoveredLines,
  };
}

function compactLineRanges(lines) {
  if (lines.length === 0) return "none";
  const ranges = [];
  let start = lines[0];
  let end = lines[0];
  for (const line of lines.slice(1)) {
    if (line === end + 1) {
      end = line;
      continue;
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    start = line;
    end = line;
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  const visible = ranges.slice(0, 12);
  return visible.join(", ") + (ranges.length > visible.length ? `, +${ranges.length - visible.length} more ranges` : "");
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

if (!nodeSupportsCoverageThresholds()) {
  console.error(
    `Coverage gating requires Node.js >=22.8.0; current runtime is ${process.versions.node}. ` +
      "Use the repository's pinned .node-version (CI uses Node 24.20.0).",
  );
  process.exit(1);
}

await rm(coverageDirectory, { recursive: true, force: true });
await mkdir(coverageDirectory, { recursive: true });

const results = [];
let failed = false;

for (const target of coverageTargets) {
  const lcovPath = path.join(coverageDirectory, `${target.slug}.lcov`);
  console.log(`\nCoverage gate: ${target.name}`);
  console.log(
    `  ${target.source} — lines >= ${target.thresholds.lines}%, ` +
      `branches >= ${target.thresholds.branches}%, functions >= ${target.thresholds.functions}%`,
  );

  const result = spawnSync(
    process.execPath,
    [
      "--enable-source-maps",
      "--experimental-test-coverage",
      `--test-coverage-include=${target.source}`,
      `--test-coverage-lines=${target.thresholds.lines}`,
      `--test-coverage-branches=${target.thresholds.branches}`,
      `--test-coverage-functions=${target.thresholds.functions}`,
      "--import",
      "tsx",
      "--test",
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      "--test-reporter=lcov",
      `--test-reporter-destination=${lcovPath}`,
      ...target.tests,
    ],
    { stdio: "inherit", windowsHide: true },
  );

  if (result.error) throw result.error;

  let metrics = null;
  try {
    metrics = parseLcov(await readFile(lcovPath, "utf8"), target.source);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const meetsThresholds =
    metrics !== null &&
    metrics.lines.percent >= target.thresholds.lines &&
    metrics.branches.percent >= target.thresholds.branches &&
    metrics.functions.percent >= target.thresholds.functions;
  if (!metrics) {
    console.error(`Coverage report did not contain ${target.source}; treating this as a failure.`);
  }
  if (result.status !== 0 || !meetsThresholds) failed = true;

  results.push({
    ...target,
    metrics,
    passed: result.status === 0 && meetsThresholds,
  });
}

const lcovParts = [];
for (const result of results) {
  try {
    lcovParts.push((await readFile(path.join(coverageDirectory, `${result.slug}.lcov`), "utf8")).trim());
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
await writeFile(
  path.join(coverageDirectory, "lcov.info"),
  lcovParts.filter(Boolean).join("\n") + (lcovParts.length ? "\n" : ""),
  "utf8",
);

const jsonReport = results.map((result) => ({
  name: result.name,
  source: result.source,
  tests: result.tests,
  thresholds: result.thresholds,
  actual: result.metrics,
  passed: result.passed,
}));
await writeFile(
  path.join(coverageDirectory, "summary.json"),
  `${JSON.stringify(jsonReport, null, 2)}\n`,
  "utf8",
);

const markdown = [
  "# Critical-module coverage",
  "",
  "These gates intentionally cover selected high-risk domain/service modules rather than enforcing a global repository percentage.",
  "",
  "| Module | Lines | Branches | Functions | Gate |",
  "| --- | ---: | ---: | ---: | --- |",
  ...results.map((result) => {
    if (!result.metrics) {
      return `| \`${result.source}\` | — (>= ${result.thresholds.lines}%) | — (>= ${result.thresholds.branches}%) | — (>= ${result.thresholds.functions}%) | FAIL |`;
    }
    return (
      `| \`${result.source}\` | ${formatPercent(result.metrics.lines.percent)} (>= ${result.thresholds.lines}%) ` +
      `| ${formatPercent(result.metrics.branches.percent)} (>= ${result.thresholds.branches}%) ` +
      `| ${formatPercent(result.metrics.functions.percent)} (>= ${result.thresholds.functions}%) ` +
      `| ${result.passed ? "PASS" : "FAIL"} |`
    );
  }),
  "",
  "## Uncovered lines",
  "",
  "These ranges are diagnostic pointers, not a target to drive to zero. Review new or unexpectedly widened gaps first.",
  "",
  ...results.map((result) =>
    result.metrics
      ? `- \`${result.source}\`: ${compactLineRanges(result.metrics.uncoveredLines)}`
      : `- \`${result.source}\`: coverage record missing`,
  ),
  "",
  "The per-module `.lcov` files and combined `lcov.info` retain the complete line-level detail.",
  "",
];
await writeFile(path.join(coverageDirectory, "summary.md"), markdown.join("\n"), "utf8");

console.log("\nCritical-module coverage summary:");
for (const result of results) {
  if (!result.metrics) {
    console.log(`  FAIL ${result.source}: no coverage record`);
    continue;
  }
  console.log(
    `  ${result.passed ? "PASS" : "FAIL"} ${result.source}: ` +
      `${formatPercent(result.metrics.lines.percent)} lines, ` +
      `${formatPercent(result.metrics.branches.percent)} branches, ` +
      `${formatPercent(result.metrics.functions.percent)} functions`,
  );
}
console.log(`Reports: ${path.relative(process.cwd(), coverageDirectory)}/summary.md and coverage/lcov.info`);

if (failed) process.exit(1);
