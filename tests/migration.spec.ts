import { test, expect } from "@playwright/test";
import { changeDemoRole, loginDemo } from './demo-helpers';

test("import, staff count, manager approval and persistent Decision Passport", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const id = `migration-${Date.now()}`;
  const name = `Migration test ${id}`;
  await loginDemo(page, 'manager');
  await page.goto("/inbox");
  await page.getByTestId("button-open-import").click();
  await expect(page.getByRole("heading", { name: "Connected records" })).toBeVisible();
  await page.getByLabel("CSV records").setInputFiles({
    name: "products.csv", mimeType: "text/csv",
    buffer: Buffer.from(`id,name,recorded,unit_cost\n${id},${name},50,2.5\n`),
  });
  const productImport = page.waitForResponse((r) => r.url().endsWith("/api/backend/imports") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Import records", exact: true }).click();
  expect((await productImport).status()).toBe(200);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Import records", exact: true })).toBeDisabled();
  await page.getByLabel("Import type").selectOption("movements");
  await page.getByLabel("CSV records").setInputFiles({
    name: "movements.csv", mimeType: "text/csv",
    buffer: Buffer.from(`id,product_id,kind,quantity,occurred_at,conflict_ref\n${id}-sale,${id},Sale,-7,2026-01-01T00:00:00Z,\n`),
  });
  const imported = page.waitForResponse((r) => r.url().endsWith("/api/backend/imports") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Import records", exact: true }).click();
  expect((await imported).status()).toBe(200);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Import records", exact: true })).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await changeDemoRole(page, 'staff');
  await expect(page.getByRole("button", { name: /Role: Staff/ })).toBeVisible();
  await expect(page).toHaveURL(/\/work$/);
  await page.goto("/count");
  await page.getByLabel("Product", { exact: true }).selectOption(id);
  await page.getByLabel("Counted quantity").fill("43");
  await page.getByRole("button", { name: /Submit count/ }).click();
  await expect(page).toHaveURL(/\/cases\/INV-/);
  const caseId = page.url().split("/cases/")[1];
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "generated-artifacts/count-case.jpg", fullPage: true });
  await changeDemoRole(page, 'manager');
  await expect(page.getByRole("button", { name: /Role: Manager/ })).toBeVisible();
  await expect(page).toHaveURL(/\/inbox$/);
  await page.goto(`/cases/${caseId}`);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Approve", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto(`/history/${caseId}`);
  await expect(page.getByText("This Decision Passport is read-only through the application.")).toBeVisible();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("This Decision Passport is read-only through the application.")).toBeVisible();
  const state = await page.evaluate(async () => (await fetch("/api/backend/state")).json());
  expect(state.products.find((p: { id: string }) => p.id === id).recorded).toBe(43);
  expect(state.cases.find((c: { id: string }) => c.id === caseId).status).toBe("completed");
  await page.screenshot({ path: "generated-artifacts/decision-passport.jpg", fullPage: true });
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await changeDemoRole(page, 'owner');
  await expect(page.getByRole("button", { name: /Role: Owner/ })).toBeVisible();
  await expect(page).toHaveURL(/\/reports$/);
  await page.goto("/count");
  await expect(page.getByText("Owners can't submit counts.")).toBeVisible();
  await page.goto("/inbox/frames");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inbox");
  await expect(page.getByRole("navigation", { name: "Main", exact: true }).filter({ visible: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/mobile-inbox.jpg", fullPage: true });
  await expect(page.getByRole("link", { name: "Account", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("button-open-import")).toHaveCount(0);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/reports$/);
  expect(errors).toEqual([]);
});
