param(
  [string]$OutputDir = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { "./backups" })
)

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL required"
}

if ($env:ALLOW_PRODUCTION_BACKUP -ne "1") {
  if ($env:DATABASE_URL -match "hesapisleri\.com" -or $env:APP_ENV -eq "production") {
    Write-Error "Production backup blocked. Set ALLOW_PRODUCTION_BACKUP=1 to override intentionally."
  }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$file = Join-Path $OutputDir "hesapisleri-$stamp.sql.gz"

& pg_dump $env:DATABASE_URL --no-owner --no-acl | gzip > $file

if (-not (Test-Path $file) -or (Get-Item $file).Length -eq 0) {
  Write-Error "Backup file empty"
}

Write-Output $file
