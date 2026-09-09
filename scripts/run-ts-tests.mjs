import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]s|tsx)$/;

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(absolute)));
    } else if (entry.isFile() && TEST_FILE.test(entry.name)) {
      files.push(absolute);
    }
  }

  return files;
}

function runTests(files, extraNodeArguments = []) {
  if (files.length === 0) return;
  const result = spawnSync(
    process.execPath,
    [...extraNodeArguments, "--import", "tsx", "--test", ...files],
    { stdio: "inherit", windowsHide: true },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const root = path.resolve("tests");
const appRoot = path.join(root, "app") + path.sep;
const testFiles = (await collectTestFiles(root)).sort();

if (testFiles.length === 0) {
  console.error("No TypeScript/JavaScript test files found under tests/.");
  process.exit(1);
}

const appBoundaryTests = testFiles.filter((file) => file.startsWith(appRoot));
const standardTests = testFiles.filter((file) => !file.startsWith(appRoot));

console.log(`Running ${testFiles.length} TypeScript/JavaScript test files.`);
runTests(standardTests);
// App-boundary tests import modules guarded by the server-only package. The
// react-server condition selects server-only's intentionally empty server export.
runTests(appBoundaryTests, ["--conditions=react-server"]);
