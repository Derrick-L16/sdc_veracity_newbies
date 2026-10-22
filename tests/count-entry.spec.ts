import { test, expect } from "./isolated-test";
import { changeDemoRole, loginDemo } from "./demo-helpers";

test("count entry supports total quantities and signed adjustments from recorded stock", async ({ page, context, baseURL }) => {
  test.setTimeout(90000);
  const id = `count-entry-${Date.now()}`;
  const origin = { Origin: baseURL! };

  await loginDemo(page, "manager");
  const imported = await context.request.post("/api/backend/imports", {
    data: {
      kind: "products",
      rows: [
        { id: `${id}-plus`, name: `${id} plus`, recorded: 10 },
        { id: `${id}-minus`, name: `${id} minus`, recorded: 10 },
      ],
    },
    headers: origin,
  });
  expect(imported.ok()).toBeTruthy();
  await changeDemoRole(page, "staff");
  await page.goto("/count");

  await page.getByLabel("Product", { exact: true }).selectOption(`${id}-plus`);
  await page.getByTestId("count-mode-adjustment").click();
  await expect(page.getByTestId("count-mode-adjustment")).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Adjustment (use +5 or -5)").fill("+5");
  await expect(page.getByTestId("adjustment-result")).toHaveText("New counted quantity: 15");
  const plusResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/backend/counts") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Submit count" }).click();
  expect((await plusResponse).request().postDataJSON().counted).toBe(15);
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await page.getByRole("button", { name: "Add another", exact: true }).click();

  await page.getByLabel("Product", { exact: true }).selectOption(`${id}-minus`);
  await page.getByTestId("count-mode-adjustment").click();
  await page.getByLabel("Adjustment (use +5 or -5)").fill("-11");
  await expect(page.getByTestId("adjustment-result")).toHaveText("New counted quantity: -1");
  await page.getByRole("button", { name: "Submit count" }).click();
  await expect(page.getByText("This adjustment would make the counted quantity less than 0.")).toBeVisible();
  await expect(page.getByTestId("page-count")).toBeVisible();

  await page.getByLabel("Adjustment (use +5 or -5)").fill("-5");
  await expect(page.getByTestId("adjustment-result")).toHaveText("New counted quantity: 5");
  const minusResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/backend/counts") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Submit count" }).click();
  expect((await minusResponse).request().postDataJSON().counted).toBe(5);
});
