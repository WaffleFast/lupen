import { spawn } from "node:child_process";
import http from "node:http";

const host = process.env.LUPEN_E2E_HOST || "127.0.0.1";
const port = Number(process.env.LUPEN_E2E_PORT || 4173);
const localBaseUrl = `http://${host}:${port}`;
const externalBaseUrl = process.env.LUPEN_BASE_URL;
const args = process.argv.slice(2);

function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 250);
      });
      request.setTimeout(1000, () => request.destroy());
    }
    attempt();
  });
}

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

let serverProcess = null;

try {
  const env = {
    ...process.env,
    LUPEN_BASE_URL: externalBaseUrl || localBaseUrl
  };

  if (!externalBaseUrl) {
    serverProcess = spawn("node", ["scripts/serve-static.mjs"], {
      stdio: "inherit",
      shell: false,
      env
    });
    await waitForServer(localBaseUrl);
  }

  const code = await runCommand("node", ["node_modules/@playwright/test/cli.js", "test", ...args], { env });
  process.exitCode = code;
} finally {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
}
