import { test, expect, type Page } from "@playwright/test";
import { changeDemoRole, enterDemo, loginDemo } from './demo-helpers';

async function switchRole(page: Page, from: string, to: string, home: string) {
  await expect(page.getByRole("button", { name: new RegExp(`Role: ${from}`) })).toBeVisible();
  await changeDemoRole(page, to.toLowerCase() as 'staff' | 'manager' | 'owner');
  await expect(page).toHaveURL(new RegExp(`${home}$`));
  await expect(page.getByRole("menu")).toHaveCount(0);
}

test("role homes, owner oversight and preserved deep links use real records", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginDemo(page, 'manager');
  await expect(page).toHaveURL(/\/inbox$/);
  await switchRole(page, "Manager", "Owner", "/reports");
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await enterDemo(page, 'owner');
  await expect(page).toHaveURL(/\/reports$/);
  await page.getByRole("link", { name: "Decisions", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible();
  const state = await page.evaluate(async () => (await fetch("/api/backend/state")).json());
  const decided = state.cases.filter((c: { decision?: unknown }) => c.decision);
  await expect(page.locator('[data-testid^="row-decision-"]')).toHaveCount(decided.length);
  for (const c of decided) {
    await expect(page.getByTestId(`row-decision-${c.id}`)).toContainText(c.decision.reason);
  }
  await expect(page.getByRole("button", { name: /^(Approve|Reject|Override with reason)$/ })).toHaveCount(0);
  if (decided.length) {
    const c = decided[0];
    await page.getByTestId(`link-passport-${c.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/history/${c.id}$`));
    await expect(page.getByText(c.decision.reason, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/history/${c.id}$`));
    await expect(page.getByText("This Decision Passport is read-only through the application.")).toBeVisible();
  }
  await page.getByRole("link", { name: "Veracity home", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/reports$/);

  await switchRole(page, "Owner", "Staff", "/work");
  await expect(page.getByRole("heading", { name: "My work", exact: true })).toBeVisible();
  const personal = await page.evaluate(async () => (await fetch("/api/backend/state")).json());
  expect(personal.cases.every((c: { createdBy: string }) => c.createdBy === personal.user.name)).toBe(true);
  await page.reload();
  await expect(page).toHaveURL(/\/work$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await enterDemo(page, 'staff');
  await expect(page).toHaveURL(/\/work$/);
  await page.getByTestId("link-start-count").click();
  await expect(page).toHaveURL(/\/count$/);
  await page.goto("/decisions");
  await expect(page.getByTestId("panel-decisions-access")).toBeVisible();
  await expect(page.locator('[data-testid^="row-decision-"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Decisions", exact: true })).toHaveCount(0);

  await switchRole(page, "Staff", "Manager", "/inbox");
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await enterDemo(page, 'manager');
  await expect(page).toHaveURL(/\/inbox$/);
  await page.goto("/decisions");
  await expect(page.getByRole("link", { name: "Open History", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open History", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await switchRole(page, "Manager", "Owner", "/reports");
  await page.goto("/decisions");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/owner-decisions-mobile.jpg", fullPage: true });
  await switchRole(page, "Owner", "Staff", "/work");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/staff-work-mobile.jpg", fullPage: true });
  expect(errors).toEqual([]);
});

test("decision filters use decision time in MYT and preserve accurate outcomes", async ({ page }) => {
  // Browser-only fixtures exercise all outcomes without modifying inventory,
  // decisions or any other persistent development data.
  const session = await page.request.post("/api/backend/session", {
    data: { role: "owner" }, headers: { Origin: "http://localhost" },
  });
  expect(session.ok()).toBe(true);
  const make = (id: string, action: string, at: string, finalStock: number | undefined, by = "Manager A") => ({
    id, product: `Test ${id}`, recorded: 50, counted: 43, finalStock,
    createdAt: "2026-10-01T00:00:00Z", createdBy: "Staff A",
    status: action === "rejected" ? "rejected" : "completed",
    versions: [], timeline: [],
    decision: { action, by, role: "manager", reason: `Evidence reason for ${id}`, at },
  });
  const cases = [
    make("REJECT", "rejected", "2026-10-20T15:59:59Z", 52, "Manager B"),
    make("APPROVE", "approved", "2026-10-20T16:00:01Z", 43),
    make("OVERRIDE", "overridden", "2026-10-20T16:00:02Z", 43),
    make("MISSING", "approved", "2026-10-20T16:00:00Z", undefined),
  ];
  await page.route("**/api/backend/state", async (route) => {
    const real = await (await route.fetch()).json();
    await route.fulfill({ json: { ...real, cases } });
  });
  await page.goto("/decisions");
  const rows = page.locator('[data-testid^="row-decision-"]');
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toHaveAttribute("data-testid", "row-decision-OVERRIDE");
  await expect(rows.nth(1)).toHaveAttribute("data-testid", "row-decision-APPROVE");
  await expect(page.getByTestId("row-decision-REJECT")).toContainText("0 (record kept)");
  await expect(page.getByTestId("row-decision-REJECT")).toContainText("52");
  await expect(page.getByTestId("row-decision-MISSING")).toContainText("Final stock unavailable");
  await page.getByTestId("input-date-from").fill("2026-10-21");
  await page.getByTestId("input-date-to").fill("2026-10-21");
  await expect(rows).toHaveCount(3);
  await page.getByTestId("filter-action-overridden").click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Evidence reason for OVERRIDE");
  await page.getByTestId("button-reset-filters").click();
  await page.getByTestId("select-decider").selectOption("Manager B");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute("data-testid", "row-decision-REJECT");
  await page.getByTestId("button-reset-filters").click();
  await page.getByTestId("input-search-decisions").fill("Evidence reason for APPROVE");
  await expect(rows).toHaveCount(1);
  await page.getByTestId("input-search-decisions").fill("no-match-unique-query");
  await expect(page.getByText("No decisions match these filters", { exact: true })).toBeVisible();
  await page.getByTestId("button-reset-filters").click();
  await page.getByTestId("input-date-from").fill("2026-10-22");
  await page.getByTestId("input-date-to").fill("2026-10-21");
  await expect(page.getByTestId("text-date-error")).toBeVisible();
  await expect(rows).toHaveCount(0);
  await page.getByTestId("button-reset-filters").click();
  await expect(rows).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route("**/api/backend/state", async (route) => {
    const real = await (await route.fetch()).json();
    await route.fulfill({ json: { ...real, cases: [] } });
  });
  await page.reload();
  await expect(page.getByText("No decisions yet", { exact: true })).toBeVisible();
});
