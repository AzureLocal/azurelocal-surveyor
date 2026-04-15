# Phase 1D: Verify and Update References Page

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P3  
**Estimate:** S  

---

## Context

The References page contains links to Microsoft documentation and external resources. All links need to be verified for accuracy and new references should be added for workloads that are now supported (AKS on Azure Local, MABS, custom workloads).

## Current State

- **File:** `src/pages/ReferencesPage.tsx`
- Contains ~17 reference links to Microsoft Learn and other documentation
- May be missing references for:
  - AKS on Azure Local
  - Microsoft Azure Backup Server (MABS) on Azure Local
  - Custom workload planning guidance

## Required Changes

1. Audit all existing reference links — verify each URL is valid and returns a 200 status
2. Replace any broken or redirected links with current URLs
3. Add references for AKS on Azure Local if missing:
   - AKS on Azure Local overview
   - AKS network requirements
   - AKS storage requirements
4. Add references for MABS on Azure Local if missing:
   - MABS installation on Azure Local
   - MABS sizing guidance
5. Add references for custom workload planning if missing
6. Ensure references are logically grouped/categorized

## Acceptance Criteria

- [ ] All existing reference links are verified as working (no 404s, no redirect loops)
- [ ] Broken links are replaced with current Microsoft Learn URLs
- [ ] AKS on Azure Local references are present (at least 2 links)
- [ ] MABS references are present (at least 1 link)
- [ ] All new links open in a new tab with appropriate rel attributes
- [ ] References are logically organized by topic/workload
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms all links render correctly and are clickable
