import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import { useSurveyorStore as workloadPlanStore, type createSurveyorStore } from './store'

export const PlanStoreContext = createContext<ReturnType<typeof createSurveyorStore>>(workloadPlanStore)

/** All website inputs and exports resolve to the plan selected by the route. */
export function useSurveyorStore() {
  return useStore(useContext(PlanStoreContext))
}
