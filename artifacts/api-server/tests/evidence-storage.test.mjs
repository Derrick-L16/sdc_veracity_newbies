import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { verifyBytes, evidenceFile, EvidenceError } from "../dist/test/evidence-storage.mjs";

test("actual image decoding accepts JPEG and PNG, rejects MIME spoofing and truncation", async () => {
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
  const jpeg = await sharp(png).jpeg().toBuffer();
  await verifyBytes(png, "image/png");
  await verifyBytes(jpeg, "image/jpeg");
  for (const [bytes, mime] of [[png, "image/jpeg"], [jpeg, "image/png"],
    [png.subarray(0, 35), "image/png"], [jpeg.subarray(0, 20), "image/jpeg"],
    [Buffer.from("<script>alert(1)</script>"), "image/png"]]) {
    await assert.rejects(verifyBytes(bytes, mime), EvidenceError);
  }
});

test("PDF must parse as a real document, not just a matching signature or MIME", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  const bytes = Buffer.from(await pdf.save());
  await verifyBytes(bytes, "application/pdf");
  await assert.rejects(verifyBytes(Buffer.from("%PDF-1.7\nnot a document\n%%EOF"), "application/pdf"), EvidenceError);
  await assert.rejects(verifyBytes(bytes.subarray(0, 40), "application/pdf"), EvidenceError);
  await assert.rejects(verifyBytes(bytes, "text/csv"), EvidenceError);
});

test("client-controlled public or traversal object paths cannot be resolved", () => {
  for (const key of ["../public/file", "public/photo.png", "case-evidence/../../file",
    "/bucket/file", "case-evidence/non-generated-id"]) {
    assert.throws(() => evidenceFile(key), EvidenceError);
  }
});
