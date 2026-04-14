# AVD

The AVD engine lives in `src/engine/avd.ts`, with the main UI in `src/components/AvdPlanner.tsx` and page framing in `src/pages/AvdPage.tsx`.

## Current behavior in Surveyor

Surveyor intentionally uses two different user counts for two different sizing jobs:

- **Concurrent users** drive session host count, compute totals, and bandwidth.
- **Total users** drive FSLogix profile storage and Office Container storage.

The engine does this explicitly:

- `sizingUsers = concurrentUsers > 0 ? concurrentUsers : totalUsers`
- `sessionHostCount = ceil(sizingUsers / usersPerHost)`
- `totalProfileStorageTB = totalUsers * effectiveProfileSizeGB / 1024`
- `totalOfficeContainerStorageTB = totalUsers * officeContainerSizeGB / 1024`

That split is intentional and correct for Azure Virtual Desktop planning.

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