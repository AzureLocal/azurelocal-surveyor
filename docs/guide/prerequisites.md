# Prerequisites

Surveyor is a browser app. It needs no Azure subscription, PowerShell, credentials, or access to nodes, switches or Active Directory, and it makes no network calls once loaded. Input is what you type or import (RVTools export, project JSON); output is files you download.

| Area | Requirement |
|---|---|
| To use the app | A current desktop browser with JavaScript enabled. Plans are kept in the browser's local storage, so clear it on shared machines |
| To build or develop | Node.js 22 LTS (CI uses 22; Vite 5 and Vitest 1 need 18 or later, Playwright 1.63 needs 20 or later) and npm |
| Install | `npm ci` (or `npm install`). The SheetJS `xlsx` package is a pinned tarball from `https://cdn.sheetjs.com`, so the build machine needs HTTPS access to `cdn.sheetjs.com` as well as the npm registry (`registry.npmjs.org`) |
| Dev server | `npm run dev` serves on localhost port 5173 under the base path `/azurelocal-surveyor/` |
| Browser tests | `npx playwright install` downloads the browsers once; the tests start `npm run preview` on 127.0.0.1:4173 (or use `PLAYWRIGHT_BASE_URL` to test a published site) |
| Reference workbook | Optional reference only (no test reads it): copy `tools/planning/S2D_Capacity_Calculator.xlsx` from `azurelocal-toolkit` to `reference/` (not committed) |
| Operating system | Any OS that runs Node 22 and a modern browser |
