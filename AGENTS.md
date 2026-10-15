# azurelocal-surveyor — Agent instructions

<!--
  AGENTS.md is the canonical, cross-tool instruction file for this repo.
  Codex CLI, Cursor, and VS Code Copilot read it natively; Claude Code
  imports it via CLAUDE.md; Gemini reads it via contextFileName.
  Keep it THIN — it is a bootstrap and an offline fallback, not a full
  standards library. The authoritative source is the HCS Governance MCP.
-->

## What this repo is

Azure Local Surveyor is a static, in-browser capacity planning tool for hyperconverged Azure Local (React, TypeScript, Vite, Zustand, Vitest). It sizes storage, compute and workloads before deployment. It is not a deployment tool, makes no network calls and holds no secrets.

**Working rules for this repo**

- The engine in `src/engine` is pure TypeScript. Every engine change needs a test with hand-checked numbers (see `CONTRIBUTING.md`).
- Every Azure Local fact encoded in the engine is registered in `src/engine/facts.ts` with a Microsoft Learn URL and a verified date. Learn wins over any other source; update the registry and the References page together.
- Public wording: describe the planning basis as Azure Local 12.2609 (latest). No customer or private tenant data; example values only.
- Validation before any commit: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. CI (`.github/workflows/deploy.yml`) runs lint, tests, build and the Playwright checks.
- `package-lock.json` is the only lockfile. SheetJS is installed from its vendor tarball with the integrity hash pinned in the lockfile; do not replace it with the npm `xlsx` package.
- The project file `stateVersion` (src/state/project.ts) and the schemas in `docs/reference` change together; downstream importers read `schemaVersion`.

---

## Start here — connect to the HCS Governance MCP

This repo is governed by the **HCS Governance MCP server** (connection details in
[`.ai/mcp/mcp-servers.md`](.ai/mcp/mcp-servers.md)). It is the source of truth for
standards, hard rules, and orchestration guidance.

**At session start, call:**

```
bootstrap(repo="azurelocal-surveyor", client="<your client: claude-code | codex | gemini | cursor | vscode>")
```

It returns this repo's scope, the applicable hard rules, the index of applicable
standards, the `.ai/` session protocol, and orchestration guidance shaped for your
client's capability tier. **Prefer a live MCP answer over anything written in this file** —
this file is the offline fallback.

---

## Offline fallback (when the MCP server is unreachable)

**Standards scope:** `azurelocal` <!-- hcs | tierpoint-prodtech | azurelocal -->

**Hard rules digest:**

- No secrets, tokens, passwords, subscription/tenant/client IDs, or connection strings in any committed file.
- All scripts: PowerShell 7+ — `#Requires -Version 7.0`, `Set-StrictMode -Version Latest`, `$ErrorActionPreference = 'Stop'`. Never PS 5.1, never Bash.
- All documentation is Markdown only. Diagrams are draw.io only — commit the `.drawio` XML alongside any exported `.png`.
- Commit format: `type(scope): short description` — types `feat`, `fix`, `docs`, `chore`, `refactor`, `test` — with an `AB#<id>` work-item reference.

**Standards reference (public site — no auth required):**

- Governance — <https://platform.hybridsolutions.cloud/standards/governance/>
- Scripting — <https://platform.hybridsolutions.cloud/standards/scripting/>
- Automation — <https://platform.hybridsolutions.cloud/standards/automation/>
- Documentation — <https://platform.hybridsolutions.cloud/standards/documentation/>
- Agents (multi-model) — <https://platform.hybridsolutions.cloud/standards/agents/>
- AI workspace — <https://platform.hybridsolutions.cloud/standards/ai-workspace/>
- Full index — <https://platform.hybridsolutions.cloud/standards/>

---

## Session protocol

1. **Read `.ai/state/` first** — `CURRENT_TASK.md`, then `HANDOFF.md`, then `OPEN_QUESTIONS.md`.
2. Then read `.ai/memory/` for durable context (`PROJECT_CONTEXT.md`, `DECISIONS.md`, `COMMANDS.md`, `GOTCHAS.md`).
3. Summarise your believed state back to the operator before making changes.
4. **Before ending the session, update `.ai/state/HANDOFF.md`** — what changed, files touched, commands run and results, branch, blockers, next steps.

Full contract: the [AI workspace standard](https://platform.hybridsolutions.cloud/standards/ai-workspace/).

---

## Key facts

| Fact | Value |
|---|---|
| ADO org | <https://dev.azure.com/hybridcloudsolutions> |
| ADO project | N/A - see registry.yaml `ado_project` or ask the HCS Governance MCP `get_repo` for this repo's work-item tracking project |
| Area path | N/A - see registry.yaml or ask the HCS Governance MCP |
| Key Vault | kv-hcs-vault-01 |
| Work item format | `AB#<id>` in commits and PRs |
