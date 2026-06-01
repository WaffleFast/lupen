import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const endpoint = process.env.COLYSEUS_ENDPOINT || "ws://127.0.0.1:2567";
const healthUrl = process.env.COLYSEUS_HEALTH_URL || "http://127.0.0.1:2567/health";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) return true;
    } catch (_err) {
      // Server is still starting.
    }
    await wait(250);
  }
  return false;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const commandArgs = process.platform === "win32"
      ? ["/d", "/s", "/c", command, ...args]
      : args;
    const child = spawn(process.platform === "win32" ? "cmd.exe" : command, commandArgs, {
      stdio: "inherit",
      ...options
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

const server = spawn("node", ["src/index.js"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: process.env.PORT || "2567"
  },
  stdio: ["ignore", "pipe", "pipe"],
  shell: false
});

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

let shuttingDown = false;
function stopServer() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (server.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  server.kill();
}

process.on("exit", stopServer);
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});

try {
  const ready = await waitForHealth();
  if (!ready) throw new Error(`Timed out waiting for Colyseus health at ${healthUrl}`);

  const env = {
    ...process.env,
    COLYSEUS_ENDPOINT: endpoint
  };
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await runCommand(npmCommand, ["run", "smoke"], { env });
  await runCommand(npmCommand, ["run", "regression"], { env });
} finally {
  stopServer();
}

process.exit(0);
