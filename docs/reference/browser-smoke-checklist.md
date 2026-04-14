# Browser Smoke Checklist

Use this checklist before calling a browser-rendering issue fixed, especially for the pages that previously blanked in Edge.

## Browsers

- Microsoft Edge: latest stable channel installed on Windows
- Google Chrome: latest stable channel installed on Windows

## Pages to verify

1. Home
2. Hardware
3. Workloads
4. AVD
5. SOFS
6. MABS
7. Volumes
8. Reports
9. Docs
10. About

## Smoke steps

1. Load the app from a clean session.
2. Navigate to each page from the left menu.
3. Refresh on each of the historically sensitive pages: AVD, SOFS, Volumes, and Reports.
4. Hard refresh once on Volumes and once on AVD.
5. Toggle workload features on and off, then navigate back to Volumes and Reports.
6. Open the Health Check expander and expand at least one passing row and one warning or failing issue.
7. Open the SOFS page and verify the host CSV count guidance renders.
8. Open the MABS page and verify separate scratch and backup resiliency controls render.
9. Export Markdown or JSON once to confirm the page remains responsive after export actions.
10. If a page blanks, open DevTools and capture the Console output before reloading.

## Expected result

- No page renders as a blank white screen in Edge or Chrome.
- If a runtime error occurs, the app shows the Surveyor recovery screen instead of a silent blank page.
- Resetting saved settings and reloading restores a usable application state.

## Triage data to capture if a blank page still occurs

- Exact page name
- Browser and version
- Whether the failure happened on first load, refresh, or navigation
- Console errors from DevTools
- Whether resetting saved settings fixes it