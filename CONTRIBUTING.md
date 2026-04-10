# Contributing to Azure Local Surveyor

Thank you for your interest in contributing.

## Ground rules

1. **Every engine change needs a parity test.** Before merging any change to `src/engine/`, add or update a test in `src/engine/__tests__/`. The 20 golden scenarios must always pass.
2. **Engine modules are pure TypeScript.** No React, no DOM, no side effects. All inputs arrive as plain objects. Tests run in Node with `vitest`.
3. **Keep Calculator TB and WAC GB distinct.** The `toWacSize()` function floors to the nearest GB. Never round up. Never mix the two in the same UI element without a clear label.
4. **Workloads stay separate.** Generic VMs → WorkloadPlanner. AVD → AvdPlanner. SOFS → SofsPlanner. Adding a new workload type means a new engine file, a new page, and a new route — not a hidden tab inside an existing page.

## Development setup

```bash
git clone https://github.com/AzureLocal/azurelocal-surveyor.git
cd azurelocal-surveyor
npm install
npm run dev        # dev server
npm test           # run all parity + unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build
```

## Adding a new workload type

1. Create `src/engine/<workloadname>.ts` with a `compute<WorkloadName>()` function.
2. Export it from `src/engine/index.ts`.
3. Add types to `src/engine/types.ts`.
4. Add golden scenarios to `src/engine/__tests__/engine.test.ts`.
5. Create `src/components/<WorkloadName>Planner.tsx`.
6. Create `src/pages/<WorkloadName>Page.tsx`.
7. Register the route in `src/App.tsx`.
8. Add the nav link in `src/components/Layout.tsx`.

## Branch strategy

- `main` — always deployable; protected
- `dev` — integration branch; PRs target here
- Feature branches: `feat/<name>`, bug fixes: `fix/<name>`

## Pull requests

- Describe what Excel sheet or formula the change relates to.
- Include before/after values from the reference workbook.
- All CI checks must pass.

## Reporting issues

Use GitHub Issues. Include: node count, drive config, resiliency type, and the values the calculator produces vs. what the tool produces.
