import { test, expect } from '@playwright/test'
import { ALL_PRESETS } from '../../src/engine/presets'

test('OEM presets populate sizing fields and expose their source', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  const hypervLink = page.getByRole('link', { name: /Open Hyper-V Surveyor/ })
  await expect(hypervLink).toBeVisible()
  await expect(hypervLink).toHaveAttribute('href', 'https://labs.hybridsolutions.cloud/hyperv-surveyor')
  await expect(hypervLink).toHaveAttribute('target', '_blank')
  await page.getByRole('link', { name: 'Hardware', exact: true }).click()
  const nodes = page.getByRole('group', { name: 'Number of nodes', exact: true }).getByRole('spinbutton')
  await nodes.fill('4')
  const picker = page.getByLabel('OEM Preset (optional)', { exact: true })

  // Start with hybrid so the following flash selection must clear all cache fields.
  await picker.selectOption('dell-ax-760-hybrid')
  for (const preset of ALL_PRESETS) {
    await picker.selectOption(preset.id)
    await expect(nodes).toHaveValue('4')
    for (const [label, value] of [
      ['Capacity drives / node', preset.capacityDrivesPerNode],
      ['Cache drives / node', preset.cacheDrivesPerNode],
      ['CPU cores / node', preset.coresPerNode],
      ['RAM / node (GB)', preset.memoryPerNodeGB],
    ] as const) {
      await expect(page.getByRole('group', { name: label, exact: true }).getByRole('spinbutton')).toHaveValue(String(value))
    }
    await expect(page.getByRole('group', { name: 'Capacity drive size (TB)', exact: true }).getByRole('combobox')).toHaveValue(String(preset.capacityDriveSizeTB))
    await expect(page.getByRole('group', { name: 'Capacity media type', exact: true }).getByRole('combobox')).toHaveValue(preset.capacityMediaType)
    await expect(page.getByRole('group', { name: 'Cache media type', exact: true }).getByRole('combobox')).toHaveValue(preset.cacheMediaType)
    const cacheSize = page.getByRole('group', { name: 'Cache drive size (TB)', exact: true })
    if (preset.cacheMediaType === 'none') {
      await expect(cacheSize).toContainText('No cache tier')
    } else {
      await expect(cacheSize.getByRole('combobox')).toHaveValue(String(preset.cacheDriveSizeTB))
    }
    await expect(page.getByRole('link', { name: preset.sourceTitle, exact: true })).toHaveAttribute('href', preset.sourceUrl)
    await expect(page.getByText(`Source reviewed ${preset.reviewedAt}:`, { exact: false })).toBeVisible()
  }
  await page.getByRole('group', { name: 'RAM / node (GB)', exact: true }).getByRole('spinbutton').fill('1024')
  await expect(page.getByRole('status')).toContainText('customized from this example')
  expect(errors).toEqual([])
  await page.screenshot({ path: test.info().outputPath('verified-oem-presets.png'), fullPage: true })
})

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
  await expect(page.getByText('4 needed / 756 available', { exact: true })).toBeVisible()
  await expect(page.getByText('16 GB needed / 744 GB available', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Final Report', exact: true }).click()
  expect(errors).toEqual([])
  await page.screenshot({ path: test.info().outputPath('verified-website.png'), fullPage: true })
})
