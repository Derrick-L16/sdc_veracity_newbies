import { test, expect } from "./isolated-test";
import type { WeeklyInventoryReport } from "@workspace/api-client-react";
import { changeDemoRole, loginDemo } from './demo-helpers';

test("weekly dashboard uses real reports, persists week selection and enforces roles", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginDemo(page, 'manager');
  const reportResponse = page.waitForResponse((r) =>
    r.url().includes("/api/backend/reports/weekly") && r.status() === 200);
  await page.goto("/reports");
  const current = await (await reportResponse).json() as WeeklyInventoryReport;
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(current.totals.countSubmissions));
  await expect(page.getByTestId("stat-closedCases")).toHaveText(String(current.totals.closedCases));
  await expect(page.getByTestId("stat-closingBacklog")).toHaveText(String(current.totals.closingBacklog));
  expect(current.daily.reduce((sum, d) => sum + d.counts, 0)).toBe(current.totals.countSubmissions);
  expect(current.totals.openingBacklog + current.totals.newCases - current.totals.closedCases)
    .toBe(current.totals.closingBacklog);
  await expect(page.getByTestId("button-next-week")).toBeDisabled();

  const d = new Date(`${current.weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  const previous = d.toISOString().slice(0, 10);
  const pastResponse = page.waitForResponse((r) =>
    r.url().includes(`reports/weekly?week=${previous}`) && r.status() === 200);
  await page.getByTestId("button-prev-week").click();
  const past = await (await pastResponse).json() as WeeklyInventoryReport;
  expect(past.weekStart).toBe(previous); // catches proxy dropping query parameters
  expect(past.isFinal).toBe(true);
  await expect(page).toHaveURL(new RegExp(`week=${previous}`));
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(past.totals.countSubmissions));
  const reloadResponse = page.waitForResponse((r) =>
    r.url().includes(`reports/weekly?week=${previous}`) && r.status() === 200);
  await page.reload();
  const reloaded = await (await reloadResponse).json() as WeeklyInventoryReport;
  expect(reloaded.generatedAt).toBe(past.generatedAt);
  expect(reloaded.totals).toEqual(past.totals);
  await expect(page.getByTestId("text-report-meta")).toContainText("saved snapshot");
  await page.getByTestId("button-current-week").click();
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(current.totals.countSubmissions));

  if (current.followUps.length) {
    const id = current.followUps[0].id;
    await page.getByTestId(`link-case-${id}`).click();
    await expect(page).toHaveURL(new RegExp(`/cases/${id}`));
    await page.goto("/reports");
    await expect(page.getByTestId("stat-countSubmissions")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/weekly-summary-mobile.jpg", fullPage: true });

  await changeDemoRole(page, 'staff');
  await expect(page).toHaveURL(/\/work$/);
  await page.goto("/reports");
  await expect(page.getByText("Managers and owners only", { exact: true })).toBeVisible();
  await expect(page.getByTestId("stat-countSubmissions")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Summary", exact: true })).toHaveCount(0);
  const denied = await page.evaluate(async () => (await fetch("/api/backend/reports/weekly")).status);
  expect(denied).toBe(403);
  await page.reload();
  await expect(page.getByText("Managers and owners only", { exact: true })).toBeVisible();
  await changeDemoRole(page, 'owner');
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(current.totals.countSubmissions));

  // A failed request must not leave another week's figures under a new label.
  await page.route("**/api/backend/reports/weekly?week=*", (route) => route.abort());
  await page.getByTestId("button-prev-week").click();
  await expect(page.getByText(/Could not load the week/)).toBeVisible();
  await expect(page.getByTestId("stat-countSubmissions")).toHaveCount(0);
  await page.unroute("**/api/backend/reports/weekly?week=*");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(past.totals.countSubmissions));
  expect(errors).toEqual([]);
});
