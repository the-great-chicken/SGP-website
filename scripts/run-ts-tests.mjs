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

const root = path.resolve("tests");
const testFiles = (await collectTestFiles(root)).sort();

if (testFiles.length === 0) {
  console.error("No TypeScript/JavaScript test files found under tests/.");
  process.exit(1);
}

console.log(`Running ${testFiles.length} TypeScript/JavaScript test files.`);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
