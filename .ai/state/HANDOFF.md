# Handoff

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
- Next: commit/push, inspect action failures and fix as needed, verify build-info.json matches final commit and inspect browser evidence. Close AB#9075 only after live acceptance.
- Preferences: use native Windows PowerShell, no WSL, call the product a website. No secrets committed. User authorization covers pushing and publishing through existing pipeline.
