# AVD

The AVD engine lives in `src/engine/avd.ts`, with the main UI in `src/components/AvdPlanner.tsx` and page framing in `src/pages/AvdPage.tsx`.

## Current behavior in Surveyor

Surveyor now supports multiple AVD host pools in a single planning model. Each pool carries its own:

- total users
- concurrent users
- workload type
- session model
- profile size override
- Office Container settings
- data disk per host
- profile storage location

Aggregate AVD results sum compute and Azure Local-hosted storage across all pools while keeping externally hosted profile and Office Container storage separate.

Surveyor intentionally uses two different user counts for two different sizing jobs:

- **Concurrent users** drive session host count, compute totals, and bandwidth.
- **Total users** drive FSLogix profile storage and Office Container storage.

The engine does this explicitly per pool:

- `sizingUsers = concurrentUsers > 0 ? concurrentUsers : totalUsers`
- `sessionHostCount = ceil(sizingUsers / usersPerHost)`
- `totalProfileStorageTB = totalUsers * effectiveProfileSizeGB / 1024`
- `totalOfficeContainerStorageTB = totalUsers * officeContainerSizeGB / 1024`

That split is intentional and correct for Azure Virtual Desktop planning. Aggregate results then sum those per-pool outputs.

## Profile storage location handling

Surveyor now distinguishes between AVD storage that lives on the Azure Local cluster and storage that lives elsewhere:

- `s2d` pools count profile and Office Container storage into AVD cluster totals
- `sofs`, `azure-files`, and `external` pools keep that profile-related storage out of the Azure Local AVD storage total
- externally hosted profile and Office Container demand is surfaced separately as `totalExternalStorageTB`

This prevents Azure Files, SOFS-backed, or third-party NAS profile storage from being double-counted as local cluster capacity.

## Profile size sync with SOFS

When one or more AVD pools target SOFS for profile storage, Surveyor aggregates those SOFS-targeted pools into a shared SOFS input set:

- linked user count = sum of users across SOFS-targeted pools
- linked concurrency = sum of sizing users across SOFS-targeted pools
- linked profile size = weighted average FSLogix profile size across SOFS-targeted pools

When AVD is explicitly targeting SOFS for profile storage, the link is bidirectional:

- changing SOFS-targeted AVD pool profile sizes updates the linked SOFS profile size
- changing the SOFS FSLogix profile size pushes back into every SOFS-targeted AVD pool
- both planner pages show whether the values are currently in sync

User counts and concurrency are also part of the AVD-to-SOFS sync path now, but only for the pools that actually use SOFS.

## Microsoft guidance behind the split

Microsoft's session host sizing guidance says you should estimate the number of **concurrent users** and plan enough session host capacity for expected peaks, especially logon bursts. Microsoft also recommends pilot or simulation testing and keeping burst headroom for times when many users sign in together.

Microsoft's FSLogix guidance describes a **per-user profile container** stored as a VHD(X) on SMB storage. The profile exists for each assigned user whether they are currently active or not, so storage demand follows the total user population rather than the concurrent active population.

Relevant references:

- Azure Virtual Desktop on Azure Local: `https://learn.microsoft.com/azure/virtual-desktop/azure-local-overview`
- Session host virtual machine sizing guidelines: `https://learn.microsoft.com/windows-server/remote/remote-desktop-services/session-host-virtual-machine-sizing-guidelines`
- FSLogix profile containers: `https://learn.microsoft.com/en-us/fslogix/how-to-configure-profile-containers`
- FSLogix container types: `https://learn.microsoft.com/en-us/fslogix/concepts-container-types`

## Burst behavior

If real-world concurrency exceeds the planned concurrent user value, the first pressure points are:

- slower sign-ins during bursts
- overloaded session hosts
- reduced app responsiveness and higher input delay
- failed or degraded sessions if the host pool is saturated

Profile storage is not the first thing to break in that scenario because Surveyor already sizes profile and Office Container capacity against **total users**.

## RemoteApp on Azure Local

Azure Virtual Desktop on Azure Local supports standard Azure Virtual Desktop host pools, workspaces, and application groups. Microsoft documents RemoteApp application groups as a normal AVD construct, and pooled host pools can have both Desktop and RemoteApp application groups assigned.

Important behavior:

- one pooled host pool can have Desktop and RemoteApp application groups
- users who are assigned to both are governed by the host pool's **preferred application group type**
- RemoteApp availability is therefore a host-pool and app-group concern, not a different Azure Local infrastructure type

What Surveyor does **not** do yet:

- it does not expose `appGroupType` in the AVD model
- it does not apply separate RemoteApp density defaults

For now, use Surveyor's AVD output as the host-pool baseline and validate higher-density RemoteApp assumptions with pilot or simulated load testing.
