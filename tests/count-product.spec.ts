import { test, expect } from "@playwright/test";
import { loginDemo } from "./demo-helpers";

test("staff product creation is explicit about unavailable product evidence", async ({ page }) => {
  const name = `Count product ${Date.now()}`;
  await loginDemo(page, "staff");
  await page.goto("/count");

  await page.getByRole("button", { name: "Add New Product", exact: true }).click();
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Recorded (opening) quantity").fill("12");
  const createdResponse = page.waitForResponse(r => r.url().endsWith("/api/backend/products") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Next: add evidence" }).click();
  expect((await createdResponse).status()).toBe(200);

  await expect(page.getByRole("heading", { name: "Upload evidence", level: 1 })).toBeVisible();
  await expect(page.getByText("Product evidence is not available yet")).toBeVisible();
  await page.getByLabel("Evidence file").setInputFiles({
    name: "invoice.png",
    mimeType: "image/png",
    buffer: Buffer.from("demo image bytes"),
  });
  await expect(page.getByText(/Kept in this form only/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload evidence", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Product added" })).toBeVisible();
  await expect(page.getByText("Evidence missing. Product-level uploads need a backend endpoint before this file can be saved.")).toBeVisible();

  const state = await page.evaluate(async () => (await fetch("/api/backend/state")).json());
  expect(state.products.find((product: { name: string }) => product.name === name).evidence_missing).toBe(true);
});
