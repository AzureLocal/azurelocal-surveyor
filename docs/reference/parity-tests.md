# Parity Tests

The 20 golden scenarios in `src/engine/__tests__/capacity.parity.test.ts` validate that the TypeScript engine produces the same effective usable TB as the Excel workbook.

## Tolerance

All comparisons use a tolerance of **±0.01 TB**.

## Scenarios

| # | Nodes | Drives / node | Cap (TB) | Resiliency | Reserve | Expected (TB) |
|---|---|---|---|---|---|---|
| 01 | 2 | 4 | 4.0 | 2-way | 0 | 12.32 |
| 02 | 4 | 6 | 8.0 | 2-way | 0 | 73.92 |
| 03 | 4 | 8 | 10.0 | 3-way | 1 | 65.87 |
| 04 | 6 | 8 | 10.0 | 3-way | 0 | 123.20 |
| 05 | 8 | 10 | 10.0 | 2-way | 2 | 246.40 |
| 06 | 8 | 12 | 12.0 | MAP | 0 | 443.52 |
| 07 | 16 | 24 | 3.84 | 2-way | 4 | 1,053.27 |
| 08 | 4 | 4 | 2.0 | 2-way | 0 | 12.32 |
| 09 | 6 | 6 | 2.0 | 3-way | 0 | 18.48 |
| 10 | 8 | 8 | 4.0 | MAP | 0 | 98.56 |
| 11 | 4 | 6 | 4.0 | 3-way | 1 | 29.33 |
| 12 | 2 | 8 | 8.0 | 2-way | 0 | 49.28 |
| 13 | 4 | 12 | 6.0 | MAP | 0 | 110.88 |
| 14 | 6 | 10 | 12.0 | 3-way | 2 | 109.73 |
| 15 | 8 | 16 | 4.0 | 2-way | 0 | 197.12 |
| 16 | 16 | 8 | 2.0 | 3-way | 0 | 131.07 |
| 17 | 4 | 6 | 6.0 | 2-way | 0 | 55.44 |
| 18 | 2 | 4 | 4.0 | 2-way | 0 | 12.32 |
| 19 | 4 | 8 | 8.0 | MAP | 1 | 73.52 |
| 20 | 8 | 12 | 8.0 | 3-way | 0 | 164.57 |

Source values derived from the `S2D_Capacity_Calculator.xlsx` reference workbook.
Run `npm test` to verify all 20 pass.
