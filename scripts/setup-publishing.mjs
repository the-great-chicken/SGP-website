import { spawnSync } from "node:child_process";
import path from "node:path";

const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const executable = (directory) => path.resolve(directory, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(python, ["-m", "venv", ".venv"]);
run(executable(".venv"), ["-m", "pip", "install", "-e", ".[test]"]);
// Mecha uses nbtlib 1; the datapack's statistics exporter uses nbtlib 2.
run(python, ["-m", "venv", ".venv-statistics"]);
run(executable(".venv-statistics"), ["-m", "pip", "install", "-r", "scripts/statistics-requirements.txt"]);
