import { test, expect } from "@playwright/test";

test("import, staff count, manager approval and persistent Decision Passport", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const id = `migration-${Date.now()}`;
  const name = `Migration test ${id}`;
  const ready = page.waitForResponse((r) => r.url().endsWith("/api/backend/state") && r.status() === 200);
  await page.goto("/account");
  await ready;
  await expect(page.getByRole("heading", { name: "Connected records" })).toBeVisible();
  await page.getByLabel("CSV records").setInputFiles({
    name: "products.csv", mimeType: "text/csv",
    buffer: Buffer.from(`id,name,recorded,unit_cost\n${id},${name},50,2.5\n`),
  });
  const productImport = page.waitForResponse((r) => r.url().endsWith("/api/backend/imports") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Import records", exact: true }).click();
  expect((await productImport).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Import records", exact: true })).toBeEnabled();
  await page.getByLabel("Import type").selectOption("movements");
  await page.getByLabel("CSV records").setInputFiles({
    name: "movements.csv", mimeType: "text/csv",
    buffer: Buffer.from(`id,product_id,kind,quantity,occurred_at,conflict_ref\n${id}-sale,${id},Sale,-7,2026-01-01T00:00:00Z,\n`),
  });
  const imported = page.waitForResponse((r) => r.url().endsWith("/api/backend/imports") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Import records", exact: true }).click();
  expect((await imported).status()).toBe(200);
  await page.getByRole("button", { name: /Role: Manager/ }).click();
  await page.getByRole("menuitemradio", { name: /Staff/ }).click();
  await expect(page.getByRole("button", { name: /Role: Staff/ })).toBeVisible();
  await expect(page).toHaveURL(/\/work$/);
  await page.goto("/count");
  await page.getByLabel("Product", { exact: true }).selectOption(id);
  await page.getByLabel("Counted quantity").fill("43");
  const countResponse = page.waitForResponse((r) => r.url().endsWith("/api/backend/counts") && r.request().method() === "POST");
  await page.getByRole("button", { name: /Submit count/ }).click();
  const createdCase = await (await countResponse).json();
  const idCase = createdCase.id as string;
  await expect(page.getByRole("heading", { name: "Upload evidence", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Case ${idCase} opened`) })).toBeVisible();
  await page.getByTestId(`link-summary-product-${id}`).click();
  await expect(page).toHaveURL(new RegExp(`/reports\\?product=${id}`));
  await expect(page.getByRole("heading", { name: "Product summary" })).toBeVisible();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.goto(`/cases/${idCase}`);
  await page.screenshot({ path: "generated-artifacts/count-case.jpg", fullPage: true });
  await page.getByRole("button", { name: /Role: Staff/ }).click();
  await page.getByRole("menuitemradio", { name: /Manager/ }).click();
  await expect(page.getByRole("button", { name: /Role: Manager/ })).toBeVisible();
  await expect(page).toHaveURL(/\/inbox$/);
  await page.goto(`/cases/${idCase}`);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Approve", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto(`/history/${idCase}`);
  await expect(page.getByText("This Decision Passport is read-only through the application.")).toBeVisible();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("This Decision Passport is read-only through the application.")).toBeVisible();
  const state = await page.evaluate(async () => (await fetch("/api/backend/state")).json());
  expect(state.products.find((p: { id: string }) => p.id === id).recorded).toBe(43);
  expect(state.cases.find((c: { id: string }) => c.id === idCase).status).toBe("completed");
  await page.screenshot({ path: "generated-artifacts/decision-passport.jpg", fullPage: true });
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Role: Manager/ }).click();
  await page.getByRole("menuitemradio", { name: /Owner/ }).click();
  await expect(page.getByRole("button", { name: /Role: Owner/ })).toBeVisible();
  await expect(page).toHaveURL(/\/reports$/);
  await page.goto("/count");
  await expect(page.getByText("Owners have read-only access. Switch to Staff or Manager to count stock or add a product.")).toBeVisible();
  await page.goto("/inbox/frames");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inbox");
  await expect(page.getByRole("navigation", { name: "Main", exact: true }).filter({ visible: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/mobile-inbox.jpg", fullPage: true });
  await page.getByRole("link", { name: "Account", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  expect(errors).toEqual([]);
});
