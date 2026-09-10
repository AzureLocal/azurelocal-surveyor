# Handoff

- Work: Added VM inventory, RVTools/performance import, unified workload totals, workload fit, project save/restore/comparison, and report/export integration. Related sizing issue #140 / AB#153 remains broader than this implementation.
- Files: src/engine inventory/planning/fit modules; store/project; inventory, workload, fit, project, home and report UI; exporters; README and CHANGELOG; regression tests.
- Verification: Earlier implementation passed 331 tests and lint; Windows typecheck passed before final project-validation/tests/documentation additions. Final build and tests delegated to the pipeline at the user's explicit request. No browser verification completed.
- Branch: feat/workload-inventory-planning; user explicitly requested commit and push to trigger the pipeline.
- Scope: Same-spec sizing within the existing 2–16 node calculator model. Multi-cluster placement and hardware catalog optimization are not implemented. Storage performance is informational, not certified.
- Preference: Use Windows directly. The user explicitly overrode the WSL build guidance and requested pipeline-owned builds. Refer to this product as a website.
- Next: Inspect the pipeline for the pushed commit; resolve any reported failure. Project schema and manifest additions should be documented further if the consumer contract changes.

## Publishing recovery

- The original website deploy workflow was removed in the CI migration. Only the docs-only workflow remained, and it failed because docs inherited a missing root Tailwind dependency.
- Restored one GitHub Actions build/publish workflow for main and PR verification. It runs lint, unit tests, website/docs builds, Chromium journey tests, Pages publishing, and public commit/asset/browser verification.
- Documentation publishes at /azurelocal-surveyor/docs/ in the same artifact. Its own PostCSS config prevents root Tailwind inheritance.
- Actual Pages website: https://azurelocal.cloud/azurelocal-surveyor/ (the README's former surveyor.azurelocal.cloud hostname does not resolve).
- Added pinned dependency lockfiles, Playwright verification, and a deployed build-info.json revision check. No local build was used for this publishing repair; CI owns builds per operator instruction.
- Acceptance: do not report completion until the new GitHub Actions run is green and the public website serves the pushed revision and passes the browser journey.

## OEM preset refresh — AB#9074

- Reviewed primary OEM sources on 2026-09-10. Model sources, assumptions and
  limitations are recorded in docs/reference/oem-presets.md and each preset.
- Updated four vendor files to 21 planning examples. Corrected Dell generation
  and form factors, HPE tiers, and DataON RAM; added current and edge models;
  removed unverified DataON AZS-7248 and unsupported HPE/DataON hybrid examples.
- HardwareForm now exposes source/date, example quantities and customization
  notice. Browser test exercises every preset and hybrid-to-flash transitions.
- Added the user-requested sidebar link back to Hyper-V Surveyor, matching the
  reciprocal link on that website. Updated architecture/formula docs and changelog.
- Branch: feat/workload-inventory-planning. No local build run; the GitHub Actions
  build, tests and published revision verification are the acceptance gate.
- Prior workload/publishing changes are complete: action 34527379640 succeeded
  for 6b0f7e77ca97de0727d60efe5e3e34bc5966ba7e, including live browser checks.
- This is a curated OEM list, not a complete mirror of the dynamic Microsoft
  catalog. Exact procurement BOMs and additional OEMs remain outside this refresh.
