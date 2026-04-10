# Azure Local Surveyor — Documentation

This directory contains the MkDocs Material documentation for the Azure Local Surveyor engine.

## Serving locally

```bash
pip install mkdocs-material
mkdocs serve
```

Open `http://127.0.0.1:8000`.

## Structure

```
docs/
  index.md               ← How to use the app (mirrors "How to Use" Excel sheet)
  engine/
    capacity.md          ← Capacity model formula walk-through
    volumes.md           ← Volume sizing and WAC GB explanation
    workloads.md         ← Generic VM workload planner
    avd.md               ← AVD session host sizing
    sofs.md              ← SOFS guest cluster sizing
    compute.md           ← CPU / memory model
    healthcheck.md       ← Validation rules
  reference/
    formula-map.md       ← Excel sheet ↔ TypeScript function mapping
    parity-tests.md      ← 20 golden scenario descriptions
```
