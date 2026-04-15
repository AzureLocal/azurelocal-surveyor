# Phase 1A: Remove Home Nav Item

**Epic:** #122 — Surveyor v2.0 Comprehensive Quality Overhaul  
**Priority:** P3 (quick fix)  
**Estimate:** XS  

---

## Context

The navigation bar currently includes a "Home" button alongside the logo. The logo already navigates to `/`, making the Home button redundant. This creates navigational clutter and is inconsistent with standard web conventions where the logo serves as the home link.

## Current State

- **File:** `src/components/Layout.tsx` ~line 40
- NavItem: `<NavItem to="/" label="Home" icon={Home} end />`
- Logo already links to `/` (line ~30)

## Required Changes

1. Delete the Home `NavItem` from the navigation list in `Layout.tsx`
2. Remove the `Home` icon from `lucide-react` imports if it is no longer used elsewhere in the file
3. Verify no other component depends on a Home nav item

## Acceptance Criteria

- [ ] The Home button is no longer present in the navigation bar
- [ ] The logo still navigates to `/` when clicked
- [ ] The `Home` icon import is removed from `Layout.tsx` if unused
- [ ] No console errors or broken navigation after removal
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass (`npm test`)
- [ ] Visual inspection confirms navigation is clean and the remaining nav items render correctly
