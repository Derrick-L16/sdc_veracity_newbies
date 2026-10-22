import { test, expect } from './isolated-test'
import { loginDemo, changeDemoRole } from './demo-helpers'

test('manager import dialog preserves CSV behavior, errors and unsaved work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await loginDemo(page, 'manager')
  await expect(page.getByRole('link', { name: 'Account', exact: true })).toHaveCount(0)
  await page.getByTestId('button-open-import').click()
  const dialog = page.getByRole('dialog', { name: 'Import records', exact: true })
  await expect(dialog).toBeVisible()
  const submit = dialog.getByRole('button', { name: 'Import records', exact: true })
  await expect(submit).toBeDisabled()
  const file = { name: 'products.csv', mimeType: 'text/csv',
    buffer: Buffer.from('id,name,recorded,unit_cost\ndialog-test,Dialog test,12,2.5\n') }
  await dialog.getByLabel('CSV records').setInputFiles(file)
  page.once('dialog', d => d.dismiss())
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(submit).toBeEnabled()
  page.once('dialog', d => d.accept())
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByTestId('button-open-import').click()
  await expect(submit).toBeDisabled()
  await dialog.getByLabel('CSV records').setInputFiles(file)
  await page.route('**/api/backend/imports', r => r.fulfill({ status: 400, json: { error: 'CSV test validation failure.' } }))
  await submit.click()
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'CSV test validation failure.' })).toBeVisible()
  await expect(submit).toBeEnabled()
  await page.unroute('**/api/backend/imports')
  // Intercept only import writes: exercise payload and dialog lifecycle without
  // creating synthetic products/movements for this dialog-only test.
  let release!: () => void
  const hold = new Promise<void>(resolve => { release = resolve })
  let payload: { kind: string; rows: Record<string, unknown>[] } | undefined
  await page.route('**/api/backend/imports', async r => {
    payload = r.request().postDataJSON()
    await hold
    await r.fulfill({ status: 200, json: { imported: 1 } })
  })
  await submit.click()
  await expect(dialog.getByRole('button', { name: 'Importing…' })).toBeVisible()
  await expect(dialog.getByLabel('CSV records')).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  release()
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Imported 1 records.' }).last()).toBeVisible()
  expect(payload).toEqual({ kind: 'products', rows: [{ id: 'dialog-test', name: 'Dialog test', recorded: 12, unit_cost: 2.5 }] })
  await expect(submit).toBeDisabled()
  expect(await dialog.getByLabel('CSV records').evaluate((e: HTMLInputElement) => e.files?.length)).toBe(0)
  await dialog.getByLabel('Import type').selectOption('movements')
  await dialog.getByLabel('CSV records').setInputFiles({
    name: 'movements.csv', mimeType: 'text/csv',
    buffer: Buffer.from('id,product_id,kind,quantity,occurred_at,conflict_ref\nmove-test,dialog-test,Sale,-2,2026-01-01T00:00:00Z,\n'),
  })
  await submit.click()
  await expect(submit).toBeDisabled()
  expect(payload?.kind).toBe('movements')
  expect(payload?.rows[0].quantity).toBe(-2)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('button-open-import').click()
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'generated-artifacts/import-dialog-mobile.jpg', fullPage: true })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await changeDemoRole(page, 'staff')
  await page.goto('/inbox')
  await expect(page.getByTestId('button-open-import')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Account', exact: true })).toHaveCount(0)
  await page.goto('/account')
  await expect(page).toHaveURL(/\/work$/)
  await changeDemoRole(page, 'owner')
  await page.goto('/inbox')
  await expect(page.getByTestId('button-open-import')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'New count', exact: true })).toHaveCount(0)
  await page.goto('/account')
  await expect(page).toHaveURL(/\/reports$/)
  expect(errors).toEqual([])
})
