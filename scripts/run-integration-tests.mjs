import { spawnSync } from "node:child_process";

console.log("Running cross-process integration tests.");
const result = spawnSync(
  process.execPath,
  ["--enable-source-maps", "--import", "tsx", "--test", "tests/integration/publishing-pipeline.test.ts"],
  { stdio: "inherit", windowsHide: true },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
