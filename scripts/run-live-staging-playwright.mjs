import { spawn } from "node:child_process";

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      shell: false,
      ...options
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const env = {
  ...process.env,
  LUPEN_INCLUDE_LIVE_STAGING: "true",
  LUPEN_BASE_URL: process.env.LUPEN_BASE_URL || "https://www.lupen.io"
};

const code = await runCommand("node", [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/e2e/lupen-live-staging.live.spec.js"
], { env });

process.exitCode = code;
