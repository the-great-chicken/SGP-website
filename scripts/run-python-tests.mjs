import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function defaultPython() {
  if (process.env.PYTHON) return process.env.PYTHON;

  const venvPython = path.resolve(
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  if (existsSync(venvPython)) return venvPython;

  return process.platform === "win32" ? "python" : "python3";
}

const python = defaultPython();
console.log(`Running Python tests with ${python}.`);
const result = spawnSync(
  python,
  ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"],
  { stdio: "inherit", windowsHide: true },
);

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error(`Python interpreter not found: ${python}`);
    console.error("Set PYTHON or create .venv with the project test dependencies installed.");
    process.exit(1);
  }
  throw result.error;
}
process.exit(result.status ?? 1);
