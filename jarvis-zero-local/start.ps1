$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$VenvDir = Join-Path $RootDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$LogsDir = Join-Path $RootDir "logs"
$ServerOut = Join-Path $LogsDir "server.out.log"
$ServerErr = Join-Path $LogsDir "server.err.log"
$ReadyMarker = Join-Path $VenvDir ".ready"
$Url = "http://127.0.0.1:8765"
$SettingsJson = Join-Path $RootDir "data\settings.json"
$OldEnvFile = Join-Path (Split-Path -Parent $RootDir) "jvs_auth_92kx-main\Layout Jarvis\agent-starter-react-main\.env.local"

function Write-Jarvis {
  param([string]$Message, [string]$Color = "Cyan")
  Write-Host "[Jarvis Zero] $Message" -ForegroundColor $Color
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

  throw "Python 3.10+ nao encontrado. Instale Python e tente novamente."
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

function Stop-OldServers {
  $escapedRoot = [regex]::Escape($RootDir)
  Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -match "python") -and ($_.CommandLine -match $escapedRoot)
  } | ForEach-Object {
    Write-Jarvis "Encerrando servidor antigo #$($_.ProcessId)" "DarkYellow"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Test-Ready {
  try {
    $response = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Read-EnvFileValue {
  param([string]$Path, [string]$Key)

  if (!(Test-Path -LiteralPath $Path)) {
    return ""
  }

  foreach ($rawLine in Get-Content -LiteralPath $Path) {
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
    $name = $line.Substring(0, $equals).Trim()
    if ($name -ne $Key) {
      continue
    }
    $value = $line.Substring($equals + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    return $value
  }

  return ""
}

function Import-OldGeminiKey {
  $hasSettingsKey = $false
  if (Test-Path -LiteralPath $SettingsJson) {
    try {
      $existing = Get-Content -LiteralPath $SettingsJson -Raw | ConvertFrom-Json
      $hasSettingsKey = -not [string]::IsNullOrWhiteSpace($existing.gemini_api_key)
    } catch {
      $hasSettingsKey = $false
    }
  }

  if ($hasSettingsKey) {
    return
  }

  $oldKey = Read-EnvFileValue -Path $OldEnvFile -Key "GOOGLE_API_KEY"
  if ([string]::IsNullOrWhiteSpace($oldKey)) {
    return
  }

  Write-Jarvis "Importando chave Gemini do projeto antigo." "DarkYellow"
  $settings = [ordered]@{
    gemini_api_key = $oldKey
    model = "gemini-2.5-flash"
    user_name = "Chefe"
    temperature = 0.6
    voice_enabled = $true
    voice_lang = "pt-BR"
    voice_rate = 1.0
    allow_destructive_tools = $false
    allow_terminal = $false
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SettingsJson) | Out-Null
  $settings | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $SettingsJson -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
Write-Jarvis "Projeto: $RootDir"

if (!(Test-Path -LiteralPath $VenvPython)) {
  $python = Resolve-Python
  Write-Jarvis "Criando ambiente Python..."
  Invoke-Checked -FilePath $python.File -Arguments (@($python.Args) + @("-m", "venv", $VenvDir)) -WorkingDirectory $RootDir
}

if (!(Test-Path -LiteralPath $ReadyMarker)) {
  Write-Jarvis "Instalando dependencias..."
  Invoke-Checked -FilePath $VenvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools") -WorkingDirectory $RootDir
  Invoke-Checked -FilePath $VenvPython -Arguments @("-m", "pip", "install", "-r", (Join-Path $BackendDir "requirements.txt")) -WorkingDirectory $RootDir
  Set-Content -LiteralPath $ReadyMarker -Value (Get-Date).ToString("s")
} else {
  Write-Jarvis "Dependencias ja prontas."
}

Import-OldGeminiKey
Stop-OldServers
Remove-Item -Force -LiteralPath $ServerOut, $ServerErr -ErrorAction SilentlyContinue

Write-Jarvis "Iniciando servidor local em $Url ..."
$server = Start-Process `
  -FilePath $VenvPython `
  -ArgumentList @("-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8765") `
  -WorkingDirectory $BackendDir `
  -PassThru `
  -RedirectStandardOutput $ServerOut `
  -RedirectStandardError $ServerErr

for ($i = 0; $i -lt 30; $i++) {
  if ($server.HasExited) {
    Write-Jarvis "Servidor encerrou durante a inicializacao." "Red"
    Get-Content -LiteralPath $ServerErr -ErrorAction SilentlyContinue
    throw "Servidor nao iniciou."
  }
  if (Test-Ready) {
    break
  }
  Start-Sleep -Seconds 1
}

if (!(Test-Ready)) {
  Get-Content -LiteralPath $ServerErr -ErrorAction SilentlyContinue
  throw "Servidor nao respondeu em $Url"
}

Start-Process $Url | Out-Null
Write-Jarvis "Aberto no navegador: $Url" "Green"
Write-Jarvis "Logs: $LogsDir" "DarkGray"
Write-Jarvis "Feche esta janela para parar o Jarvis Zero." "Yellow"

try {
  while (!$server.HasExited) {
    Start-Sleep -Seconds 2
  }
  Write-Jarvis "Servidor encerrado." "Yellow"
  Get-Content -LiteralPath $ServerErr -ErrorAction SilentlyContinue
} finally {
  if ($server -and !$server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
}
