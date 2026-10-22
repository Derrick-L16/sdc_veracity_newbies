import express, { type Express } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Exists only on the dedicated test instance; does not expose database paths.
if (process.env.VERACITY_E2E === "1") {
  app.get("/api/__test/isolation", (_req, res) => {
    res.json({ token: process.env.VERACITY_E2E_TOKEN, storage: "local" });
  });
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: 2000000 }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
