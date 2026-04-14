# Compute

The compute engine lives in `src/engine/compute.ts`.

## Formula flow

```text
physical cores
  -> logical cores (hyperthreading optional)
  -> oversubscription ratio
  -> minus system-reserved vCPUs
  -> usable vCPUs

physical memory
  -> minus system-reserved memory
  -> usable memory
```

Surveyor also computes an **N+1** view by removing one node from the cluster and recomputing usable vCPU and memory.

## Why N+1 matters

Production Azure Local clusters should continue serving workloads if one node is in maintenance or unavailable. Surveyor therefore shows whether the planned workload still fits with one node down.

If the workload does not fit in N+1 capacity, the plan is likely fragile even if the cluster looks fine in a steady-state all-nodes-healthy scenario.

## Inputs that affect compute output

- node count
- physical cores per node
- memory per node
- hyperthreading enabled or disabled
- vCPU oversubscription ratio
- system reserved vCPUs per node
- system reserved memory per node

## Guidance

- Use oversubscription deliberately. It increases theoretical capacity, but it does not create real CPU.
- Validate bursty workloads such as VDI sign-in storms with pilot or simulation testing.
- Treat N+1 fit as the minimum bar for production readiness.