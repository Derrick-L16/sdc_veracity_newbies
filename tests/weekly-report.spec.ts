import { test, expect } from "./isolated-test";
import type { InventorySummaryReport } from "@workspace/api-client-react";
import { changeDemoRole, loginDemo } from './demo-helpers';

test("summary uses real period reports, readable details, saved navigation and role permissions", async ({ page, baseURL }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginDemo(page, 'manager');
  const post = (url: string, data: unknown) => page.request.post(url, { data, headers: { Origin: baseURL! } });
  expect((await post("/api/backend/imports", { kind: "products", rows: [
    { id: "summary-water", name: "Summary water", recorded: 50, unit_cost: 1 },
  ] })).ok()).toBeTruthy();
  const counted = await post("/api/backend/counts", { productId: "summary-water", counted: 43 });
  expect(counted.ok()).toBeTruthy();
  const caseData = await counted.json();
  expect((await post(`/api/backend/cases/${caseData.id}/decisions`, {
    action: "rejected", reason: "Summary test: recount required", version: 1,
  })).ok()).toBeTruthy();
  expect((await post("/api/backend/counts", { productId: "summary-water", counted: 44 })).ok()).toBeTruthy();
  const reportResponse = page.waitForResponse((r) =>
    r.url().includes("/api/backend/reports/summary") && r.status() === 200);
  await page.goto("/reports");
  const current = await (await reportResponse).json() as InventorySummaryReport;
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(current.totals.countSubmissions));
  await expect(page.getByTestId("stat-closedCases")).toHaveText(String(current.totals.closedCases));
  await expect(page.getByTestId("stat-closingBacklog")).toHaveText(String(current.totals.closingBacklog));
  expect(current.buckets.reduce((sum, d) => sum + d.counts, 0)).toBe(current.totals.countSubmissions);
  expect(current.totals.openingBacklog + current.totals.newCases - current.totals.closedCases)
    .toBe(current.totals.closingBacklog);
  await expect(page.getByTestId("button-next-period")).toBeDisabled();
  await expect(page.getByText("Discrepancies observed", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Recorded: ", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Opened today", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Rejected/ }).hover();
  await expect(page.getByTestId("panel-decision-detail")).toContainText("Rejected:");
  await expect(page.getByTestId("panel-decision-detail")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".recharts-tooltip-wrapper")).toHaveCount(0);
  const bar = page.locator(".recharts-bar-rectangle").filter({ visible: true }).last();
  await bar.hover();
  await expect(page.getByTestId("panel-bucket-detail")).toContainText("Selected");
  await expect(page.getByTestId("panel-bucket-detail")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByTestId("panel-bucket-detail")).toContainText("Opened:");
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({ path: "generated-artifacts/inventory-summary-desktop.jpg", fullPage: true });

  const d = new Date(`${current.periodStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  const previous = d.toISOString().slice(0, 10);
  const pastResponse = page.waitForResponse((r) =>
    r.url().includes("/api/backend/reports/summary") && r.url().includes(`date=${previous}`) && r.status() === 200);
  await page.getByTestId("button-prev-period").click();
  const past = await (await pastResponse).json() as InventorySummaryReport;
  expect(past.periodStart).toBe(previous); // catches proxy dropping query parameters
  expect(past.isFinal).toBe(true);
  await expect(page).toHaveURL(new RegExp(`date=${previous}`));
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(past.totals.countSubmissions));
  const reloadResponse = page.waitForResponse((r) =>
    r.url().includes("/api/backend/reports/summary") && r.url().includes(`date=${previous}`) && r.status() === 200);
  await page.reload();
  const reloaded = await (await reloadResponse).json() as InventorySummaryReport;
  expect(reloaded.generatedAt).toBe(past.generatedAt);
  expect(reloaded.totals).toEqual(past.totals);
  await expect(page.getByTestId("text-report-meta")).toContainText("saved snapshot");
  await page.getByTestId("button-current-period").click();
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(current.totals.countSubmissions));

  for (const period of ["daily", "monthly", "yearly", "weekly"]) {
    const response = page.waitForResponse(r => r.url().includes(`period=${period}`) && r.status() === 200);
    await page.getByTestId(`tab-period-${period}`).click();
    const report = await (await response).json() as InventorySummaryReport;
    expect(report.period).toBe(period);
    expect(report.buckets.length).toBe(period === "daily" ? 24 : period === "yearly" ? 12 : period === "weekly" ? 7 : new Date(`${report.periodEnd}T00:00:00Z`).getUTCDate());
    expect(report.buckets.reduce((n, b) => n + b.counts, 0)).toBe(report.totals.countSubmissions);
    await expect(page.getByTestId(`tab-period-${period}`)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(report.totals.countSubmissions));
  }
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
  const denied = await page.evaluate(async () => (await fetch("/api/backend/reports/summary?period=yearly")).status);
  expect(denied).toBe(403);
  await page.reload();
  await expect(page.getByText("Managers and owners only", { exact: true })).toBeVisible();
  await changeDemoRole(page, 'owner');
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(current.totals.countSubmissions));

  // A failed request must not leave another week's figures under a new label.
  await page.route("**/api/backend/reports/summary?*date=*", (route) => route.abort());
  await page.getByTestId("button-prev-period").click();
  await expect(page.getByText(/Could not load the week/)).toBeVisible();
  await expect(page.getByTestId("stat-countSubmissions")).toHaveCount(0);
  await page.unroute("**/api/backend/reports/summary?*date=*");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("stat-countSubmissions")).toHaveText(String(past.totals.countSubmissions));
  expect(errors).toEqual([]);
});
