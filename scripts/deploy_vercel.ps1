# DisasterSense - Vercel Deployment Helper Script
param(
    [switch]$Prod
)

$ErrorActionPreference = "Stop"
$FrontendDir = Join-Path $PSScriptRoot "..\frontend"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "         DisasterSense - Vercel Deployment Helper          " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Verify Node and npm
Write-Host "`n[1/3] Verifying environment..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Error "Node.js is not found. Please install Node.js (v18+) to deploy to Vercel."
    exit 1
}
Write-Host "  Node.js version: $nodeVersion" -ForegroundColor Green

# 2. Check Vercel Login
Write-Host "`n[2/3] Checking Vercel authentication..." -ForegroundColor Yellow
$whoami = npx --yes vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  You are not currently logged in to Vercel." -ForegroundColor Yellow
    Write-Host "  Opening Vercel login in your browser..." -ForegroundColor Cyan
    npx --yes vercel login
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Vercel authentication was not completed. Please run 'npx vercel login' and try again."
        exit 1
    }
} else {
    Write-Host "  Authenticated as: $whoami" -ForegroundColor Green
}

# 3. Deploy Frontend
Write-Host "`n[3/3] Deploying DisasterSense Next.js frontend to Vercel..." -ForegroundColor Yellow
Push-Location $FrontendDir
try {
    if ($Prod) {
        Write-Host "  Target: Production (--prod)" -ForegroundColor Cyan
        npx --yes vercel --prod
    } else {
        Write-Host "  Target: Preview (use -Prod for production)" -ForegroundColor Cyan
        npx --yes vercel
    }
} finally {
    Pop-Location
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  Deployment command finished!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
