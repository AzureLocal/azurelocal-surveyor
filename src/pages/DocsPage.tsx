/**
 * DocsPage — in-app documentation and how-to-use guide.
 * Covers tool purpose, workflow, and each planning area (#3).
 */

interface DocSection {
  title: string
  content: string[]
}

const DOCS: DocSection[] = [
  {
    title: 'What is Azure Local Surveyor?',
    content: [
      'Azure Local Surveyor is a browser-based capacity planning tool for Azure Local (formerly Azure Stack HCI) clusters using Storage Spaces Direct (S2D).',
      'It ports the formulas from the S2D Capacity Calculator Excel workbook into an interactive web application, making it easier to plan cluster hardware, workloads, volumes, and deployments without manually editing spreadsheets.',
      'All calculations run locally in your browser — no data is sent to any server.',
    ],
  },
  {
    title: 'Recommended Workflow',
    content: [
      '1. Hardware — Start by entering your node count, drive configuration (capacity drives per node, drive size, drive media), CPU cores, and memory. This establishes the raw foundation for all downstream calculations.',
      '2. Advanced Settings — Review and adjust formula parameters (efficiency factor, overcommit ratios, system reservations). Defaults match Microsoft recommendations.',
      '3. Workloads — Enable the scenarios you plan to deploy (AVD, AKS, Infrastructure VMs, Dev/Test VMs, Backup/Archive, Custom VMs, SOFS). Each scenario contributes to compute and storage demand.',
      '4. AVD / SOFS pages — If you enabled those workloads, configure the detailed parameters for Azure Virtual Desktop or Scale-Out File Server.',
      '5. Volumes — Plan your Cluster Shared Volumes (CSVs). Set volume names, sizes, and resiliency types. Use the WAC GB column values when creating volumes in Windows Admin Center.',
      '6. Reports — Review the final capacity report, compute report, health checks, and best practice notes. Export to PDF, Excel, PowerShell, or Markdown.',
    ],
  },
  {
    title: 'Capacity Concepts',
    content: [
      'Raw pool: the total TB across all capacity drives (drive size × drives per node × nodes). This is what the manufacturer advertises.',
      'Usable: each drive loses ~8% to filesystem overhead and wear-leveling. Usable = raw × 0.92 per drive.',
      'Reserve: S2D holds back min(nodeCount, 4) drives for automatic repair after a drive failure. These are not available for volumes.',
      'Available: usable pool minus reserve minus the system infrastructure volume (~250 GB).',
      'Effective usable: available pool × resiliency efficiency. This is your planning number — how much data fits with your chosen resiliency type.',
    ],
  },
  {
    title: 'TB vs TiB — Why WAC Shows Different Numbers',
    content: [
      'This tool uses decimal TB (1 TB = 1,000,000,000,000 bytes), which is how drive manufacturers advertise capacity.',
      'Windows Admin Center (WAC) and PowerShell display binary TiB (1 TiB = 1,099,511,627,776 bytes).',
      '1 TB ≈ 0.9095 TiB. A volume planned as 5 TB will show as ~4.55 TiB in WAC.',
      'The WAC GB column in the Volume Detail page converts your planned TB to the GB value you should enter in Windows Admin Center or pass to New-Volume -Size. Always use these WAC values — entering the raw TB value will cause WAC errors.',
    ],
  },
  {
    title: 'Health Checks',
    content: [
      'The health check engine validates your configuration against S2D requirements and best practices. There are three severity levels:',
      'Error (red): configuration will fail or cause data loss. Errors must be fixed before deployment.',
      'Warning (amber): configuration works but is outside best practice thresholds (e.g., utilization > 70%, thin provisioning in use).',
      'Info (blue): advisory suggestions for optimal configuration (e.g., volume count not a multiple of node count).',
    ],
  },
  {
    title: 'N+1 Failover Planning',
    content: [
      'S2D clusters are designed to tolerate node failures. In an N-node cluster, all workloads should continue running with N-1 nodes active (one node failed or in maintenance).',
      'The Compute Report includes an N+1 Failover Analysis section showing whether your planned workloads fit on N-1 nodes.',
      'The vCPU overcommit sensitivity table also includes an N+1 Fit column showing available vCPUs with one node down.',
      'Best Practice: plan your cluster so all workloads fit with one node down. This is mandatory for production deployments.',
    ],
  },
  {
    title: 'Volume Best Practices',
    content: [
      'Volume count: use a multiple of your node count (e.g., 4 volumes on a 4-node cluster) for balanced slab distribution across nodes.',
      '64 TB limit: S2D volumes cannot exceed 64 TB. If you need more than 64 TB of logical storage, create multiple volumes.',
      'Thick vs thin: use thick (fixed) provisioning in production. Thin provisioning risks VMs crashing silently when the pool fills.',
      'Utilization: keep pool utilization below 70% to ensure S2D has headroom to auto-repair after a drive failure.',
      'Resiliency: use Three-Way Mirror for all production VM volumes. Dual Parity is appropriate for bulk/archive storage with infrequent writes.',
    ],
  },
  {
    title: 'Exports',
    content: [
      'PDF: full planning report suitable for review meetings and customer deliverables.',
      'Excel (XLSX): structured export matching the input/output layout for further analysis.',
      'PowerShell: ready-to-run commands for creating volumes, pools, and validating the configuration.',
      'Markdown: copy-paste ready summary for wikis, runbooks, and GitHub issues.',
    ],
  },
]

export default function DocsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-sm text-gray-500 mt-1">
          How to use Azure Local Surveyor — workflow, concepts, and best practices.
        </p>
      </div>

      {DOCS.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
          <div className="space-y-2">
            {section.content.map((para, i) => (
              <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{para}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
