param(
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
Set-Location 'C:\BOT_HackLabH_Release'

# Node compatibility guard (native deps in this project do not support Node 25+)
$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 18 -or $nodeMajor -gt 22) {
  Write-Host "[release] Node $(node -v) no compatible. Usa Node 20 LTS (recomendado)."
  Write-Host "[release] Ejemplo con nvm-windows:"
  Write-Host "  nvm install 20.19.0"
  Write-Host "  nvm use 20.19.0"
  exit 1
}

if (!(Test-Path '.env')) {
  if (Test-Path '.env.release') {
    Copy-Item .env.release .env -Force
    Write-Host '[release] .env creado desde .env.release'
  } elseif (Test-Path '.env.release.example') {
    Copy-Item .env.release.example .env -Force
    Write-Host '[release] .env creado desde .env.release.example (completa token/secret)'
  }
}

# Lavalink release container
$existing = docker ps -a --format '{{.Names}}' | Select-String '^hacklabh-release-lavalink$'
if (-not $existing) {
  docker run -d --name hacklabh-release-lavalink -p 2444:2333 ghcr.io/lavalink-devs/lavalink:4
} else {
  docker start hacklabh-release-lavalink | Out-Null
}

if (-not $NoInstall) {
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw '[release] npm install falló. Corrige dependencias antes de iniciar.'
  }
}

Write-Host '[release] iniciando bot/panel release en http://localhost:9666'
npm start
if ($LASTEXITCODE -ne 0) {
  throw '[release] npm start falló.'
}
