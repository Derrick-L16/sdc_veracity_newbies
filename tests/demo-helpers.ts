import { expect, type Page } from '@playwright/test'

export async function enterDemo(page: Page, role: 'staff' | 'manager' | 'owner') {
  await page.getByTestId('select-demo-role').selectOption(role)
  await page.getByTestId('button-enter-demo').click()
}

export async function loginDemo(page: Page, role: 'staff' | 'manager' | 'owner') {
  await page.goto('/login')
  await expect(page.getByTestId('select-demo-role')).toBeVisible()
  await enterDemo(page, role)
  await expect(page).toHaveURL(new RegExp(`/${{ staff: 'work', manager: 'inbox', owner: 'reports' }[role]}$`))
}

export async function changeDemoRole(page: Page, role: 'staff' | 'manager' | 'owner') {
  await page.getByRole('button', { name: /^Role:/ }).click()
  await page.getByTestId('button-change-role').click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await enterDemo(page, role)
  await expect(page).toHaveURL(new RegExp(`/${{ staff: 'work', manager: 'inbox', owner: 'reports' }[role]}$`))
}
