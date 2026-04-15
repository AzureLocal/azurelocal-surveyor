# Phase 1C: Surface Architecture Docs in Docs Page

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P2  
**Estimate:** S  

---

## Context

Architecture documentation was added in v1.7.0 (Issues #90, #118) at `docs/architecture/overview.md` and `docs/architecture/engine-flow.md`. These documents are in the repository but are not surfaced in the Docs page UI. Users have no way to discover them through the application.

## Current State

- **File:** `src/pages/DocsPage.tsx`
- The Docs page uses a hardcoded `DOCS` array to render documentation links
- Architecture docs exist at:
  - `docs/architecture/overview.md`
  - `docs/architecture/engine-flow.md`
- Neither document is referenced in the `DOCS` array

## Required Changes

1. Add an "Architecture" section/category to the `DOCS` array in `DocsPage.tsx`
2. Include links to `docs/architecture/overview.md` and `docs/architecture/engine-flow.md` on GitHub
3. Provide appropriate titles and descriptions for each document
4. Follow the existing pattern used by other entries in the `DOCS` array

## Acceptance Criteria

- [ ] Docs page displays an "Architecture" section with at least two entries
- [ ] "Architecture Overview" links to `docs/architecture/overview.md` on GitHub
- [ ] "Engine Flow" links to `docs/architecture/engine-flow.md` on GitHub
- [ ] Links open in a new tab (target="_blank" with rel="noopener noreferrer")
- [ ] The new section follows the same visual pattern as existing doc sections
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms the architecture docs section renders correctly
