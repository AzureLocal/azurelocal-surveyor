import { useState } from 'react'
import { useSurveyorStore } from '../state/usePlanStore'
import { createProject, downloadProject } from '../state/project'
import { storageReportData, exportStoragePdf, exportStorageXlsx, downloadStorageMarkdown } from '../exporters/storage'
import { generatePowerShell } from '../exporters/powershell'
import CapacityReport from '../components/CapacityReport'
import HealthCheck from '../components/HealthCheck'
import PlanTransfer from '../components/PlanTransfer'

export default function StorageReportPage() {
  const state = useSurveyorStore()
  const report = storageReportData(state)
  const [notice, setNotice] = useState('')
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Storage Report &amp; Exports</h1><p className="text-sm text-gray-500 mt-2">{state.planName} · Hardware, capacity, volumes and storage checks.</p></div>
    <div className="flex flex-wrap gap-2 no-print">
      <button className="action" onClick={() => exportStoragePdf(state)}>Export PDF</button>
      <button className="action-secondary" onClick={() => exportStorageXlsx(state)}>Export XLSX</button>
      <button className="action-secondary" onClick={() => downloadStorageMarkdown(state)}>Export Markdown</button>
      <button className="action-secondary" onClick={() => downloadProject(createProject(state, state.planName, 'storage'))}>Export project JSON</button>
      <button className="action-secondary" onClick={async () => { try { await navigator.clipboard.writeText(generatePowerShell(state)); setNotice('PowerShell copied.') } catch { setNotice('Clipboard unavailable. Select the script below to copy it.') } }}>Copy PowerShell</button>
    </div>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <HealthCheck result={report.validation} title="Hardware Health Check" /><HealthCheck result={report.health} />
    <CapacityReport result={report.capacity} plannedFootprintTB={report.volumes.totalPoolFootprintTB} />
    <div className="panel overflow-x-auto"><h2 className="font-semibold mb-3">Planned volumes</h2><table className="w-full text-sm"><thead><tr>{report.tables[2].head.map(h => <th className="text-left p-2" key={h}>{h}</th>)}</tr></thead><tbody>{report.tables[2].rows.map((row, i) => <tr className="border-t" key={i}>{row.map((value, j) => <td className="p-2" key={j}>{value}</td>)}</tr>)}</tbody></table>{!state.volumes.length && <p className="text-sm text-gray-500">No volumes have been added. Capacity calculations are still available.</p>}</div>
    <details><summary className="cursor-pointer font-medium">Volume creation script</summary><pre className="panel overflow-x-auto text-xs mt-3">{generatePowerShell(state)}</pre></details>
    <PlanTransfer />
  </div>
}
