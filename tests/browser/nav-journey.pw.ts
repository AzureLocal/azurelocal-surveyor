import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const shots = fileURLToPath(new URL('../../docs/screenshots/nav-journey/', import.meta.url))

test.use({ viewport: { width: 1600, height: 900 } })

test('journey bar and step navigation appear on planning and storage pages only', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  await page.goto('./#/planning/hardware')
  const bar = page.locator('[data-nav="journey"]')
  await expect(bar).toContainText('Workload Planning')
  await expect(bar).toContainText('Step 1 of 7')
  await expect(bar.locator('a[aria-current="step"]')).toHaveText(/Hardware$/)
  const nav = page.getByRole('navigation', { name: 'Step navigation' })
  await expect(nav.getByRole('link', { name: /^Back to/ })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Continue to Workloads' })).toBeVisible()
  await page.screenshot({ path: shots + 'planning-hardware.png', fullPage: false })

  await nav.getByRole('link', { name: 'Continue to Workloads' }).click()
  await expect(page).toHaveURL(/#\/planning\/workloads$/)
  await expect(bar).toContainText('Step 2 of 7')
  await expect(nav.getByRole('link', { name: 'Back to Hardware' })).toBeVisible()

  await page.goto('./#/planning/fit')
  await expect(bar).toContainText('Step 5 of 7')
  await expect(nav.getByRole('link', { name: 'Back to Hardware Options' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Continue to Reports' })).toBeVisible()
  await page.screenshot({ path: shots + 'planning-fit.png', fullPage: false })

  await page.goto('./#/planning/avd')
  await expect(bar).toContainText('Step 3 of 7 · AVD Planner')
  await expect(nav.getByRole('link', { name: 'Back to Specialized Workloads' })).toBeVisible()

  await page.goto('./#/storage/volumes')
  await expect(bar).toContainText('Storage Sizing')
  await expect(bar).toContainText('Step 2 of 6')
  await expect(nav.getByRole('link', { name: 'Back to Hardware & Drives' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Continue to Compare Drive Layouts' })).toBeVisible()
  await page.screenshot({ path: shots + 'storage-volumes.png', fullPage: false })
  await nav.screenshot({ path: shots + 'storage-volumes-footer.png' })

  await page.goto('./#/storage/projects')
  await expect(bar).toContainText('Step 6 of 6')
  await expect(nav.getByRole('link', { name: 'Back to Storage overview' })).toBeVisible()

  for (const path of ['./#/', './#/planning', './#/storage', './#/help', './#/about']) {
    await page.goto(path)
    await expect(bar).toHaveCount(0)
    await expect(nav).toHaveCount(0)
  }
  expect(errors).toEqual([])
})
