param(
  [string]$BackupFile,
  [string]$TargetDatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not $TargetDatabaseUrl) {
  Write-Error "DATABASE_URL required"
}

if ($env:ALLOW_PRODUCTION_BACKUP -ne "1") {
  if ($TargetDatabaseUrl -match "hesapisleri\.com" -or $env:APP_ENV -eq "production") {
    Write-Error "Production restore blocked. Set ALLOW_PRODUCTION_BACKUP=1 to override intentionally."
  }
}

if (-not $BackupFile) {
  Write-Error "BackupFile parameter required"
}

if (-not (Test-Path $BackupFile)) {
  Write-Error "Backup file not found: $BackupFile"
}

$tempSql = Join-Path $env:TEMP ("hesapisleri-restore-" + [guid]::NewGuid().ToString() + ".sql")
try {
  if ($BackupFile.EndsWith(".gz")) {
    & gzip -dc $BackupFile | Set-Content -Path $tempSql -Encoding utf8
  } else {
    Copy-Item $BackupFile $tempSql
  }

  & psql $TargetDatabaseUrl -v ON_ERROR_STOP=1 -f $tempSql | Out-Null
  & psql $TargetDatabaseUrl -c "SELECT COUNT(*) AS company_count FROM \"Company\";" | Out-String | Write-Output
  Write-Output "RESTORE_OK"
}
finally {
  if (Test-Path $tempSql) { Remove-Item $tempSql -Force }
}
