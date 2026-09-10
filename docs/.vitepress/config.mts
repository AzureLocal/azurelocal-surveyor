import { defineConfig } from 'vitepress'

export default defineConfig({
  ignoreDeadLinks: true,
  base: '/azurelocal-surveyor/docs/',
  title: "Azure Local Surveyor",
  description: "Governed centrally by HCS Platform Engineering standards",
  themeConfig: {
    nav: [{"link":"/","text":"Home"},{"items":[{"link":"/engine/capacity","text":"Capacity Model"},{"link":"/engine/volumes","text":"Volumes"},{"link":"/engine/workloads","text":"Workloads"},{"link":"/engine/avd","text":"AVD"},{"link":"/engine/sofs","text":"SOFS"},{"link":"/engine/compute","text":"Compute"},{"link":"/engine/healthcheck","text":"Health Check"}],"text":"Engine"},{"link":"/changelog","text":"Changelog"},{"items":[{"link":"/reference/formula-map","text":"Formula Map"},{"link":"/reference/parity-tests","text":"Parity Tests"},{"link":"/reference/plan-manifest","text":"Plan Manifest"},{"link":"/reference/browser-smoke-checklist","text":"Browser Smoke Checklist"}],"text":"Reference"}],
    sidebar: [{"link":"/","text":"Home"},{"text":"Engine","items":[{"link":"/engine/capacity","text":"Capacity Model"},{"link":"/engine/volumes","text":"Volumes"},{"link":"/engine/workloads","text":"Workloads"},{"link":"/engine/avd","text":"AVD"},{"link":"/engine/sofs","text":"SOFS"},{"link":"/engine/compute","text":"Compute"},{"link":"/engine/healthcheck","text":"Health Check"}],"collapsed":false},{"link":"/changelog","text":"Changelog"},{"text":"Reference","items":[{"link":"/reference/formula-map","text":"Formula Map"},{"link":"/reference/parity-tests","text":"Parity Tests"},{"link":"/reference/plan-manifest","text":"Plan Manifest"},{"link":"/reference/browser-smoke-checklist","text":"Browser Smoke Checklist"}],"collapsed":false}],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/AzureLocal/azurelocal-surveyor' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Hybrid Cloud Solutions & AzureLocal'
    }
  }
})




