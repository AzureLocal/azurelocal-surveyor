import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * Privacy guard: the planner runs entirely in the browser. These checks fail if source code adds a way to
 * send plan data off the device (network APIs, remote scripts or fonts). docs/reference/privacy-and-data.md
 * documents what is stored and shared.
 */
function walk(dir: URL, out: [string, string][] = []): [string, string][] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(url, out) }
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push([url.pathname, readFileSync(url, 'utf8')])
  }
  return out
}
const production = walk(new URL('./', import.meta.url))
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/, /\bEventSource\b/, /navigator\.serviceWorker/, /import\(\s*['"]https?:/]

describe('no network calls from the application', () => {
  it('scans the production sources', () => {
    expect(production.length).toBeGreaterThan(50)
  })
  for (const pattern of forbidden) {
    it(`no ${pattern.source} in src`, () => {
      const hits = production.filter(([, text]) => pattern.test(text)).map(([path]) => path)
      expect(hits).toEqual([])
    })
  }
  it('index.html loads no remote scripts, styles or fonts', () => {
    expect(indexHtml).not.toMatch(/<(script|link)[^>]+(src|href)=["']https?:\/\//i)
  })
})

describe('local storage keys', () => {
  it('the only explicit storage key read or cleared is the plan state', () => {
    const keys = new Set<string>()
    for (const [, text] of production) for (const m of text.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"]([^'"]+)['"]/g)) keys.add(m[1])
    expect([...keys].sort()).toEqual(['surveyor-state'])
  })
})
