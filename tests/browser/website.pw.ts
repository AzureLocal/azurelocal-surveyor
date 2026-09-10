import { test, expect } from '@playwright/test'

test('published revision matches the workflow commit', async ({ request }) => {
  const expected = process.env.EXPECTED_COMMIT ?? process.env.GITHUB_SHA
  test.skip(!expected, 'Revision comparison applies to CI builds and published deployments.')
  const response = await request.get(`build-info.json?revision=${expected}`)
  expect(response.ok()).toBeTruthy()
  expect((await response.json()).commit).toBe(expected)
})

test('visitor can plan workloads, assess fit, and save and restore a project', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await page.getByRole('link', { name: /Size from workloads/ }).click()
  await expect(page.getByRole('heading', { name: 'VM inventory', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add 1 VM', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Name VM-1', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Workload Fit', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Aggregate capacity fits' })).toBeVisible()
  await page.getByRole('link', { name: 'Saved Projects', exact: true }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download project', exact: true }).click()
  const downloaded = await downloadEvent
  const path = await downloaded.path()
  expect(path).toBeTruthy()
  await page.getByLabel('Project JSON file', { exact: true }).setInputFiles(path!)
  await expect(page.getByRole('heading', { name: 'Compare: Azure Local plan', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Restore this project', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Restored Azure Local plan.')
  await page.getByRole('link', { name: 'Reports', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'VM inventory', exact: true })).toBeVisible()
  await expect(page.getByText('Aggregate capacity fits the selected hardware.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Compute', exact: true }).click()
  await expect(page.getByText('4 needed /', { exact: false })).toBeVisible()
  await expect(page.getByText('16 GB needed /', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Final Report', exact: true }).click()
  expect(errors).toEqual([])
  await page.screenshot({ path: test.info().outputPath('verified-website.png'), fullPage: true })
})
