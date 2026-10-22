import app from "./app";
import { logger } from "./lib/logger";
import { startBackend, stopBackend } from "./lib/python-backend";
import { localEvidenceEnabled } from "./lib/local-evidence-storage";

const rawPort = process.env["PORT"] || "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

localEvidenceEnabled(); // Reject local-file storage in production before opening a port.
await startBackend();

const server = app.listen(port, process.env.VERACITY_LOCAL_DEV === "1" ? "127.0.0.1" : "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    stopBackend();
    server.close(() => process.exit(0));
  });
}
