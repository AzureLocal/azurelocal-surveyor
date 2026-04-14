/**
 * ReferencesPage — hyperlinked Microsoft Learn catalog for Azure Local S2D.
 * Mirrors the References section from the Excel workbook (#55).
 * 17 categorized URLs covering capacity, compute, volumes, networking, and tools.
 */

interface RefLink {
  title: string
  url: string
  description: string
}

interface RefCategory {
  category: string
  links: RefLink[]
}

const COMMUNITY_GUIDES: RefCategory = {
  category: 'Community Guides (azurelocal.cloud)',
  links: [
    {
      title: 'AVD on Azure Local',
      url: 'https://azurelocal.cloud/azurelocal-avd/',
      description: 'End-to-end guide for deploying Azure Virtual Desktop on Azure Local with FSLogix profile sizing.',
    },
    {
      title: 'SOFS + FSLogix on Azure Local',
      url: 'https://azurelocal.cloud/azurelocal-sofs-fslogix/',
      description: 'Scale-Out File Server guest cluster deployment for FSLogix profile share HA.',
    },
    {
      title: 'Azure Local Surveyor',
      url: 'https://azurelocal.cloud/azurelocal-surveyor/',
      description: 'Documentation for this capacity planning tool — feature overview, usage, and methodology.',
    },
  ],
}

const REFERENCES: RefCategory[] = [
  {
    category: 'Capacity & Storage',
    links: [
      {
        title: 'Plan volumes in Azure Local',
        url: 'https://learn.microsoft.com/azure/azure-local/concepts/plan-volumes',
        description: 'Volume sizing, resiliency types, and capacity planning guidance for Storage Spaces Direct.',
      },
      {
        title: 'Storage Spaces Direct overview',
        url: 'https://learn.microsoft.com/windows-server/storage/storage-spaces/storage-spaces-direct-overview',
        description: 'Architecture overview, drive types, fault domains, and pool design for S2D.',
      },
      {
        title: 'Understanding the storage pool cache',
        url: 'https://learn.microsoft.com/windows-server/storage/storage-spaces/understand-the-cache',
        description: 'How NVMe and SSD cache drives work with capacity drives in S2D.',
      },
      {
        title: 'Drive symmetry considerations',
        url: 'https://learn.microsoft.com/windows-server/storage/storage-spaces/drive-symmetry-considerations',
        description: 'Why all nodes should have identical drive configurations for balanced performance.',
      },
    ],
  },
  {
    category: 'Compute & Memory',
    links: [
      {
        title: 'Azure Local system requirements',
        url: 'https://learn.microsoft.com/azure/azure-local/concepts/system-requirements-small-medium-large',
        description: 'Node count, CPU, memory, and network requirements for Azure Local deployments.',
      },
      {
        title: 'Plan compute capacity',
        url: 'https://learn.microsoft.com/azure/azure-local/concepts/plan-capacity',
        description: 'vCPU overcommit ratios, memory reservation, and compute sizing for VM workloads.',
      },
      {
        title: 'Hyper-V on Azure Local',
        url: 'https://learn.microsoft.com/azure/azure-local/manage/vm',
        description: 'Virtual machine management, live migration, and failover clustering integration.',
      },
    ],
  },
  {
    category: 'Azure Virtual Desktop (AVD)',
    links: [
      {
        title: 'Deploy Azure Virtual Desktop on Azure Local',
        url: 'https://learn.microsoft.com/azure/virtual-desktop/azure-local-overview',
        description: 'Architecture and sizing guidance for AVD session hosts on Azure Local.',
      },
      {
        title: 'Publish applications with RemoteApp',
        url: 'https://learn.microsoft.com/azure/virtual-desktop/publish-applications-stream-remoteapp',
        description: 'How RemoteApp application groups, published apps, and host-pool assignments work in Azure Virtual Desktop.',
      },
      {
        title: 'Preferred application group type',
        url: 'https://learn.microsoft.com/azure/virtual-desktop/preferred-application-group-type',
        description: 'Explains Desktop vs RemoteApp behavior when both application group types are assigned to the same pooled host pool.',
      },
      {
        title: 'FSLogix profile container configuration',
        url: 'https://learn.microsoft.com/fslogix/concepts-container-types',
        description: 'Profile Container vs Office Container types, sizing, and storage location guidance.',
      },
      {
        title: 'Virtual desktop sizing guidance',
        url: 'https://learn.microsoft.com/windows-server/remote/remote-desktop-services/virtual-machine-recs',
        description: 'Per-user vCPU and memory recommendations for different workload types.',
      },
    ],
  },
  {
    category: 'Scale-Out File Server (SOFS)',
    links: [
      {
        title: 'Scale-Out File Server overview',
        url: 'https://learn.microsoft.com/windows-server/failover-clustering/sofs-overview',
        description: 'SOFS architecture, use cases, and deployment guidance for shared storage.',
      },
      {
        title: 'FSLogix with Scale-Out File Server',
        url: 'https://learn.microsoft.com/azure/virtual-desktop/azure-local-overview#fslogix-profile-containers-storage',
        description: 'Microsoft guidance for hosting FSLogix profile containers on SMB storage for Azure Virtual Desktop on Azure Local.',
      },
    ],
  },
  {
    category: 'Networking',
    links: [
      {
        title: 'Network requirements for Azure Local',
        url: 'https://learn.microsoft.com/azure/azure-local/concepts/plan-networking',
        description: 'Host networking, SDN, and storage network (RDMA) design for Azure Local.',
      },
      {
        title: 'RDMA and SMB Direct',
        url: 'https://learn.microsoft.com/windows-server/storage/file-server/smb-direct',
        description: 'High-performance storage networking with RDMA for low latency S2D I/O.',
      },
    ],
  },
  {
    category: 'Tools & Monitoring',
    links: [
      {
        title: 'Windows Admin Center',
        url: 'https://learn.microsoft.com/windows-server/manage/windows-admin-center/overview',
        description: 'Browser-based management for Azure Local — volumes, drives, VMs, and health monitoring.',
      },
      {
        title: 'Azure Local Health Service',
        url: 'https://learn.microsoft.com/azure/azure-local/manage/health-service-overview',
        description: 'Automated health monitoring, fault detection, and actionable reports for S2D clusters.',
      },
      {
        title: 'PowerShell reference for S2D',
        url: 'https://learn.microsoft.com/powershell/module/storage/',
        description: 'Full PowerShell Storage module reference including Get-StoragePool, Get-VirtualDisk, and more.',
      },
    ],
  },
]

export default function ReferencesPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">References</h1>
        <p className="text-sm text-gray-500 mt-1">
          Microsoft Learn documentation catalog for Azure Local, Storage Spaces Direct, AVD, and SOFS.
          All links open in a new tab.
        </p>
      </div>

      {[COMMUNITY_GUIDES, ...REFERENCES].map((section) => (
        <section key={section.category}>
          <h2 className="text-xl font-semibold mb-4">{section.category}</h2>
          <div className="space-y-3">
            {section.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-brand-700 dark:text-brand-300 group-hover:underline">{link.title}</span>
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400 group-hover:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mt-1">{link.description}</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 font-mono">{link.url}</p>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
