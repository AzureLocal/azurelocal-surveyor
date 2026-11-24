// Minimal typings for the one js-yaml function Surveyor uses (no @types/js-yaml in this project): reading an infrastructure.yml.
declare module 'js-yaml' {
  export function load(input: string): unknown
}
