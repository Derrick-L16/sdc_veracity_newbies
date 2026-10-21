import { Router, type IRouter, type Request } from "express";
import { getBackendUrl, evidenceBridge } from "../lib/python-backend";
import { EvidenceError, evidenceFile, removeStaging, uploadURL, verifyAndPreserve, type UploadTicket } from "../lib/evidence-storage";
import { RequestCaseEvidenceUploadBody, RequestCaseEvidenceUploadResponse, FinalizeCaseEvidenceUploadResponse } from "@workspace/api-zod";

const router: IRouter = Router();

async function domain<T>(req: Request, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getBackendUrl()}/evidence/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Cookie: req.get("cookie") || "", "X-Evidence-Bridge": evidenceBridge },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new EvidenceError((data as { error?: string }).error || "Evidence request failed.", response.status);
  return data as T;
}

router.use("/evidence", (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const segments = req.path.split("/").filter(Boolean);
  if (segments.some(p => !/^[a-zA-Z0-9_-]+$/.test(p))) {
    res.status(400).json({ error: "Invalid evidence path." }); return;
  }
  if (req.method === "POST") {
    const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
    const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
    if (req.get("origin") !== (process.env.APP_ORIGIN || `${protocol}://${host}`)) {
      res.status(403).json({ error: "Untrusted request origin." }); return;
    }
  }
  next();
});

router.post("/evidence/cases/:id/uploads", async (req, res): Promise<void> => {
  try {
    const parsed = RequestCaseEvidenceUploadBody.safeParse(req.body);
    if (!parsed.success) {
      throw new EvidenceError("Choose a JPEG, PNG or PDF up to 10 MB, with a description of at most 1000 characters.");
    }
    const ticket = await domain<UploadTicket>(req, `${req.params.id}/uploads`, parsed.data);
    // Returning no storage URL after finalization prevents replacement of saved evidence.
    const current = await domain<UploadTicket>(req, `${req.params.id}/uploads/${ticket.id}`);
    res.json(RequestCaseEvidenceUploadResponse.parse({
      id: ticket.id, finalized: !!current.finalized,
      ...(!current.finalized && { uploadURL: await uploadURL(ticket) }),
    }));
  } catch (error) { failure(res, error); }
});

router.post("/evidence/cases/:id/uploads/:uploadId/finalize", async (req, res): Promise<void> => {
  try {
    const path = `${req.params.id}/uploads/${req.params.uploadId}`;
    const ticket = await domain<UploadTicket>(req, path);
    const sha256 = ticket.finalized ? undefined : await verifyAndPreserve(ticket);
    const attachment = await domain(req, `${path}/finalize`, { sha256 });
    // Cleanup is best-effort only after the durable link has committed.
    void removeStaging(ticket).catch(() => {});
    res.json(FinalizeCaseEvidenceUploadResponse.parse(attachment));
  } catch (error) { failure(res, error); }
});

router.get("/evidence/cases/:id/attachments/:attachmentId", async (req, res): Promise<void> => {
  try {
    const version = req.query.version === undefined ? undefined : Number(req.query.version);
    if (version !== undefined && (!Number.isInteger(version) || version < 1)) throw new EvidenceError("Invalid assessment version.");
    const attachment = await domain<{ objectKey: string; contentType: string; filename: string; size: number }>(
      req, `${req.params.id}/attachments/${req.params.attachmentId}`, { version });
    const file = evidenceFile(attachment.objectKey);
    // Authorize first, including closed cases and historical snapshot membership.
    await file.getMetadata();
    res.set({
      "Content-Type": attachment.contentType,
      "Content-Disposition": `${attachment.contentType === "application/pdf" ? "attachment" : "inline"}; filename="${attachment.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Content-Length": String(attachment.size),
    });
    const stream = file.createReadStream();
    stream.on("error", () => { if (!res.headersSent) failure(res, new EvidenceError("File temporarily unavailable. Please retry.", 503)); else res.destroy(); });
    stream.pipe(res);
  } catch (error) { failure(res, error); }
});

function failure(res: import("express").Response, error: unknown) {
  // Do not log GCS errors: they can contain signed URLs or credentials.
  const known = error instanceof EvidenceError;
  res.status(known ? error.status : 503).json({ error: known ? error.message : "Private evidence storage is temporarily unavailable. Retry safely; no duplicate attachment will be created." });
}
export default router;
