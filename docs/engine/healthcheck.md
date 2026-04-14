# Health Check

The health-check engine lives in `src/engine/healthcheck.ts`.

## Severity model

- **Error**: the plan is invalid or likely to fail in deployment
- **Warning**: the configuration can work but is outside recommended practice
- **Info**: advisory guidance for optimization or operational clarity

## What the engine validates

Health checks span more than storage math. Current checks include:

- minimum node count for Azure Local and chosen resiliency
- per-volume 64 TB maximum
- pool over-capacity and high utilization
- vCPU and memory overcommit beyond available capacity
- thin provisioning risk
- drive-count and hardware advisories
- volume-count balance across nodes

## Important distinction

The health check combines outputs from multiple engines:

- capacity
- volumes
- compute
- workload totals

That makes it the final gate for answering, "Does this full plan actually fit?"

## Recommended reading order

1. Fix all errors.
2. Review warnings for production risk.
3. Use info messages to improve balance, resilience, and long-term operability.