# Privacy and data handling

Surveyor is a static website. Everything you enter is processed in your browser.

## Network behaviour

- The application makes **no network calls**: no analytics, no telemetry, no remote scripts, styles or fonts. A test (`src/privacy.test.ts`) fails the build if source code adds `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource` or a remote import, or if `index.html` loads a remote script, stylesheet or font.
- The page itself is downloaded from GitHub Pages like any website. Outbound links (Microsoft Learn, OEM pages) only load when you click them.
- Spreadsheet, CSV and JSON files you open are read locally by the browser and are never uploaded.

## What is stored on your device

- **localStorage** holds the working plan so a refresh does not lose it. Keys: `surveyor-state` (Workload Planning) and `surveyor-storage-state` (Storage Sizing). The data stays in that browser profile; it is not synced and not a backup.
- Clear it from the browser's site-data controls, from **Reset** in the plan, or on a shared computer by using a private window. Browsers can also clear it on their own, so download a project for anything you need to keep.
- Saved projects and exports are files you download and control.

## Share links

Version 2.9.0 has **no Share button**. The earlier documentation described one; the encoder in `src/state/serializer.ts` exists but is not connected to any screen. If a share link is added, it will carry the **entire plan state inside the URL fragment** (the part after `#`). The fragment is not sent to the web server by the browser, but it is visible in browser history, in anything that records the address, and to everyone you give the link to. Treat such a link like the plan file itself. Until then, share a downloaded project file.

## Files and sensitive content

RVTools workbooks contain VM names, hosts and clusters. Plans and projects keep that evidence. Remove names from files before sharing them outside your organisation. Surveyor does not store credentials, tenant IDs or subscription IDs and has no field for them.

## Dependencies

Spreadsheet import uses SheetJS 0.20.3, pinned by integrity hash. PDF export uses jsPDF 4.2.1 with jspdf-autotable 5.0.9. `npm audit --omit=dev` is reviewed at each release; see the changelog for what remains.
