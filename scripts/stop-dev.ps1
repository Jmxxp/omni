$ports = @(5173, 8765)

foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -ne 0 } |
    ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped process on port $port [$($_)]"
    }
}

