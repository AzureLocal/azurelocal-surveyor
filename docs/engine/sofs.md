# SOFS

The SOFS engine lives in `src/engine/sofs.ts` and the planner UI lives in `src/components/SofsPlanner.tsx`.

## What Surveyor models

Surveyor treats SOFS as a **guest VM cluster** running on Azure Local and hosting SMB shares for FSLogix profile containers.

The model has three layers:

1. Azure Local host cluster storage that backs the SOFS guest VMs
2. SOFS guest cluster storage and data protection inside the guest cluster
3. FSLogix clients mounting SMB shares from SOFS

## Key calculations

- profile demand = `userCount * profileSizeGB / 1024`
- redirected folder demand = `userCount * redirectedFolderSizeGB / 1024`
- total logical demand = profile + redirected folders
- guest-cluster internal footprint = total logical demand * internal mirror factor
- IOPS estimate = concurrent users when provided, otherwise total users

This separation matters because:

- **total users** drive logical storage demand
- **concurrent users** primarily affect IOPS and login storm estimates

## Shared FSLogix profile size with AVD

Surveyor now links SOFS to the subset of AVD host pools that actually use SOFS for profile storage.

- the SOFS planner receives aggregated users and concurrency from only SOFS-targeted AVD pools
- the SOFS planner receives a weighted-average profile size across those SOFS-targeted pools
- if SOFS is enabled, changing SOFS-targeted AVD pool profile sizes updates the linked SOFS profile size
- if AVD is targeting SOFS for profile storage, changing the SOFS profile size pushes back into every SOFS-targeted AVD pool
- both pages show whether the current values are aligned

This link only covers the shared per-user profile size assumption. SOFS guest VM sizing, guest-cluster mirror choice, redirected-folder sizing, and Azure Local host-volume planning remain SOFS-specific inputs.

## When to use SOFS

Microsoft's Azure Virtual Desktop on Azure Local guidance recommends an SMB share for FSLogix profile containers and specifically recommends a VM-based file share cluster using Storage Spaces Direct on Azure Local. For larger deployments with higher storage requirements, Microsoft recommends keeping profile storage external to the Azure Local compute footprint so storage and compute can scale independently.

Reference:

- `https://learn.microsoft.com/azure/virtual-desktop/azure-local-overview#fslogix-profile-containers-storage`
- `https://learn.microsoft.com/windows-server/failover-clustering/sofs-overview`

## Practical reading of the numbers

- `totalStorageTB` is the logical file-share demand.
- `internalFootprintTB` is the guest-cluster storage consumed after guest-side mirroring.
- the Azure Local host-side volume requirement must still be planned separately in the host cluster.
