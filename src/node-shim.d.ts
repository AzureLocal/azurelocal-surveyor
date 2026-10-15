// Minimal typings for the Node file APIs used by repository guard tests (no @types/node in this project).
declare module 'node:fs' {
  export function readdirSync(path: unknown, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[]
  export function readFileSync(path: unknown, encoding: 'utf8'): string
}
