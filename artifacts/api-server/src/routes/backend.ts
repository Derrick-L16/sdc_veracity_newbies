import { Router } from "express";

// Preserve the imported API contract and its existing Python/SQLite business logic.
const router = Router();

router.use(async (req, res): Promise<void> => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  const path = req.path.split("/").filter(Boolean);
  if (!path.length || path.some(part => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    res.status(400).json({ error: "Invalid path." });
    return;
  }
  if (req.method === "POST") {
    const origin = req.get("origin");
    // Replit terminates TLS at the shared proxy.
    const protocol = req.get("x-forwarded-proto")?.split(",")[0].trim() || req.protocol;
    const host = req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host");
    if (!origin || origin !== `${protocol}://${host}`) {
      res.status(403).json({ error: "Untrusted request origin." });
      return;
    }
  }
  try {
    const upstream = await fetch(`http://127.0.0.1:8000/${path.join("/")}`, {
      method: req.method,
      headers: { "Content-Type": "application/json", Cookie: req.get("cookie") || "" },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    res.set("Cache-Control", "no-store");
    const cookie = upstream.headers.get("set-cookie");
    if (cookie) {
      const secure = req.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || req.secure;
      res.set("Set-Cookie", cookie + (secure ? "; Secure" : ""));
    }
    res.status(upstream.status).type("json").send(await upstream.text());
  } catch (error) {
    req.log.error({ err: error }, "Inventory backend unavailable");
    res.status(503).json({ error: "Inventory backend unavailable. Please retry." });
  }
});

export default router;
