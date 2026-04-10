# reference/

This directory holds reference materials for the Azure Local Surveyor.

## Required file

Place the Excel source workbook here:

```
reference/S2D_Capacity_Calculator.xlsx
```

The workbook lives in the `azurelocal-toolkit` repo:

```
E:\git\azurelocal-toolkit\tools\planning\S2D_Capacity_Calculator.xlsx
```

Copy it here manually — the file is not committed to source control (`.gitignore` excludes `*.xlsx` from this directory to avoid binary bloat in git history).

## Purpose

The Excel workbook is the source of truth for all capacity formulas. The engine modules in `src/engine/` port its formulas to TypeScript. The 20 golden scenarios in `src/engine/__tests__/capacity.parity.test.ts` are validated against the workbook's output rows.

If formula logic changes in the workbook, update the corresponding engine module and add or update a parity scenario.
