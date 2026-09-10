import { useLocation } from 'react-router-dom'

export function usePlanningArea() {
  return useLocation().pathname.startsWith('/storage') ? 'storage' as const : 'workload' as const
}

export function planPath(area: 'storage' | 'workload', path: string) {
  const shared = ['/hardware', '/volumes', '/drive-layout', '/reports', '/projects', '/capacity']
  if (shared.includes(path)) return `${area === 'storage' ? '/storage' : '/planning'}${path}`
  if (['/workloads', '/fit', '/avd', '/aks', '/sofs', '/mabs', '/specialized', '/recommendations'].includes(path)) return `/planning${path}`
  if (path === '/docs') return '/help'
  return path
}
