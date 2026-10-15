import { test, expect } from '@playwright/test'

test('single node and rack aware plans, release banner and Learn facts', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByTestId('release-banner')).toHaveText('Azure Local 12.2609 (latest)')

  await page.getByRole('link', { name: 'Storage Sizing', exact: true }).click()
  await page.getByRole('link', { name: 'Hardware & Drives', exact: true }).click()
  const nodes = page.getByRole('group', { name: 'Number of nodes', exact: true }).getByRole('spinbutton')

  // Single node: allowed, with the availability warning and no cache.
  await nodes.fill('1')
  await expect(nodes).toHaveValue('1')
  await expect(page.getByText(/Single-node design/)).toBeVisible()
  await expect(page.getByText(/does not support the storage cache/)).toBeVisible()

  // 17 nodes is rejected with the 16 maximum.
  await nodes.fill('17')
  await expect(page.getByText(/at most 16 machines/).first()).toBeVisible()

  // Rack aware: two zones, four-way mirror notes.
  await nodes.fill('4')
  await page.getByRole('checkbox', { name: /Rack aware cluster/ }).check()
  await expect(page.getByText(/2\+2 zones/)).toBeVisible()
  await expect(page.getByText(/Active Directory identity only/)).toBeVisible()

  // References lists the facts with Learn links.
  await page.goto('./#/references')
  await expect(page.getByRole('heading', { name: /Platform facts used by the engine/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /concepts\/rack-aware-cluster-requirements/ }).first()).toBeVisible()
  expect(errors).toEqual([])
})
