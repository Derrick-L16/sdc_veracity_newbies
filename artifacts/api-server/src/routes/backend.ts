import { Router, type IRouter } from "express";
import { getBackendUrl } from "../lib/python-backend";

const router: IRouter = Router();

// Retain the original Next proxy contract and keep all domain validation,
// role permissions, transactions and persistence in the existing Python API.
router.all("/backend/*path", async (req, res): Promise<void> => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  const segments = req.path.slice("/backend/".length).split("/");
  if (segments.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    res.status(400).json({ error: "Invalid path." });
    return;
  }
  // The shared reverse proxy terminates HTTPS. Use its forwarded host and
  // protocol to compare the browser's exact origin, rather than localhost.
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  if (req.method === "POST") {
    const expected = process.env.APP_ORIGIN || `${protocol}://${host}`;
    if (!req.get("origin") || req.get("origin") !== expected) {
      res.status(403).json({ error: "Untrusted request origin." });
      return;
    }
  }
  try {
    const response = await fetch(`${getBackendUrl()}/${segments.join("/")}`, {
      method: req.method,
      headers: { "Content-Type": "application/json", Cookie: req.get("cookie") || "" },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    res.set("Content-Type", "application/json");
    res.set("Cache-Control", "no-store");
    const cookie = response.headers.get("set-cookie");
    if (cookie) res.set("Set-Cookie", cookie + (protocol === "https" ? "; Secure" : ""));
    res.status(response.status).send(await response.text());
  } catch (error) {
    req.log.error({ err: error }, "Inventory backend unavailable");
    res.status(503).json({ error: "Inventory backend unavailable. Please retry." });
  }
});

export default router;
