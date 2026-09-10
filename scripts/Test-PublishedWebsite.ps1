#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][uri]$BaseUrl,
    [Parameter(Mandatory)][string]$ExpectedCommit
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$verified = $false
for ($attempt = 1; $attempt -le 20; $attempt++) {
    try {
        $revisionUrl = [uri]::new($BaseUrl, "build-info.json?revision=$ExpectedCommit&attempt=$attempt")
        $revision = Invoke-RestMethod -Uri $revisionUrl -TimeoutSec 20 -Headers @{ 'Cache-Control' = 'no-cache' }
        if ($revision.commit -eq $ExpectedCommit) { $verified = $true; break }
        Write-Host "Waiting for published commit $ExpectedCommit (attempt $attempt)."
    } catch {
        Write-Host "Waiting for the published revision (attempt $attempt): $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 15
}
if (-not $verified) { throw "The website did not publish commit $ExpectedCommit." }

$page = Invoke-WebRequest -Uri ([uri]::new($BaseUrl, "?revision=$ExpectedCommit")) -TimeoutSec 30
if ($page.Content -notmatch '<title>Azure Local Surveyor</title>') { throw 'Published page is not the Surveyor website.' }
$assets = [regex]::Matches($page.Content, '(?:src|href)="([^"]+\.(?:js|css))"')
if ($assets.Count -lt 2) { throw 'Published website is missing its JavaScript or stylesheet reference.' }
foreach ($asset in $assets) {
    $assetUrl = [uri]::new($BaseUrl, $asset.Groups[1].Value)
    $response = Invoke-WebRequest -Uri $assetUrl -TimeoutSec 30
    if ($response.StatusCode -ne 200) { throw "Asset unavailable: $assetUrl" }
    Write-Host "Verified asset: $assetUrl"
}
Write-Host "Verified published commit $ExpectedCommit at $BaseUrl"
