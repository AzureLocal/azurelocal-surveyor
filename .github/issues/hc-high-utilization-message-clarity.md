## Summary

After adding all suggested volumes, the Volume Health Check shows **Passed** (green) but also contains a `HC_HIGH_UTILIZATION` warning about pool utilization exceeding 70% "to maintain headroom for rebuild after a drive failure." Users are confused: they already configured reserve drives on the Hardware page — why is there still a rebuild-headroom warning?

## The Confusion — Reserve Drives ≠ 70% Headroom

These are two completely separate mechanisms and **both are required**. The current health check message does not explain this, leaving users thinking the reserve already covers the headroom requirement.

| Mechanism | What it does | Configured where |
|---|---|---|
| **Reserve drives** | One physical drive per node (max 4) is held back so S2D has a destination disk to copy repaired data onto after a failure | Hardware page — automatic, not user-configurable |
| **70% pool headroom** | Free space *inside* the pool that S2D needs to relocate data blocks while a rebuild is in progress. During a drive failure + rebuild, S2D shuffles data around continuously. If the pool is 100% full of volume data, there is nowhere to move blocks during repair — the rebuild stalls or fails. | Not configurable — it's a soft guideline based on your pool size |

**In plain English:** The reserve drive is the *destination disk*. The 70% headroom is the *free road* S2D needs to drive data along during the repair. You need both.

## Current Behavior

- `HC_HIGH_UTILIZATION` is a `warning` severity, so `result.passed` remains `true`
- The health check banner shows green "Passed" with the warning inside
- Message: *"Microsoft recommends staying below 70% to maintain rebuild headroom after a drive failure"*
- No mention of how this relates to reserve drives
- No mention that the suggested volumes are intentionally sized close to the effective usable limit

## Expected Behavior

1. The `HC_HIGH_UTILIZATION` warning message should clearly explain **both** mechanisms and why this warning exists even with reserve drives configured
2. The warning should distinguish between "you are over 70% because you added all suggested volumes (expected)" vs "you are over 70% because you have more data than this cluster can comfortably hold (concern)"
3. Ideally, the Volume Detail suggested volumes should leave ~30% headroom by default (or at minimum warn the user at add-all time that utilization will exceed the 70% guideline)

## Proposed Message Update

Current:
> Pool utilization is 98.2%. Microsoft recommends staying below 70% to maintain rebuild headroom after a drive failure.

Proposed:
> Pool utilization is 98.2% of available pool space. **Reserve drives** (configured on the Hardware page) provide physical destination disks for rebuild — but S2D also needs **free space inside the pool** to shuffle blocks during the repair process. Microsoft recommends keeping pool utilization below 70% so a rebuild can complete without stalling. Consider reducing volume sizes or adding more drives to leave rebuild headroom.

## Implementation Notes

- Change is in `src/engine/healthcheck.ts` — the `HC_HIGH_UTILIZATION` issue message and outcome fields
- Consider also updating the `ruleSource` detail to link to the Azure Local pool efficiency docs
- Companion issue: pool bar going red at 100% when suggested volumes are added (#146)

## References

- [Plan volumes — Azure Local (Microsoft Learn)](https://learn.microsoft.com/azure-stack/hci/concepts/plan-volumes)
- [Fault tolerance and storage efficiency (Microsoft Learn)](https://learn.microsoft.com/azure-stack/hci/concepts/fault-tolerance)
