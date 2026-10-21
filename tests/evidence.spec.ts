import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";

const requireServer = createRequire(path.resolve("artifacts/api-server/package.json"));
const { PDFDocument } = requireServer("pdf-lib");
const sharp = requireServer("sharp");
const origin = { Origin: "http://localhost" };

test("private evidence upload, retry, stale review, historical snapshots and Passport", async ({ page, context, playwright }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const api = context.request;
  const post = (path: string, data: unknown = {}) => api.post(path, { data, headers: origin });
  const role = async (value: string) => { expect((await post("/api/backend/session", { role: value })).ok()).toBeTruthy(); };
  await role("manager");
  const id = `evidence-${Date.now()}`;
  expect((await post("/api/backend/imports", { kind: "products", rows: [
    { id, name: `Evidence test ${id}`, recorded: 50 },
    { id: `${id}-other`, name: `Manager evidence test ${id}`, recorded: 12 },
  ] })).ok()).toBeTruthy();
  const other = await (await post("/api/backend/counts", { productId: `${id}-other`, counted: 10 })).json();
  await role("staff");
  const c = await (await post("/api/backend/counts", { productId: id, counted: 43 })).json();
  const base = `/api/evidence/cases/${c.id}`;
  const metadata = { filename: "receipt.pdf", contentType: "application/pdf", size: 200, description: "", version: 1, requestKey: crypto.randomUUID() };
  expect((await post(`/api/evidence/cases/${other.id}/uploads`, metadata)).status()).toBe(404);
  const anonymous = await playwright.request.newContext({ baseURL: "http://localhost:80" });
  expect((await anonymous.post(`${base}/uploads`, { data: metadata, headers: origin })).status()).toBe(401);
  await anonymous.dispose();
  expect((await post("/api/backend/evidence/anything/uploads", metadata)).status()).toBe(404);
  expect((await post(`${base}/uploads`, { ...metadata, size: 10485761 })).ok()).toBeFalsy();
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]).drawText("Evidence receipt for human review");
  const pdfBytes = Buffer.from(await pdf.save());
  const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: "#448866" } }).png().toBuffer();
  const jpeg = await sharp(png).jpeg().toBuffer();
  await page.goto(`/cases/${c.id}`);
  await expect(page.getByRole("heading", { name: "Case documents" })).toBeVisible();
  await page.getByLabel("Evidence file", { exact: true }).setInputFiles({ name: "damage.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("Description (optional)").fill("Damage photo for manual review");
  // Lose a successful finalize response once; retry must return the same saved attachment.
  let loseResponse = true;
  await page.route("**/uploads/*/finalize", async route => {
    if (loseResponse) {
      loseResponse = false;
      const result = await route.fetch();
      expect(result.status()).toBe(200);
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Connection interrupted. Retry upload." }) });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Upload evidence", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry upload", exact: true })).toBeEnabled({ timeout: 30000 });
  await page.getByRole("button", { name: "Retry upload", exact: true }).click();
  await expect(page.getByRole("link", { name: "damage.png — Open image" })).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(page.getByRole("img", { name: "Evidence: Damage photo for manual review" })).toBeVisible();
  expect(await page.getByRole("img", { name: "Evidence: Damage photo for manual review" }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(12);
  let state = await (await api.get("/api/backend/state")).json();
  expect(state.cases.find((item: { id: string }) => item.id === c.id).attachments).toHaveLength(1);
  expect(state.products.find((item: { id: string }) => item.id === id).recorded).toBe(50);
  expect(state.cases.find((item: { id: string }) => item.id === c.id).versions[0].evidenceState).toBe("incomplete");
  await role("manager");
  await page.reload();
  await page.getByRole("button", { name: "Override with reason", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("dialog").getByRole("textbox").fill("Manager reviewed the count");
  // Upload a PDF from a second view while the manager's decision dialog is open.
  const second = await context.newPage();
  await second.goto(`/cases/${c.id}`);
  await second.getByLabel("Evidence file", { exact: true }).setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await second.getByLabel("Description (optional)").fill("Supporting receipt");
  await second.getByRole("button", { name: "Upload evidence", exact: true }).click();
  await expect(second.getByRole("link", { name: "receipt.pdf — Download PDF" })).toBeVisible({ timeout: 30000 });
  const stale = page.waitForResponse(r => r.url().endsWith(`/cases/${c.id}/decisions`) && r.status() === 409);
  await page.getByRole("button", { name: "Confirm override", exact: true }).click();
  await stale;
  await expect(page.getByText("Documents changed. Refresh the case and review all attachments before deciding.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  const pdfLink = second.getByRole("link", { name: "receipt.pdf — Download PDF" });
  const pdfHref = (await pdfLink.getAttribute("href"))!;
  const download = await api.get(pdfHref);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(Buffer.compare(await download.body(), pdfBytes)).toBe(0);
  const firstPhoto = (await (await api.get("/api/backend/state")).json()).cases.find((item: { id: string }) => item.id === c.id).attachments[0];
  // Spoofed file and mismatched/oversized stored bytes never produce attachments.
  async function stage(data: Buffer, name: string, type: string, declaredSize = data.length) {
    const response = await post(`${base}/uploads`, { ...metadata, requestKey: crypto.randomUUID(), filename: name, contentType: type, size: declaredSize });
    expect(response.status()).toBe(200);
    const ticket = await response.json();
    const transferred = await api.put(ticket.uploadURL, { data, headers: { "Content-Type": type } });
    expect(transferred.ok()).toBeTruthy();
    return ticket.id as string;
  }
  const spoof = await stage(Buffer.from("not a PNG"), "spoof.png", "image/png");
  expect((await post(`${base}/uploads/${spoof}/finalize`)).status()).toBe(400);
  const oversized = await stage(Buffer.alloc(10485761), "oversized.pdf", "application/pdf", 100);
  expect((await post(`${base}/uploads/${oversized}/finalize`)).status()).toBe(413);
  expect((await post(`/api/backend/cases/${c.id}/reassess`)).ok()).toBeTruthy();
  // A historical version is rejected by the backend, not just hidden in the UI.
  expect((await post(`${base}/uploads`, { ...metadata, requestKey: crypto.randomUUID() })).status()).toBe(409);
  await second.close();
  await page.goto(`/cases/${c.id}?v=1`);
  await expect(page.getByText("No documents were available at this assessment.")).toBeVisible();
  await expect(page.getByLabel("Evidence file", { exact: true })).toHaveCount(0);
  expect((await api.get(`${base}/attachments/${firstPhoto.id}?version=1`)).status()).toBe(404);
  await page.goto(`/cases/${c.id}`);
  await expect(page.getByRole("link", { name: "receipt.pdf — Download PDF" })).toBeVisible();
  await page.getByLabel("Evidence file", { exact: true }).setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await page.getByRole("button", { name: "Upload evidence", exact: true }).click();
  await expect(page.getByRole("link", { name: "photo.jpg — Open image" })).toBeVisible({ timeout: 30000 });
  await role("owner");
  expect((await post(`${base}/uploads`, { ...metadata, version: 2 })).status()).toBe(403);
  await page.reload();
  await expect(page.getByLabel("Evidence file", { exact: true })).toHaveCount(0);
  expect((await api.get(pdfHref)).status()).toBe(200);
  await role("manager");
  await page.reload();
  await page.getByRole("button", { name: "Reject", exact: true }).filter({ visible: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Documents reviewed, no correction");
  await page.getByRole("button", { name: "Reject correction", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open Decision Passport" })).toBeVisible();
  await page.getByRole("link", { name: "Open Decision Passport" }).click();
  await expect(page.getByText("This Decision Passport is read-only through the application.")).toBeVisible();
  await expect(page.getByRole("link", { name: "receipt.pdf — Download PDF" })).toBeVisible();
  await page.reload();
  expect((await post(`${base}/uploads`, { ...metadata, version: 2 })).status()).toBe(409);
  expect((await api.get(`${base}/attachments/${firstPhoto.id}`)).status()).toBe(200);
  state = await (await api.get("/api/backend/state")).json();
  expect(state.products.find((item: { id: string }) => item.id === id).recorded).toBe(50);
  expect(state.cases.find((item: { id: string }) => item.id === c.id).attachments).toHaveLength(3);
  await page.screenshot({ path: "generated-artifacts/evidence-passport.jpg", fullPage: true });
  expect(errors).toEqual([]);
});
