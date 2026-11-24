import { test, expect } from '@playwright/test'

// The Reports page downloads the sizing handoff that Azure Local Trailwright imports.
test('the final report downloads the sizing handoff for Trailwright', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./#/planning/reports')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sizing handoff for Trailwright' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^azure-local-sizing-handoff-\d{4}-\d{2}-\d{2}\.json$/)
  const stream = await file.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const handoff = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  expect(handoff).toMatchObject({ kind: 'azurelocal-sizing-handoff', schemaVersion: '1.0', generatedBy: 'azurelocal-surveyor', targetRelease: 'Azure Local 12.2611' })
  expect(handoff.cluster.node_count).toBeGreaterThan(0)
  expect(handoff.hardware.drives.capacity.count).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
