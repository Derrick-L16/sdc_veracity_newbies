import { test, expect, type Page } from '@playwright/test'

async function selectRole(page: Page, role: string) {
  await page.getByRole('button', { name: /Role: .*Change role/ }).click()
  await page.getByRole('menuitemradio').filter({ hasText: role }).click()
  await expect(page.getByRole('button', { name: `Role: ${role}. Change role` })).toBeVisible()
  await page.keyboard.press('Escape')
}

test('import, count, approve, and reopen the Decision Passport on desktop and mobile', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const suffix = `${Date.now()}`
  const productId = `MIG${suffix}`
  const name = `Migration Test ${suffix}`
  await page.goto('/')
  await expect(page).toHaveURL(/\/inbox$/)
  await page.getByRole('navigation').getByRole('link', { name: 'Account', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Connected records' })).toBeVisible()

  const importCSV = async (kind: string, text: string) => {
    await page.getByLabel('Import type').selectOption(kind)
    await page.getByLabel('CSV records').setInputFiles({ name: `${kind}.csv`, mimeType: 'text/csv', buffer: Buffer.from(text) })
    const response = page.waitForResponse(r => r.url().endsWith('/api/backend/imports') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Import records', exact: true }).click()
    expect((await response).status()).toBe(200)
    await expect(page.getByRole('button', { name: 'Import records', exact: true })).toBeEnabled()
  }
  await importCSV('products', `id,name,recorded,unit_cost\n${productId},${name},50,2.5`)
  await importCSV('movements', `id,product_id,kind,quantity,occurred_at,conflict_ref\nTX${suffix},${productId},Sale,-7,2026-01-01T00:00:00Z,`)
  await selectRole(page, 'Staff')
  await page.getByRole('navigation').getByRole('link', { name: 'Count', exact: true }).first().click()
  await page.getByLabel('Product', { exact: true }).selectOption(productId)
  await page.getByLabel('Counted quantity', { exact: true }).fill('43')
  await page.getByRole('button', { name: 'Submit count', exact: true }).click()
  await expect(page).toHaveURL(/\/cases\/INV-/)
  const casePath = new URL(page.url()).pathname
  const id = casePath.split('/').at(-1)!
  await expect(page.getByRole('main')).toContainText(name)
  await page.screenshot({ path: testInfo.outputPath('staff-case.png'), fullPage: true })
  await selectRole(page, 'Manager')
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm approval', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('navigation').getByRole('link', { name: 'History', exact: true }).first().click()
  await expect(page.getByRole('main')).toContainText(name)
  await page.getByRole('link', { name: new RegExp(name) }).first().click()
  await expect(page).toHaveURL(new RegExp(`/history/${id}$`))
  await expect(page.getByRole('main')).toContainText('Decision Passport')
  await page.reload()
  await expect(page.getByRole('main')).toContainText(name)
  const state = await page.evaluate(async () => (await fetch('/api/backend/state')).json())
  expect(state.products.find((p: { id: string }) => p.id === productId).recorded).toBe(43)
  const closedCase = state.cases.find((c: { id: string }) => c.id === id)
  expect(closedCase.status).toBe('completed')
  expect(closedCase.decision.action).toBe('approved')
  await page.screenshot({ path: testInfo.outputPath('decision-passport.png'), fullPage: true })
  await page.goto(`${casePath}?v=1`)
  await expect(page.getByRole('main')).toContainText(name)
  await page.goto('/inbox/frames')
  await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible()
  await selectRole(page, 'Owner')
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Connected records' })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/inbox')
  await expect(page.getByRole('navigation', { name: 'Main' }).last()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('phone-inbox.png'), fullPage: true })
  expect(errors).toEqual([])
})
