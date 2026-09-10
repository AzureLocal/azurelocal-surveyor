import { Link as RouterLink, type LinkProps } from 'react-router-dom'
import { usePlanningArea, planPath } from '../state/planning-area'

export function Link({ to, ...props }: LinkProps) {
  const area = usePlanningArea()
  return <RouterLink to={typeof to === 'string' ? planPath(area, to) : to} {...props} />
}
