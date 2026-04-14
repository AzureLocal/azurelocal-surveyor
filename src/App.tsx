import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import HardwarePage from './pages/HardwarePage'
import WorkloadsPage from './pages/WorkloadsPage'
import AvdPage from './pages/AvdPage'
import SofsPage from './pages/SofsPage'
import VolumesPage from './pages/VolumesPage'
import ReportsPage from './pages/ReportsPage'
import ThinProvisioningPage from './pages/ThinProvisioningPage'
import ReferencesPage from './pages/ReferencesPage'
import DocsPage from './pages/DocsPage'
import AksPage from './pages/AksPage'
import DriveLayoutPage from './pages/DriveLayoutPage'
import MabsPage from './pages/MabsPage'
import AboutPage from './pages/AboutPage'
import Layout from './components/Layout'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/hardware" element={<HardwarePage />} />
        <Route path="/workloads" element={<WorkloadsPage />} />
        <Route path="/avd" element={<AvdPage />} />
        <Route path="/sofs" element={<SofsPage />} />
        <Route path="/aks" element={<AksPage />} />
        <Route path="/volumes" element={<VolumesPage />} />
        <Route path="/drive-layout" element={<DriveLayoutPage />} />
        <Route path="/mabs" element={<MabsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/thin-provisioning" element={<ThinProvisioningPage />} />
        <Route path="/references" element={<ReferencesPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Layout>
  )
}
