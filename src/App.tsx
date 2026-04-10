import { Routes, Route } from 'react-router-dom'
import HardwarePage from './pages/HardwarePage'
import WorkloadsPage from './pages/WorkloadsPage'
import AvdPage from './pages/AvdPage'
import SofsPage from './pages/SofsPage'
import VolumesPage from './pages/VolumesPage'
import ReportsPage from './pages/ReportsPage'
import Layout from './components/Layout'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HardwarePage />} />
        <Route path="/workloads" element={<WorkloadsPage />} />
        <Route path="/avd" element={<AvdPage />} />
        <Route path="/sofs" element={<SofsPage />} />
        <Route path="/volumes" element={<VolumesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Layout>
  )
}
