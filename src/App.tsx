import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import HardwarePage from './pages/HardwarePage'
import WorkloadsPage from './pages/WorkloadsPage'
import AvdPage from './pages/AvdPage'
import SofsPage from './pages/SofsPage'
import VolumesPage from './pages/VolumesPage'
import ReportsPage from './pages/ReportsPage'
import ThinProvisioningPage from './pages/ThinProvisioningPage'
import ReferencesPage from './pages/ReferencesPage'
import AksPage from './pages/AksPage'
import DriveLayoutPage from './pages/DriveLayoutPage'
import MabsPage from './pages/MabsPage'
import AboutPage from './pages/AboutPage'
import Layout from './components/Layout'
import FitPage from './pages/FitPage'
import ProjectPage from './pages/ProjectPage'
import PlanningHomePage from './pages/PlanningHomePage'
import StorageHomePage from './pages/StorageHomePage'
import StorageCapacityPage from './pages/StorageCapacityPage'
import StorageReportPage from './pages/StorageReportPage'
import SpecializedPage from './pages/SpecializedPage'
import RecommendationsPage from './pages/RecommendationsPage'
import HelpPage from './pages/HelpPage'
import { PlanStoreContext } from './state/usePlanStore'
import { storagePlanStore, useSurveyorStore as workloadPlanStore } from './state/store'

const legacy = ['hardware', 'workloads', 'fit', 'projects', 'avd', 'sofs', 'aks', 'volumes', 'drive-layout', 'mabs', 'reports']
export default function App() {
  const storage = useLocation().pathname.startsWith('/storage')
  return <PlanStoreContext.Provider value={storage ? storagePlanStore : workloadPlanStore}>
    <Layout key={storage ? 'storage' : 'workload'}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/storage" element={<StorageHomePage />} />
        <Route path="/planning" element={<PlanningHomePage />} />
        {['storage', 'planning'].map(area => <Route key={area}>
          <Route path={'/' + area + '/hardware'} element={<HardwarePage />} />
          <Route path={'/' + area + '/volumes'} element={<VolumesPage />} />
          <Route path={'/' + area + '/drive-layout'} element={<DriveLayoutPage />} />
          <Route path={'/' + area + '/projects'} element={<ProjectPage />} />
        </Route>)}
        <Route path="/storage/capacity" element={<StorageCapacityPage />} />
        <Route path="/storage/reports" element={<StorageReportPage />} />
        <Route path="/planning/workloads" element={<WorkloadsPage />} />
        <Route path="/planning/specialized" element={<SpecializedPage />} />
        <Route path="/planning/recommendations" element={<RecommendationsPage />} />
        <Route path="/planning/fit" element={<FitPage />} />
        <Route path="/planning/reports" element={<ReportsPage />} />
        <Route path="/planning/avd" element={<AvdPage />} />
        <Route path="/planning/sofs" element={<SofsPage />} />
        <Route path="/planning/aks" element={<AksPage />} />
        <Route path="/planning/mabs" element={<MabsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/docs" element={<Navigate to="/help" replace />} />
        <Route path="/thin-provisioning" element={<ThinProvisioningPage />} />
        <Route path="/references" element={<ReferencesPage />} />
        <Route path="/about" element={<AboutPage />} />
        {legacy.map(path => <Route key={path} path={'/' + path} element={<Navigate to={'/planning/' + path} replace />} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  </PlanStoreContext.Provider>
}
