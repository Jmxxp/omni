param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path $RootDir "Layout Jarvis\agent-starter-react-main"
$AgentDir = Join-Path $RootDir "Aula automacao\Controle_PC"
$EnvFile = Join-Path $WebDir ".env.local"
$VenvDir = Join-Path $AgentDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$LogsDir = Join-Path $RootDir "logs"
$InstallMarker = Join-Path $VenvDir ".jarvis-ready"
$NextDir = Join-Path $WebDir ".next"

$RequiredEnv = @(
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "GOOGLE_API_KEY"
)

function Write-Jarvis {
  param([string]$Message, [string]$Color = "Cyan")
  Write-Host "[Jarvis] $Message" -ForegroundColor $Color
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Comando falhou: $FilePath $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Resolve-Python {
  $candidates = @(
    @{ File = "python"; Args = @() },
    @{ File = "py"; Args = @("-3.11") },
    @{ File = "py"; Args = @("-3") }
  )

  foreach ($candidate in $candidates) {
    try {
      $args = @($candidate.Args) + @("-c", "import sys; assert sys.version_info >= (3, 10); print(sys.executable)")
      $output = & $candidate.File @args 2>$null
      if ($LASTEXITCODE -eq 0 -and $output) {
        return $candidate
      }
    } catch {
      continue
    }
  }

  throw "Python 3.10+ nao encontrado. Instale Python e rode novamente."
}

function Get-PackageManager {
  $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if ($pnpm) {
    return @{ File = $pnpm.Source; Args = @("install"); DevArgs = @("dev") }
  }

  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npm) {
    return @{ File = $npm.Source; Args = @("install"); DevArgs = @("run", "dev") }
  }

  throw "Node/npm nao encontrado. Instale Node.js e rode novamente."
}

