import { mkdir, readFile, writeFile, copyFile, unlink, stat } from "node:fs/promises";
import { createReadStream, constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EvidenceError } from "./evidence-error.ts";

// Explicit development mode only. Missing cloud configuration never selects this.
export function localEvidenceEnabled() {
  const mode = process.env.VERACITY_STORAGE ?? "replit";
  if (mode !== "local" && mode !== "replit") throw new EvidenceError("Unknown evidence storage mode.", 503);
  if (mode === "local" && process.env.NODE_ENV !== "development") {
    throw new EvidenceError("Local evidence storage is allowed only in development.", 503);
  }
  return mode === "local";
}

function filename(key: string) {
  if (!localEvidenceEnabled()) throw new EvidenceError("Local evidence storage is disabled.", 404);
  if (!/^(evidence-staging|case-evidence)\/[a-f0-9]{32}$/.test(key)) {
    throw new EvidenceError("Invalid storage identifier.");
  }
  const root = path.resolve(process.env.VERACITY_LOCAL_UPLOAD_DIR ?? ".veracity-local/evidence");
  return path.join(root, ...key.split("/"));
}

export async function localBytes(key: string, max: number) {
  const file = filename(key);
  const metadata = await stat(file).catch(() => { throw new EvidenceError("Upload file not found. Retry the original file.", 404); });
  if (metadata.size > max) throw new EvidenceError("Stored file exceeds 10 MB.", 413);
  // Bound the read itself, not just a size reported before a concurrent replacement.
  const stream = createReadStream(file);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > max) { stream.destroy(); throw new EvidenceError("Stored file exceeds 10 MB.", 413); }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function localExists(key: string) {
  try { await stat(filename(key)); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

export async function saveLocalBytes(key: string, bytes: Buffer, immutable = false) {
  const final = filename(key);
  await mkdir(path.dirname(final), { recursive: true, mode: 0o700 });
  const temp = `${final}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
    if (immutable) {
      // Exclusive copy also works on filesystems that don't support hard links.
      // Incomplete reads during a concurrent copy fail validation and may be retried.
      try { await copyFile(temp, final, constants.COPYFILE_EXCL); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    } else {
      // Staging is also create-only: retries may resend the exact same bytes.
      try { await copyFile(temp, final, constants.COPYFILE_EXCL); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (!(await readFile(final)).equals(bytes)) throw new EvidenceError("Upload already contains different bytes. Select the original file again.", 409);
      }
    }
  } finally { await unlink(temp).catch(() => {}); }
}

export async function removeLocalStaging(key: string) {
  if (!key.startsWith("evidence-staging/")) throw new EvidenceError("Only staged uploads may be removed.");
  await unlink(filename(key)).catch(error => { if (error.code !== "ENOENT") throw error; });
}

export async function localMetadata(key: string) { return stat(filename(key)); }
export function localReadStream(key: string) { return createReadStream(filename(key)); }
