// src/app.ts
import express from "express";
import pinoHttp from "pino-http";

// src/routes/index.ts
import { Router as Router4 } from "express";

// src/routes/health.ts
import { Router } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
var router = Router();
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});
var health_default = router;

// src/routes/backend.ts
import { Router as Router2 } from "express";

// src/lib/python-backend.ts
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

// src/lib/logger.ts
import pino from "pino";
var isProduction = process.env.NODE_ENV === "production";
var logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']"
  ],
  ...isProduction ? {} : {
    transport: {
      target: "pino-pretty",
      options: { colorize: true }
    }
  }
});

// src/lib/python-backend.ts
import { randomBytes } from "node:crypto";
var evidenceBridge = randomBytes(32).toString("hex");
var backendUrl = "";
var child;
function getBackendUrl() {
  if (!backendUrl) throw new Error("Inventory backend is not ready.");
  return backendUrl;
}
async function startBackend() {
  const port2 = await new Promise((resolve, reject) => {
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
  backendUrl = `http://127.0.0.1:${port2}`;
  const pythonArgs = JSON.parse(process.env.VERACITY_PYTHON_ARGS ?? "[]");
  child = spawn(process.env.PYTHON_EXECUTABLE || "python3", [
    ...pythonArgs,
    fileURLToPath(new URL("../backend/server.py", import.meta.url)),
    "--port",
    String(port2)
  ], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, VERACITY_EVIDENCE_BRIDGE: evidenceBridge } });
  child.stdout?.on("data", (message) => logger.info({ service: "inventory" }, String(message).trim()));
  child.stderr?.on("data", (message) => logger.info({ service: "inventory" }, String(message).trim()));
  let failure2;
  child.on("error", (error) => {
    failure2 = error;
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    logger.error({ code, signal }, "Inventory backend stopped unexpectedly");
    process.exit(1);
  });
  process.once("exit", () => child?.kill());
  for (let attempt = 0; attempt < 100; attempt++) {
    if (failure2) throw failure2;
    try {
      const response = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error("Inventory backend failed to start.");
}
var stopping = false;
function stopBackend() {
  stopping = true;
  child?.kill();
}

// src/routes/backend.ts
var router2 = Router2();
router2.all("/backend/*path", async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  const segments = req.path.slice("/backend/".length).split("/");
  if (segments[0] === "evidence") {
    res.status(404).json({ error: "Endpoint not found." });
    return;
  }
  if (segments.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    res.status(400).json({ error: "Invalid path." });
    return;
  }
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
    const query = segments.join("/") === "reports/weekly" && req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    const response = await fetch(`${getBackendUrl()}/${segments.join("/")}${query}`, {
      method: req.method,
      headers: { "Content-Type": "application/json", Cookie: req.get("cookie") || "" },
      body: req.method === "POST" ? JSON.stringify(req.body) : void 0,
      signal: AbortSignal.timeout(15e3)
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
var backend_default = router2;

// src/routes/evidence.ts
import { Router as Router3, raw } from "express";

// src/lib/evidence-storage.ts
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { createHash } from "node:crypto";

// src/lib/evidence-error.ts
var EvidenceError = class extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};

// src/lib/local-evidence-storage.ts
import { mkdir, readFile, writeFile, copyFile, unlink, stat } from "node:fs/promises";
import { createReadStream, constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
function localEvidenceEnabled() {
  const mode = process.env.VERACITY_STORAGE ?? "replit";
  if (mode !== "local" && mode !== "replit") throw new EvidenceError("Unknown evidence storage mode.", 503);
  if (mode === "local" && process.env.NODE_ENV !== "development") {
    throw new EvidenceError("Local evidence storage is allowed only in development.", 503);
  }
  return mode === "local";
}
function filename(key) {
  if (!localEvidenceEnabled()) throw new EvidenceError("Local evidence storage is disabled.", 404);
  if (!/^(evidence-staging|case-evidence)\/[a-f0-9]{32}$/.test(key)) {
    throw new EvidenceError("Invalid storage identifier.");
  }
  const root = path.resolve(process.env.VERACITY_LOCAL_UPLOAD_DIR ?? ".veracity-local/evidence");
  return path.join(root, ...key.split("/"));
}
async function localBytes(key, max) {
  const file = filename(key);
  const metadata = await stat(file).catch(() => {
    throw new EvidenceError("Upload file not found. Retry the original file.", 404);
  });
  if (metadata.size > max) throw new EvidenceError("Stored file exceeds 10 MB.", 413);
  const stream = createReadStream(file);
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > max) {
      stream.destroy();
      throw new EvidenceError("Stored file exceeds 10 MB.", 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function localExists(key) {
  try {
    await stat(filename(key));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function saveLocalBytes(key, bytes, immutable = false) {
  const final = filename(key);
  await mkdir(path.dirname(final), { recursive: true, mode: 448 });
  const temp = `${final}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: "wx", mode: 384 });
    if (immutable) {
      try {
        await copyFile(temp, final, constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    } else {
      try {
        await copyFile(temp, final, constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (!(await readFile(final)).equals(bytes)) throw new EvidenceError("Upload already contains different bytes. Select the original file again.", 409);
      }
    }
  } finally {
    await unlink(temp).catch(() => {
    });
  }
}
async function removeLocalStaging(key) {
  if (!key.startsWith("evidence-staging/")) throw new EvidenceError("Only staged uploads may be removed.");
  await unlink(filename(key)).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}
async function localMetadata(key) {
  return stat(filename(key));
}
function localReadStream(key) {
  return createReadStream(filename(key));
}

// src/lib/evidence-storage.ts
var sidecar = "http://127.0.0.1:1106";
var storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecar}/token`,
    type: "external_account",
    credential_source: {
      url: `${sidecar}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" }
    },
    universe_domain: "googleapis.com"
  },
  projectId: ""
});
var MAX_SIZE = 10 * 1024 * 1024;
function evidenceFile(key) {
  if (!/^(evidence-staging|case-evidence)\/[a-f0-9]{32}$/.test(key)) throw new EvidenceError("Invalid storage identifier.");
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new EvidenceError("Private evidence storage is not configured. Ask an administrator to set up App Storage.", 503);
  const [bucket, ...prefix] = dir.replace(/^\/+|\/+$/g, "").split("/");
  if (!bucket || !prefix.length) throw new EvidenceError("Private storage configuration is invalid.", 503);
  return storage.bucket(bucket).file([...prefix, key].join("/"));
}
async function uploadURL(ticket) {
  const file = evidenceFile(ticket.stagingKey);
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: file.bucket.name,
      object_name: file.name,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1e3).toISOString()
    }),
    signal: AbortSignal.timeout(3e4)
  });
  if (!response.ok) throw new EvidenceError("Private storage is unavailable. Retry the upload.", 503);
  const result = await response.json();
  return result.signed_url;
}
async function boundedBytes(file) {
  const stream = file.createReadStream();
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_SIZE) {
      stream.destroy();
      throw new EvidenceError("Stored file exceeds 10 MB. Choose a smaller file.", 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function verifyBytes(bytes, contentType) {
  try {
    if (contentType === "application/pdf") {
      if (!bytes.subarray(0, 8).toString("ascii").startsWith("%PDF-") || !bytes.subarray(-1024).toString("ascii").includes("%%EOF")) throw new Error();
      const pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true });
      if (!pdf.getPageCount()) throw new Error();
    } else {
      const expected = contentType === "image/jpeg" ? "jpeg" : contentType === "image/png" ? "png" : "";
      if (!expected) throw new Error();
      const image = sharp(bytes, { failOn: "warning", limitInputPixels: 4e7 });
      const metadata = await image.metadata();
      if (metadata.format !== expected) throw new Error();
      await image.raw().toBuffer();
    }
  } catch {
    throw new EvidenceError("File contents are invalid or do not match the selected JPEG, PNG or PDF type. Export a valid file and try again.");
  }
}
async function verifyAndPreserve(ticket) {
  if (localEvidenceEnabled()) {
    const exists2 = await localExists(ticket.objectKey);
    const bytes2 = await localBytes(exists2 ? ticket.objectKey : ticket.stagingKey, MAX_SIZE);
    if (bytes2.length !== ticket.size) throw new EvidenceError("Incomplete upload. Retry the original file.", 413);
    await verifyBytes(bytes2, ticket.contentType);
    if (!exists2) {
      await saveLocalBytes(ticket.objectKey, bytes2, true);
      return verifyAndPreserve(ticket);
    }
    return createHash("sha256").update(bytes2).digest("hex");
  }
  const final = evidenceFile(ticket.objectKey);
  const staged = evidenceFile(ticket.stagingKey);
  const [exists] = await final.exists();
  let source = final;
  if (!exists) {
    const [metadata] = await staged.getMetadata();
    if (Number(metadata.size) !== ticket.size || Number(metadata.size) > MAX_SIZE) {
      await staged.delete({ ignoreNotFound: true });
      throw new EvidenceError("Stored file size does not match the selected file or exceeds 10 MB. Retry with the original file.", 413);
    }
    source = staged.bucket.file(staged.name, { generation: metadata.generation });
  }
  const bytes = await boundedBytes(source);
  if (bytes.length !== ticket.size) throw new EvidenceError("Incomplete upload. Retry the original file.");
  await verifyBytes(bytes, ticket.contentType);
  if (!exists) {
    try {
      await source.copy(final, { preconditionOpts: { ifGenerationMatch: 0 } });
    } catch (error) {
      if (error.code !== 412) throw error;
      return verifyAndPreserve(ticket);
    }
  }
  return createHash("sha256").update(bytes).digest("hex");
}
async function removeStaging(ticket) {
  if (localEvidenceEnabled()) {
    await removeLocalStaging(ticket.stagingKey);
    return;
  }
  await evidenceFile(ticket.stagingKey).delete({ ignoreNotFound: true });
}

// src/routes/evidence.ts
import { RequestCaseEvidenceUploadBody, RequestCaseEvidenceUploadResponse, FinalizeCaseEvidenceUploadResponse } from "@workspace/api-zod";
var router3 = Router3();
async function domain(req, path2, body) {
  const response = await fetch(`${getBackendUrl()}/evidence/${path2}`, {
    method: body === void 0 ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Cookie: req.get("cookie") || "", "X-Evidence-Bridge": evidenceBridge },
    body: body === void 0 ? void 0 : JSON.stringify(body),
    signal: AbortSignal.timeout(15e3)
  });
  const data = await response.json();
  if (!response.ok) throw new EvidenceError(data.error || "Evidence request failed.", response.status);
  return data;
}
router3.use("/evidence", (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const segments = req.path.split("/").filter(Boolean);
  if (segments.some((p) => !/^[a-zA-Z0-9_-]+$/.test(p))) {
    res.status(400).json({ error: "Invalid evidence path." });
    return;
  }
  if (req.method === "POST" || req.method === "PUT") {
    const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
    const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
    if (req.get("origin") !== (process.env.APP_ORIGIN || `${protocol}://${host}`)) {
      res.status(403).json({ error: "Untrusted request origin." });
      return;
    }
  }
  next();
});
router3.post("/evidence/cases/:id/uploads", async (req, res) => {
  try {
    const parsed = RequestCaseEvidenceUploadBody.safeParse(req.body);
    if (!parsed.success) {
      throw new EvidenceError("Choose a JPEG, PNG or PDF up to 10 MB, with a description of at most 1000 characters.");
    }
    const ticket = await domain(req, `${req.params.id}/uploads`, parsed.data);
    const current = await domain(req, `${req.params.id}/uploads/${ticket.id}`);
    res.json(RequestCaseEvidenceUploadResponse.parse({
      id: ticket.id,
      finalized: !!current.finalized,
      ...!current.finalized && { uploadURL: localEvidenceEnabled() ? `/api/evidence/cases/${encodeURIComponent(String(req.params.id))}/uploads/${ticket.id}/bytes` : await uploadURL(ticket) }
    }));
  } catch (error) {
    failure(res, error);
  }
});
router3.put(
  "/evidence/cases/:id/uploads/:uploadId/bytes",
  async (req, res, next) => {
    try {
      if (!localEvidenceEnabled()) throw new EvidenceError("Local uploads are disabled.", 404);
      const ticket = await domain(req, `${req.params.id}/uploads/${req.params.uploadId}`);
      if (ticket.finalized) throw new EvidenceError("This upload is already finalized.", 409);
      res.locals.ticket = ticket;
      next();
    } catch (error) {
      failure(res, error);
    }
  },
  raw({ type: ["image/jpeg", "image/png", "application/pdf"], limit: MAX_SIZE }),
  async (req, res) => {
    try {
      const ticket = res.locals.ticket;
      if (req.get("content-type")?.split(";")[0] !== ticket.contentType || !Buffer.isBuffer(req.body) || req.body.length !== ticket.size) {
        throw new EvidenceError("Uploaded bytes do not match the selected file type or size.", 400);
      }
      await saveLocalBytes(ticket.stagingKey, req.body);
      res.status(204).end();
    } catch (error) {
      failure(res, error);
    }
  }
);
router3.post("/evidence/cases/:id/uploads/:uploadId/finalize", async (req, res) => {
  try {
    const path2 = `${req.params.id}/uploads/${req.params.uploadId}`;
    const ticket = await domain(req, path2);
    const sha256 = ticket.finalized ? void 0 : await verifyAndPreserve(ticket);
    const attachment = await domain(req, `${path2}/finalize`, { sha256 });
    void removeStaging(ticket).catch(() => {
    });
    res.json(FinalizeCaseEvidenceUploadResponse.parse(attachment));
  } catch (error) {
    failure(res, error);
  }
});
router3.get("/evidence/cases/:id/attachments/:attachmentId", async (req, res) => {
  try {
    const version = req.query.version === void 0 ? void 0 : Number(req.query.version);
    if (version !== void 0 && (!Number.isInteger(version) || version < 1)) throw new EvidenceError("Invalid assessment version.");
    const attachment = await domain(
      req,
      `${req.params.id}/attachments/${req.params.attachmentId}`,
      { version }
    );
    const local = localEvidenceEnabled();
    const file = local ? void 0 : evidenceFile(attachment.objectKey);
    if (local) await localMetadata(attachment.objectKey);
    else await file.getMetadata();
    res.set({
      "Content-Type": attachment.contentType,
      "Content-Disposition": `${attachment.contentType === "application/pdf" ? "attachment" : "inline"}; filename="${attachment.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Content-Length": String(attachment.size)
    });
    const stream = local ? localReadStream(attachment.objectKey) : file.createReadStream();
    stream.on("error", () => {
      if (!res.headersSent) failure(res, new EvidenceError("File temporarily unavailable. Please retry.", 503));
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    failure(res, error);
  }
});
router3.use((error, _req, res, _next) => {
  if (error.type === "entity.too.large") {
    failure(res, new EvidenceError("File exceeds 10 MB. Choose a smaller file.", 413));
  } else failure(res, error);
});
function failure(res, error) {
  const known = error instanceof EvidenceError;
  res.status(known ? error.status : 503).json({ error: known ? error.message : "Private evidence storage is temporarily unavailable. Retry safely; no duplicate attachment will be created." });
}
var evidence_default = router3;

// src/routes/index.ts
var router4 = Router4();
router4.use(health_default);
router4.use(evidence_default);
router4.use(backend_default);
var routes_default = router4;

// src/app.ts
var app = express();
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0]
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode
        };
      }
    }
  })
);
app.use(express.json({ limit: 2e6 }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", routes_default);
var app_default = app;

// src/index.ts
var rawPort = process.env["PORT"] || "5000";
var port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
localEvidenceEnabled();
await startBackend();
var server = app_default.listen(port, process.env.VERACITY_LOCAL_DEV === "1" ? "127.0.0.1" : "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    stopBackend();
    server.close(() => process.exit(0));
  });
}
