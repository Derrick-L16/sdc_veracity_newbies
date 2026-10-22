import { test as base, expect } from '@playwright/test'

export const test = base.extend<{ isolation: void }>({
  baseURL: async ({}, use) => {
    const url = process.env.VERACITY_E2E_URL
    if (!url || !/^http:\/\/127\.0\.0\.1:\d+$/.test(url) || !process.env.VERACITY_E2E_TOKEN) {
      throw new Error('Write tests require the isolated global setup. Never target the demo instance.')
    }
    await use(url)
  },
  isolation: [async ({ request, baseURL }, use) => {
    if (baseURL !== process.env.VERACITY_E2E_URL) throw new Error('Overriding the isolated baseURL is forbidden.')
    const response = await request.get('/api/__test/isolation')
    expect(response.ok(), 'Test target must identify as this isolated run').toBeTruthy()
    expect(await response.json()).toEqual({ token: process.env.VERACITY_E2E_TOKEN, storage: 'local' })
    await use()
  }, { auto: true }],
})
export { expect }
