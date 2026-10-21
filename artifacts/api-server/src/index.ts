import app from "./app";
import { logger } from "./lib/logger";
import { startBackend, stopBackend } from "./lib/python-backend";

const rawPort = process.env["PORT"] || "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await startBackend();

const server = app.listen(port, (err) => {
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
