import app from "./app";
import { logger } from "./lib/logger";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Keep the imported backend private. Its database and transactions are unchanged.
const backendPath = fileURLToPath(new URL("../backend/server.py", import.meta.url));
const backend = spawn("python3", [backendPath, "--port", "8000"], { stdio: ["ignore", "pipe", "pipe"] });
backend.stdout.on("data", data => logger.info({ service: "inventory" }, data.toString().trim()));
backend.stderr.on("data", data => logger.info({ service: "inventory" }, data.toString().trim()));
backend.on("error", err => { logger.fatal({ err }, "Unable to start inventory backend"); process.exit(1); });
let stopping = false;
backend.on("exit", code => {
  if (!stopping) {
    logger.fatal({ code }, "Inventory backend exited unexpectedly");
    process.exit(1);
  }
});
process.on("exit", () => backend.kill("SIGTERM"));

async function waitForBackend() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:8000/health", { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch { /* The child process is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Inventory backend did not become healthy.");
}

await waitForBackend();
const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    stopping = true;
    backend.kill("SIGTERM");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
