## Summary

The Custom Workloads JSON import feature was added in v2.0.0 but test coverage is limited to basic engine unit tests. We need broader testing across the full import lifecycle: schema validation, UI feedback, edge cases, and round-trip export/import consistency.

## Background

Custom workloads can be imported via JSON on the Workloads page. The import pipeline runs Zod schema validation and surfaces errors, but there are many edge cases that have not been systematically tested — especially around malformed inputs, partial payloads, and what happens when an imported workload references fields that were removed in the v2.0 schema (e.g. the old `resiliency` field).

## Scope of Testing Needed

### 1. Schema Validation Coverage
- [ ] Valid minimal payload (only required fields) — should import cleanly
- [ ] Valid full payload (all optional fields present) — should import cleanly
- [ ] Missing required fields (`name`, `vmCount`, `vCpusPerVm`, `memoryPerVmGB`) — should surface clear per-field error messages
- [ ] Extra/unknown fields — should they be stripped silently or warned? (define behavior)
- [ ] `internalMirrorFactor` out of range (< 1 or > 4) — should be rejected with message
- [ ] `osDiskPerVmGB` negative value — should be rejected
- [ ] `enabled: false` in payload — workload should be imported but disabled

### 2. Legacy / Deprecated Field Handling
- [ ] Import payload containing the old `resiliency` field (removed in v9) — should be stripped without error, not crash
- [ ] Import payload from v1.x era (pre-v2.0 schema) — define whether we support graceful degradation or surface a version mismatch warning

### 3. UI / UX Testing
- [ ] Import a single workload — appears in list, correct values shown
- [ ] Import multiple workloads in one JSON array — all appear
- [ ] Import duplicate name — what happens? (overwrite? append with suffix? error?)
- [ ] Import then immediately export (JSON round-trip) — exported JSON must be identical to source
- [ ] Import then share via URL — workload survives Zustand serialize/deserialize round-trip
- [ ] Error banner dismisses cleanly after fixing and re-importing

### 4. Engine Integration
- [ ] Imported workload with `internalMirrorFactor: 2` — verify engine doubles the data volume footprint
- [ ] Imported workload with `osDiskPerVmGB: 0` — verify no OS disk volume generated
- [ ] Imported workload with `enabled: false` — verify excluded from totalStorageTB, volumes, and health check
- [ ] Imported workload with large `vmCount` (e.g. 1000 VMs) — verify no overflow or display breakage

### 5. Security / Input Sanitisation
- [ ] XSS attempt in `name` field — ensure rendered safely (React escapes by default, but verify)
- [ ] Extremely long string in `name` — should be truncated or rejected
- [ ] Non-JSON input pasted into import box — should surface clear parse error, not crash

## Acceptance Criteria

- [ ] Test file `src/engine/__tests__/custom-workloads.import.test.ts` covering all schema validation and engine integration cases above
- [ ] UI behavior for duplicate names is defined and documented
- [ ] Legacy field stripping behavior is explicitly tested
- [ ] All new tests pass in CI (`npm test`)

## Files Likely Involved

- `src/engine/custom-workloads.ts` — engine computation
- `src/components/CustomWorkloads.tsx` — import UI and Zod validation
- `src/state/store.ts` — Zustand state for custom workloads
- New test file: `src/engine/__tests__/custom-workloads.import.test.ts`
