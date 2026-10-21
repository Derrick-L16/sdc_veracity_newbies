import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { logger } from "./logger";
import { randomBytes } from "node:crypto";

// Per-process capability, never sent to the browser or logged.
export const evidenceBridge = randomBytes(32).toString("hex");

let backendUrl = "";
let child: ChildProcess | undefined;

export function getBackendUrl() {
  if (!backendUrl) throw new Error("Inventory backend is not ready.");
  return backendUrl;
}

export async function startBackend() {
  // Allocate a private port without exposing the original SQLite service publicly.
  const port = await new Promise<number>((resolve, reject) => {
    const reservation = createServer();
    reservation.on("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      if (!address || typeof address === "string") {
        reservation.close();
        reject(new Error("Could not allocate inventory backend port."));
        return;
      }
      reservation.close(() => resolve(address.port));
    });
  });
  backendUrl = `http://127.0.0.1:${port}`;
  child = spawn("python3", [
    fileURLToPath(new URL("../backend/server.py", import.meta.url)),
    "--port", String(port),
  ], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, VERACITY_EVIDENCE_BRIDGE: evidenceBridge } });
  child.stdout?.on("data", (message) => logger.info({ service: "inventory" }, String(message).trim()));
  child.stderr?.on("data", (message) => logger.info({ service: "inventory" }, String(message).trim()));
  let failure: Error | undefined;
  child.on("error", (error) => { failure = error; });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    logger.error({ code, signal }, "Inventory backend stopped unexpectedly");
    process.exit(1);
  });
  process.once("exit", () => child?.kill());
  for (let attempt = 0; attempt < 100; attempt++) {
    if (failure) throw failure;
    try {
      const response = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch { /* Wait for Python to initialize its database. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error("Inventory backend failed to start.");
}

let stopping = false;
export function stopBackend() {
  stopping = true;
  child?.kill();
}
