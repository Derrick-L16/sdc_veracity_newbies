import { test, expect } from './isolated-test'
import { formatCalendarDate, formatKl } from '../artifacts/veracity/src/lib/kl-time'
import { formatDate, formatDateTime } from '../artifacts/veracity/src/lib/format'
import { loginDemo } from './demo-helpers'
import type { Page } from '@playwright/test'

test('Malaysia timestamps include seconds and correctly cross calendar boundaries', async () => {
  for (const format of [formatKl, formatDate, formatDateTime]) {
    expect(format('2026-10-22T11:39:53.924201+00:00')).toBe('22/10/2026 19:39:53')
    expect(format('2026-12-31T16:00:01Z')).toBe('01/01/2027 00:00:01')
    expect(format('2026-10-22T19:39:53+08:00')).toBe('22/10/2026 19:39:53')
  }
  expect(formatKl('2026-10-22T11:39:53')).toBe('Unknown time')
  expect(formatCalendarDate('2026-10-22')).toBe('22/10/2026')
  expect(formatCalendarDate('2026-02-30')).toBe('')
})

async function expectNoDarkOnDark(page: Page) {
  const failures = await page.evaluate(() => {
    const rgb = (v: string) => v.match(/[\d.]+/g)?.map(Number) ?? []
    const failures: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) continue
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || !el.getBoundingClientRect().width) continue
      if (el.closest('[aria-hidden="true"], [inert], [disabled]')) continue
      const color = rgb(getComputedStyle(el).color)
      if (color.length < 3 || color.slice(0, 3).some(n => n >= 70)) continue
      let ancestor: Element | null = el
      while (ancestor) {
        const bg = rgb(getComputedStyle(ancestor).backgroundColor)
        if (bg.length >= 3 && (bg[3] ?? 1) >= 0.9) {
          if (bg.slice(0, 3).every(n => n < 80)) failures.push(`${el.tagName}: ${el.textContent?.trim().slice(0, 70)}`)
          break
        }
        ancestor = ancestor.parentElement
      }
    }
    return failures
  })
  expect(failures, 'No visible text may be near-black on a dark surface').toEqual([])
}

test('all role screens, decision dialogs, dates and role menu stay readable', async ({ page, baseURL }) => {
  test.setTimeout(120000)
  await loginDemo(page, 'manager')
  const post = (url: string, data: unknown) => page.request.post(url, { data, headers: { Origin: baseURL! } })
  expect((await post('/api/backend/imports', { kind: 'products', rows: [
    { id: 'presentation-water', name: 'Presentation water', recorded: 50, unit_cost: 1.2 },
  ] })).ok()).toBeTruthy()
  expect((await post('/api/backend/imports', { kind: 'movements', rows: [
    { id: 'presentation-sale', product_id: 'presentation-water', kind: 'Sale', quantity: -7, occurred_at: '2026-01-01T00:00:00Z' },
  ] })).ok()).toBeTruthy()
  const count = await post('/api/backend/counts', { productId: 'presentation-water', counted: 43 })
  expect(count.ok()).toBeTruthy()
  const stockCase = await count.json()

  for (const path of ['/inbox', '/count', '/history', '/reports', `/cases/${stockCase.id}`]) {
    await page.goto(path)
    await expect(page.getByRole('navigation', { name: 'Main', exact: true }).filter({ visible: true })).toBeVisible()
    await expectNoDarkOnDark(page)
  }
  for (const label of ['Approve', 'Reject', 'Request review', 'Override with reason']) {
    await page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.locator('[data-slot="dialog-title"]')).toHaveCSS('color', 'rgb(245, 245, 247)')
    await expectNoDarkOnDark(page)
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  }
  await page.getByRole('button', { name: /^Role:/ }).click()
  await expect(page.getByText(/Demo · Currently viewing as/)).toHaveCount(0)
  const changeRole = page.getByTestId('button-change-role')
  await changeRole.hover()
  await expect(changeRole).toHaveCSS('cursor', 'pointer')
  await expect.poll(() => changeRole.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
  await page.keyboard.press('Escape')
  await loginDemo(page, 'staff')
  for (const path of ['/work', '/count', '/inbox', '/history']) {
    await page.goto(path)
    await expectNoDarkOnDark(page)
  }
  await loginDemo(page, 'owner')
  for (const path of ['/reports', '/decisions', '/history']) {
    await page.goto(path)
    await expectNoDarkOnDark(page)
  }
  await page.goto('/decisions')
  await page.getByTestId('input-date-from').fill('2026-10-21')
  await expect(page.getByTestId('input-date-from').locator('..')).toContainText('21/10/2026')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
