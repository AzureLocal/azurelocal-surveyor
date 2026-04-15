# Phase 1B: Update About Page Release History

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P2  
**Estimate:** S  

---

## Context

The About page's release history section stops at v1.4.0. Versions v1.5.0, v1.6.0, v1.7.0, and v2.0.0 are missing. Users and stakeholders need to see what shipped in each release.

## Current State

- **File:** `src/pages/AboutPage.tsx` ~lines 172–225
- Release history entries exist for v1.0.0 through v1.4.0
- No entries for v1.5.0, v1.6.0, v1.7.0, or v2.0.0

## Required Changes

1. Add a v1.5.0 release entry with its changelog highlights
2. Add a v1.6.0 release entry (Issues #120, #121, #115, #103)
3. Add a v1.7.0 release entry (Architecture docs — Issues #90, #118)
4. Add a v2.0.0 release entry (Comprehensive Quality Overhaul — this Epic #122)
5. Follow the existing format/pattern used by v1.0.0–v1.4.0 entries
6. Source changelog details from `CHANGELOG.md` in the repo root

## Acceptance Criteria

- [ ] About page shows release entries for v1.5.0, v1.6.0, v1.7.0, and v2.0.0
- [ ] Each entry includes a version number, date, and summary of key changes
- [ ] Entries follow the same visual format as existing v1.0.0–v1.4.0 entries
- [ ] The v2.0.0 entry accurately describes the scope of the comprehensive overhaul
- [ ] Changelog details match what is recorded in `CHANGELOG.md`
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms proper rendering and no layout breaks
