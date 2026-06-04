# Run once from repo: powershell -File v2/scripts/setup-production.ps1
# Requires apps/api/.env with DATABASE_URL (Neon)

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$api = Join-Path $root 'v2\apps\api'

if (-not (Test-Path (Join-Path $api '.env'))) {
  Write-Host 'Create v2/apps/api/.env with DATABASE_URL first.' -ForegroundColor Red
  exit 1
}

Push-Location $api
Write-Host 'Pushing schema to Neon...' -ForegroundColor Cyan
npx prisma db push
Write-Host 'Seeding database...' -ForegroundColor Cyan
npm run db:seed
Pop-Location

Write-Host ''
Write-Host 'Neon database is ready.' -ForegroundColor Green
Write-Host 'Next: add env vars in Vercel (see v2/docs/DEPLOY-VERCEL-NEON.md) and Redeploy.'
