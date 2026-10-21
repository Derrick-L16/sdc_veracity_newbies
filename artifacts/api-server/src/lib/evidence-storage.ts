import { Storage, type File } from "@google-cloud/storage";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { createHash } from "node:crypto";
import { EvidenceError } from "./evidence-error.ts";
import { localEvidenceEnabled, localBytes, localExists, saveLocalBytes, removeLocalStaging } from "./local-evidence-storage.ts";
export { EvidenceError } from "./evidence-error.ts";

// Replit sidecar authentication, identical to the App Storage service template.
const sidecar = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecar}/token`,
    type: "external_account",
    credential_source: {
      url: `${sidecar}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export const MAX_SIZE = 10 * 1024 * 1024;
export interface UploadTicket {
  id: string; stagingKey: string; objectKey: string; size: number;
  contentType: string; finalized?: boolean;
}

export function evidenceFile(key: string): File {
  // Never resolve client-provided paths or arbitrary bucket locations.
  if (!/^(evidence-staging|case-evidence)\/[a-f0-9]{32}$/.test(key)) throw new EvidenceError("Invalid storage identifier.");
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new EvidenceError("Private evidence storage is not configured. Ask an administrator to set up App Storage.", 503);
  const [bucket, ...prefix] = dir.replace(/^\/+|\/+$/g, "").split("/");
  if (!bucket || !prefix.length) throw new EvidenceError("Private storage configuration is invalid.", 503);
  return storage.bucket(bucket).file([...prefix, key].join("/"));
}

export async function uploadURL(ticket: UploadTicket) {
  const file = evidenceFile(ticket.stagingKey);
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket_name: file.bucket.name, object_name: file.name, method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new EvidenceError("Private storage is unavailable. Retry the upload.", 503);
  const result = await response.json() as { signed_url: string };
  return result.signed_url;
}

// Read at most the configured limit even if a forged object reports a smaller size.
async function boundedBytes(file: File): Promise<Buffer> {
  const stream = file.createReadStream();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_SIZE) { stream.destroy(); throw new EvidenceError("Stored file exceeds 10 MB. Choose a smaller file.", 413); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function verifyBytes(bytes: Buffer, contentType: string) {
  try {
    if (contentType === "application/pdf") {
      if (!bytes.subarray(0, 8).toString("ascii").startsWith("%PDF-") ||
          !bytes.subarray(-1024).toString("ascii").includes("%%EOF")) throw new Error();
      const pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true });
      if (!pdf.getPageCount()) throw new Error();
    } else {
      const expected = contentType === "image/jpeg" ? "jpeg" : contentType === "image/png" ? "png" : "";
      if (!expected) throw new Error();
      const image = sharp(bytes, { failOn: "warning", limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (metadata.format !== expected) throw new Error();
      await image.raw().toBuffer(); // Decode the actual image, not just its claimed MIME or magic bytes.
    }
  } catch {
    throw new EvidenceError("File contents are invalid or do not match the selected JPEG, PNG or PDF type. Export a valid file and try again.");
  }
}

export async function verifyAndPreserve(ticket: UploadTicket): Promise<string> {
  if (localEvidenceEnabled()) {
    const exists = await localExists(ticket.objectKey);
    const bytes = await localBytes(exists ? ticket.objectKey : ticket.stagingKey, MAX_SIZE);
    if (bytes.length !== ticket.size) throw new EvidenceError("Incomplete upload. Retry the original file.", 413);
    await verifyBytes(bytes, ticket.contentType);
    if (!exists) {
      await saveLocalBytes(ticket.objectKey, bytes, true);
      // Hash the actual winning immutable file if another finalize ran concurrently.
      return verifyAndPreserve(ticket);
    }
    return createHash("sha256").update(bytes).digest("hex");
  }
  const final = evidenceFile(ticket.objectKey);
  const staged = evidenceFile(ticket.stagingKey);
  // A retry after a lost response must reuse the already-preserved immutable object.
  const [exists] = await final.exists();
  let source = final;
  if (!exists) {
    const [metadata] = await staged.getMetadata();
    if (Number(metadata.size) !== ticket.size || Number(metadata.size) > MAX_SIZE) {
      await staged.delete({ ignoreNotFound: true });
      throw new EvidenceError("Stored file size does not match the selected file or exceeds 10 MB. Retry with the original file.", 413);
    }
    // Pin a generation so a still-valid PUT URL cannot swap bytes during verification/copy.
    source = staged.bucket.file(staged.name, { generation: metadata.generation });
  }
  const bytes = await boundedBytes(source);
  if (bytes.length !== ticket.size) throw new EvidenceError("Incomplete upload. Retry the original file.");
  await verifyBytes(bytes, ticket.contentType);
  if (!exists) {
    try {
      await source.copy(final, { preconditionOpts: { ifGenerationMatch: 0 } });
    } catch (error) {
      if ((error as { code?: number }).code !== 412) throw error;
      // Another finalize won the race. Verify exactly what it preserved.
      return verifyAndPreserve(ticket);
    }
  }
  return createHash("sha256").update(bytes).digest("hex");
}

export async function removeStaging(ticket: UploadTicket) {
  if (localEvidenceEnabled()) { await removeLocalStaging(ticket.stagingKey); return; }
  await evidenceFile(ticket.stagingKey).delete({ ignoreNotFound: true });
}