function Read-JarvisEnv {
  $envMap = @{}
  if (!(Test-Path -LiteralPath $EnvFile)) {
    return $envMap
  }

  foreach ($rawLine in Get-Content -LiteralPath $EnvFile) {
    $line = $rawLine.Trim()
    if (!$line -or $line.StartsWith("#")) {
      continue
    }
    if ($line.StartsWith("export ")) {
      $line = $line.Substring(7).Trim()
    }

    $equals = $line.IndexOf("=")
    if ($equals -lt 1) {
      continue
    }

    $key = $line.Substring(0, $equals).Trim()
    $value = $line.Substring($equals + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $envMap[$key] = $value
  }

  return $envMap
}

function Get-EnvHash {
  param([hashtable]$EnvMap)

  $body = ($EnvMap.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "`n"
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "")
}

function Stop-ProcessSafe {
  param($Process, [string]$Name)

  if ($Process -and !$Process.HasExited) {
    Write-Jarvis "Parando $Name..." "DarkYellow"
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
}

function Stop-ProjectProcesses {
  param([string]$Kind)

  $escapedWebDir = [regex]::Escape($WebDir)
  $escapedAgentDir = [regex]::Escape($AgentDir)
  $processes = Get-CimInstance Win32_Process | Where-Object {
    if ($Kind -eq "node") {
      ($_.Name -match "node|npm|cmd") -and ($_.CommandLine -match $escapedWebDir)
    } else {
      ($_.Name -match "python") -and (
        ($_.CommandLine -match $escapedAgentDir) -or
        ($_.CommandLine -match "agent\.py dev")
      )
    }
  }

  foreach ($process in $processes) {
    Write-Jarvis "Encerrando processo antigo: $($process.Name) #$($process.ProcessId)" "DarkYellow"
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Stop-OtherLaunchers {
  $launchers = Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -match "powershell") -and
    ($_.ProcessId -ne $PID) -and
    ($_.CommandLine -match [regex]::Escape("start-jarvis.ps1"))
  }

  foreach ($launcher in $launchers) {
    Write-Jarvis "Encerrando launcher antigo #$($launcher.ProcessId)" "DarkYellow"
    Stop-Process -Id $launcher.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Clear-NextCache {
  $resolvedWeb = (Resolve-Path -LiteralPath $WebDir).Path
  if (Test-Path -LiteralPath $NextDir) {
    $resolvedNext = (Resolve-Path -LiteralPath $NextDir).Path
    if (!$resolvedNext.StartsWith($resolvedWeb, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Caminho .next inesperado: $resolvedNext"
    }
    Write-Jarvis "Limpando cache do Next (.next)..." "DarkYellow"
    Remove-Item -Recurse -Force -LiteralPath $resolvedNext
  }
}

function Test-FrontendReady {
  try {
    $settings = Invoke-WebRequest -Uri "http://localhost:3000/api/settings" -UseBasicParsing -TimeoutSec 4
    if ($settings.StatusCode -ne 200) {
      return $false
    }

    $home = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 10
    if ($home.StatusCode -ne 200) {
      return $false
    }

    return $home.Content.Contains("Jarvis") -and !$home.Content.Contains("Cannot find module")
  } catch {
    return $false
  }
}

function Start-Agent {
  param([hashtable]$EnvMap, [string]$Stamp)

  foreach ($entry in $EnvMap.GetEnumerator()) {
    Set-Item -Path "Env:$($entry.Name)" -Value $entry.Value
  }
  $env:PYTHONUNBUFFERED = "1"
  $env:PYTHONIOENCODING = "utf-8"

  $agentOut = Join-Path $LogsDir "agent-$Stamp.out.log"
  $agentErr = Join-Path $LogsDir "agent-$Stamp.err.log"
  Remove-Item -Force -LiteralPath $agentOut, $agentErr -ErrorAction SilentlyContinue

  Write-Jarvis "Iniciando agente Python..."
  return Start-Process `
    -FilePath $VenvPython `
    -ArgumentList @("agent.py", "dev") `
    -WorkingDirectory $AgentDir `
    -PassThru `
    -RedirectStandardOutput $agentOut `
    -RedirectStandardError $agentErr
}

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

Write-Jarvis "Projeto: $RootDir"
Stop-OtherLaunchers
Stop-ProjectProcesses -Kind "python"

$packageManager = Get-PackageManager
if (!(Test-Path -LiteralPath (Join-Path $WebDir "node_modules"))) {
  Write-Jarvis "Instalando dependencias do frontend..."
  Invoke-Checked -FilePath $packageManager.File -Arguments $packageManager.Args -WorkingDirectory $WebDir
} else {
  Write-Jarvis "Dependencias do frontend ja existem."
}

if (!$SkipInstall -and !(Test-Path -LiteralPath $InstallMarker)) {
  $python = Resolve-Python

  if (!(Test-Path -LiteralPath $VenvPython)) {
    Write-Jarvis "Criando ambiente Python..."
    Invoke-Checked -FilePath $python.File -Arguments (@($python.Args) + @("-m", "venv", $VenvDir)) -WorkingDirectory $AgentDir
  }

  Write-Jarvis "Instalando dependencias Python..."
  Invoke-Checked -FilePath $VenvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools") -WorkingDirectory $AgentDir
  Invoke-Checked -FilePath $VenvPython -Arguments @("-m", "pip", "install", "-r", (Join-Path $AgentDir "requirements.txt")) -WorkingDirectory $AgentDir
  Invoke-Checked -FilePath $VenvPython -Arguments @("-m", "playwright", "install", "chromium") -WorkingDirectory $AgentDir
  Set-Content -LiteralPath $InstallMarker -Value (Get-Date).ToString("s")
} elseif ($SkipInstall) {
  Write-Jarvis "Instalacao pulada por parametro."
} else {
  Write-Jarvis "Dependencias Python ja marcadas como prontas."
}

$webProcess = $null
$webErr = ""

if (Test-FrontendReady) {
  Write-Jarvis "Frontend ja esta aberto em http://localhost:3000."
} else {
  Stop-ProjectProcesses -Kind "node"
  Clear-NextCache

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $webOut = Join-Path $LogsDir "frontend-$stamp.out.log"
  $webErr = Join-Path $LogsDir "frontend-$stamp.err.log"
  Remove-Item -Force -LiteralPath $webOut, $webErr -ErrorAction SilentlyContinue

  $env:NEXT_TELEMETRY_DISABLED = "1"
  Write-Jarvis "Iniciando frontend em http://localhost:3000 ..."
  $webProcess = Start-Process `
    -FilePath $packageManager.File `
    -ArgumentList $packageManager.DevArgs `
    -WorkingDirectory $WebDir `
    -PassThru `
    -RedirectStandardOutput $webOut `
    -RedirectStandardError $webErr

  Start-Sleep -Seconds 4
}

Start-Process "http://localhost:3000" | Out-Null

$agentProcess = $null
$lastHash = ""
$lastMissing = ""

try {
  Write-Jarvis "Salve as APIs no navegador. O agente inicia sozinho quando estiver tudo pronto." "Green"
  Write-Jarvis "Logs: $LogsDir" "DarkGray"

  while ($true) {
    if ($webProcess -and $webProcess.HasExited) {
      throw "Frontend encerrou. Veja os logs em $webErr"
    }

    $envMap = Read-JarvisEnv
    $missing = @($RequiredEnv | Where-Object { !$envMap.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($envMap[$_]) })

    if ($missing.Count -gt 0) {
      $missingText = $missing -join ", "
      if ($missingText -ne $lastMissing) {
        Write-Jarvis "Aguardando configuracao: $missingText" "Yellow"
        $lastMissing = $missingText
      }
      Stop-ProcessSafe -Process $agentProcess -Name "agente Python"
      $agentProcess = $null
      $lastHash = ""
    } else {
      $hash = Get-EnvHash -EnvMap $envMap
      $agentStopped = !$agentProcess -or $agentProcess.HasExited

      if ($agentStopped -or $hash -ne $lastHash) {
        Stop-ProcessSafe -Process $agentProcess -Name "agente Python"
        $agentProcess = Start-Agent -EnvMap $envMap -Stamp (Get-Date -Format "yyyyMMdd-HHmmss")
        $lastHash = $hash
        $lastMissing = ""
      }
    }

    Start-Sleep -Seconds 3
  }
} finally {
  Stop-ProcessSafe -Process $agentProcess -Name "agente Python"
  Stop-ProcessSafe -Process $webProcess -Name "frontend"
}
