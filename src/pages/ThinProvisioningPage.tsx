/**
 * ThinProvisioningPage — reference guide for thin provisioning on Azure Local S2D.
 * Covers risks, PowerShell monitoring commands, and deployment checklist.
 * Ports the Thin Provisioning advisory content from the Excel workbook (#53).
 */

const RISKS = [
  {
    title: 'Silent VM crash on pool exhaustion',
    detail: 'When the storage pool runs out of physical space, thin-provisioned volumes cannot honor write requests. VMs crash immediately with no graceful shutdown — data loss is likely.',
  },
  {
    title: 'No built-in over-commit alerts',
    detail: 'S2D does not automatically warn when logical volume sizes exceed physical pool capacity. You must implement external monitoring to catch this condition before VMs crash.',
  },
  {
    title: 'Performance degradation near full',
    detail: 'As the pool fills, S2D must find increasingly scattered free slabs, increasing write latency. Performance can degrade significantly above 80% physical pool usage.',
  },
  {
    title: 'Rebuild capacity risk',
    detail: 'S2D requires free slab space to auto-repair after a drive or node failure. Thin over-commit reduces or eliminates this headroom, making auto-repair impossible.',
  },
]

const CHECKLIST = [
  'Enable Storage QoS policies to throttle aggressive workloads before pool exhaustion',
  'Configure Health Service alerts for pool utilization (target: alert at 60%, critical at 70%)',
  'Set Windows Event Log monitoring for S2D event IDs 1001, 1004, 5121 (pool health)',
  'Deploy Azure Monitor alerts on "Storage Pool Allocated Size" counter',
  'Schedule weekly pool utilization reports (Get-StoragePool | Select FriendlyName,AllocatedSize,Size)',
  'Document maximum logical-to-physical ratio for your workload profile (recommended: ≤ 1.5:1)',
  'Test failover behavior with a full pool in a lab before deploying to production',
  'Create runbook for emergency volume shrink or deletion procedures',
  'Review thin-provisioned volume sizes quarterly and reclaim unused space',
]

const PS_COMMANDS = [
  {
    label: 'Pool utilization',
    code: `Get-StoragePool -FriendlyName "S2D on *" | Select-Object FriendlyName,
  @{N='AllocatedGB';E={[math]::Round($_.AllocatedSize/1GB,2)}},
  @{N='TotalGB';E={[math]::Round($_.Size/1GB,2)}},
  @{N='UsedPct';E={[math]::Round($_.AllocatedSize/$_.Size*100,1)}}`,
  },
  {
    label: 'Per-volume footprint vs. logical size',
    code: `Get-VirtualDisk | Select-Object FriendlyName,
  @{N='LogicalGB';E={[math]::Round($_.Size/1GB,2)}},
  @{N='FootprintGB';E={[math]::Round($_.FootprintOnPool/1GB,2)}},
  ProvisioningType`,
  },
  {
    label: 'Health Service alerts',
    code: `Get-StorageHealthReport | Where-Object { $_.Reason -match "Pool" }`,
  },
  {
    label: 'Reclaim unused thin space',
    code: `# Optimize a specific volume to return unused blocks to pool
Optimize-Volume -DriveLetter D -ReTrim -Verbose`,
  },
]

export default function ThinProvisioningPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Thin Provisioning Reference</h1>
        <p className="text-sm text-gray-500 mt-1">
          Thin provisioning allows volumes to report more logical capacity than is physically reserved.
          This page covers risks, monitoring commands, and deployment checklist for safe thin-provisioned deployments.
        </p>
      </div>

      {/* Warning banner */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-4">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Not recommended for production workloads</p>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Microsoft does not recommend thin provisioning for production Azure Local deployments.
          Thick provisioning (the default) is safer because each volume reserves its full pool footprint,
          preventing over-commit scenarios.
        </p>
      </div>

      {/* Risks */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Risks</h2>
        <div className="space-y-3">
          {RISKS.map((r) => (
            <div key={r.title} className="rounded-lg border border-red-200 dark:border-red-800 p-4">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">{r.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PowerShell Monitoring */}
      <section>
        <h2 className="text-xl font-semibold mb-4">PowerShell Monitoring</h2>
        <p className="text-sm text-gray-500 mb-4">
          Run these commands regularly on your Azure Local management host or via a scheduled task.
        </p>
        <div className="space-y-4">
          {PS_COMMANDS.map((cmd) => (
            <div key={cmd.label} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">{cmd.label}</div>
              <pre className="px-4 py-3 text-xs font-mono bg-gray-900 text-gray-100 overflow-x-auto whitespace-pre-wrap">{cmd.code}</pre>
            </div>
          ))}
        </div>
      </section>

      {/* Deployment Checklist */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Deployment Checklist</h2>
        <p className="text-sm text-gray-500 mb-4">
          Complete all items before enabling thin provisioning in any environment.
        </p>
        <ul className="space-y-2">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-400">{i + 1}</span>
              <span className="text-gray-700 dark:text-gray-300">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Thick vs Thin comparison */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Thick vs Thin — Quick Reference</h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-2 text-gray-500 font-medium">Attribute</th>
                <th className="px-4 py-2 text-green-700 dark:text-green-400 font-medium">Thick (default)</th>
                <th className="px-4 py-2 text-amber-700 dark:text-amber-400 font-medium">Thin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[
                ['Pool reservation', 'Full footprint at creation', 'Grows as data is written'],
                ['Over-commit risk', 'None — pool space guaranteed', 'High — logical > physical possible'],
                ['VM crash risk on full pool', 'None', 'Immediate crash, no warning'],
                ['Performance at high utilization', 'Consistent', 'Degrades as pool fills'],
                ['Rebuild headroom', 'Guaranteed', 'Reduced or eliminated'],
                ['Production recommended', 'Yes', 'No'],
              ].map(([attr, thick, thin]) => (
                <tr key={attr}>
                  <td className="px-4 py-2 text-gray-500">{attr}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{thick}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{thin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
