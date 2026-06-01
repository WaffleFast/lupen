import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.LUPEN_E2E_HOST || "127.0.0.1";
const port = Number(process.env.LUPEN_E2E_PORT || 4173);

const mimeTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function getSafePath(url = "/") {
  const parsed = new URL(url, `http://${host}:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(root, `.${requested}`);
  return resolved.startsWith(root) ? resolved : path.join(root, "index.html");
}

const server = http.createServer(async (request, response) => {
  const filePath = getSafePath(request.url);
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  } catch (_err) {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Lupen static test server listening at http://${host}:${port}`);
});
