import express, { type Express } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import backendRouter from "./routes/backend";

const app: Express = express();

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
app.use(express.json({ limit: 2_000_000 }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api/backend", backendRouter);

export default app;
