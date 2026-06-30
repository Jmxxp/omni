$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $ProjectRoot
try {
  npm install
  npm run agent:build:win
  npm run desktop:dist:win
}
finally {
  Pop-Location
}

Write-Host "Instalador Windows gerado em dist-desktop"
