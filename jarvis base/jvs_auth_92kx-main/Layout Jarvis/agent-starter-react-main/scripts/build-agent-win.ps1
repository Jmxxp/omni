$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RepoRoot = Resolve-Path (Join-Path $ProjectRoot "..\..")
$AgentDir = Join-Path $RepoRoot "Aula automacao\Controle_PC"
$OutputDir = Join-Path $ProjectRoot "resources\agent"
$WorkDir = Join-Path $ProjectRoot "build\pyinstaller"

if (!(Test-Path (Join-Path $AgentDir "agent.py"))) {
  throw "agent.py nao encontrado em $AgentDir"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

Push-Location $AgentDir
try {
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt pyinstaller

  python -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --name jarvis-agent `
    --distpath $OutputDir `
    --workpath $WorkDir `
    --specpath $WorkDir `
    --collect-all livekit `
    --collect-all mem0 `
    --collect-all google `
    --collect-all playwright `
    agent.py
}
finally {
  Pop-Location
}

$ConfigSource = Join-Path $AgentDir "config"
$ConfigTarget = Join-Path $OutputDir "config"
if (Test-Path $ConfigSource) {
  Copy-Item $ConfigSource $ConfigTarget -Recurse -Force
}

Write-Host "Agente Windows gerado em $OutputDir\jarvis-agent.exe"
