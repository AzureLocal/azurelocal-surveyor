# Handoff

## Journey navigation — branch feature/nav-journey (14 Oct 2026)

- Goal: give every Storage Sizing and Workload Planning page the step bar and Previous/Continue navigation that Hyper-V Surveyor has. Not merged, not pushed; no work item supplied, so the commit carries no AB# reference yet.
- State: `src/state/journey.ts` is a navigation-only registry (fixed step order per area, sub-steps for the specialized planners and for Storage Design / Compare Drive Layouts under Fit, `journeyPosition(pathname)`); `src/state/journey-focus.ts` moves focus to the new page heading after a step link. The earlier draft's buy/existing path store (`nav-journey.ts`) was dropped: the owner asked for one fixed order per area.
- UI: `src/components/JourneyBar.tsx` (above the page) and `WorkflowNav.tsx` (below) are rendered by `Layout.tsx` whenever `journeyPosition` returns a step; home, help and about pages show neither. Routes and URLs unchanged.
- Verification: `npm run typecheck`, `npm run lint`, `npm test` (357 tests, incl. 10 new in `src/state/journey.test.ts`), `npm run build` all pass; `npx playwright test tests/browser/nav-journey.pw.ts` passes and writes the 1600x900 screenshots in `docs/screenshots/nav-journey/`.
- Next: owner review of the screenshots, add the AB# work item to the commit, open the PR to main.

## Surveyor v2.8.0 — AB#9075

- User authorized implementation, commit and push; completion requires a green GitHub Action and published website. Latest request explicitly includes version numbers and documentation.
- Branch: feat/workload-inventory-planning; push HEAD to origin/main. Starting revision: d0f2d3f, prior OEM publication run 34529852104 green.
- Implemented independent Zustand stores scoped by route context: existing surveyor-state stays with Workload Planning; surveyor-storage-state is standalone storage. Legacy routes redirect to workload routes. Existing projects remain readable.
- Two primary areas with persistent project name/save/open/compare/assumptions controls. Nested specialized planners and consolidated Help & Reference. Reviewed copy actions transfer hardware or storage designs without silently changing the other plan.
- Workload buying compares reviewed OEM examples within node/vendor/headroom constraints. Existing-hardware assessment includes extra-VM aggregate headroom. Inventory VMs that cannot fit one host's usable RAM fail fit checks.
- Storage-only PDF/XLSX/Markdown/project exports sanitize workload demand. Capacity chart accepts actual mixed-resiliency volume footprint.
- Version 2.8.0 in website/docs packages and lockfiles; release notes in root/docs changelogs and About; README, documentation homepage, planning guide, project format documentation updated.
- Files: src/App.tsx, scoped state hook/store/project, route-aware links, Layout and planning pages, recommendation engine, storage exporters, shared component hooks, CSS, unit/browser tests and docs.
- Verification: source review and git diff --check completed. No local build/test invoked; pipeline owns lint, unit tests, TypeScript/Vite, documentation and Chromium build/published checks.
- Pushed implementation b4ad995 and Vite type fix 3ccbe6c. Pipeline confirms lint, 347 tests, website build and documentation build pass. Browser runner required reading package metadata with Node's filesystem API instead of a bare JSON import; corrected before retrying publication.
- Run 34533117076 passed all 347 tests, website/docs builds and six Chromium checks before publishing b70c992. The public revision and assets were independently verified with Test-PublishedWebsite.ps1. Screenshots reviewed for overview, storage report and hardware options. Visual review found identical hardware/volume check headings; final label correction distinguishes them.
- Next: verify the final label-correction commit passes publication and live browser checks; close AB#9075 after acceptance.
- Preferences: use native Windows PowerShell, no WSL, call the product a website. No secrets committed. User authorization covers pushing and publishing through existing pipeline.
