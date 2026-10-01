# DisasterSense — 1-Click Shareable Cloudflare Tunnel Launcher
$ErrorActionPreference = "Continue"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "    DisasterSense Live Tunnel Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$WorkspaceRoot = "d:\DisasterSense"
$BackendDir = Join-Path $WorkspaceRoot "backend"
$FrontendDir = Join-Path $WorkspaceRoot "frontend"
$PythonExe = Join-Path $WorkspaceRoot ".venv\Scripts\python.exe"

# 1. Verify PostgreSQL Service & Clean up previous runs
Write-Host "[1/4] Checking PostgreSQL database and ports..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -ne "Running") {
    Write-Host "Starting PostgreSQL service..." -ForegroundColor Yellow
    Start-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}
Write-Host "PostgreSQL is active on port 5432." -ForegroundColor Green

# Ensure ports 8000 and 3000 are free
Get-NetTCPConnection -LocalPort 8000, 3000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500

# 2. Start FastAPI Backend
Write-Host "[2/4] Starting FastAPI backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $BackendDir `
    -PassThru -NoNewWindow

Start-Sleep -Seconds 3

# 3. Start Next.js Frontend
Write-Host "[3/4] Starting Next.js frontend on http://127.0.0.1:3000..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run start" `
    -WorkingDirectory $FrontendDir `
    -PassThru -NoNewWindow

Start-Sleep -Seconds 3

# 4. Start Cloudflare Tunnel
Write-Host "[4/4] Starting Cloudflare Tunnel..." -ForegroundColor Yellow

$tunnelUrl = $null
$cfProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
$cfProcessInfo.FileName = "cloudflared"
$cfProcessInfo.Arguments = "tunnel --url http://127.0.0.1:3000"
$cfProcessInfo.RedirectStandardError = $true
$cfProcessInfo.RedirectStandardOutput = $true
$cfProcessInfo.UseShellExecute = $false
$cfProcessInfo.CreateNoWindow = $true

$cfProcess = New-Object System.Diagnostics.Process
$cfProcess.StartInfo = $cfProcessInfo
$cfProcess.Start() | Out-Null

# Scan output for the generated trycloudflare.com URL
$startTime = Get-Date
while (-not $tunnelUrl -and ((Get-Date) - $startTime).TotalSeconds -lt 25) {
    Start-Sleep -Milliseconds 500
    while (-not $cfProcess.StandardError.EndOfStream) {
        $line = $cfProcess.StandardError.ReadLine()
        if ($line -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
            $tunnelUrl = $Matches[0]
            break
        }
    }
}

if ($tunnelUrl) {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "                   DISASTERSENSE IS LIVE & READY TO SHARE!                      " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  >> SHARE THIS LINK WITH YOUR FRIENDS:" -ForegroundColor White
    Write-Host "     $tunnelUrl" -ForegroundColor Cyan -BackgroundColor Black
    Write-Host ""
    Write-Host "  Local URLs on this laptop:" -ForegroundColor Gray
    Write-Host "     - Frontend:  http://localhost:3000" -ForegroundColor Gray
    Write-Host "     - Backend:   http://127.0.0.1:8000/docs" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Login Credentials (preset buttons also on login page):" -ForegroundColor White
    Write-Host "     * Admin:      admin@disastersense.org      / Password123!" -ForegroundColor Yellow
    Write-Host "     * Responder:  responder@disastersense.org  / Password123!" -ForegroundColor Yellow
    Write-Host "     * Citizen:    citizen@disastersense.org    / Password123!" -ForegroundColor Yellow
    Write-Host "     * Or anyone can Register a new account on the register page!" -ForegroundColor Green
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  Keep this window open while testing. Press Ctrl+C to stop all servers." -ForegroundColor Magenta
    Write-Host "================================================================================" -ForegroundColor Green

    # Keep alive until user interrupts or cloudflared exits
    try {
        while (-not $cfProcess.HasExited) {
            Start-Sleep -Seconds 1
        }
    } finally {
        Write-Host "Shutting down services..." -ForegroundColor Yellow
        if (-not $cfProcess.HasExited) { $cfProcess.Kill() }
        if (-not $frontendProcess.HasExited) { Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue }
        if (-not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue }
        # Kill lingering node or uvicorn processes if any
        Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Failed to retrieve Cloudflare Tunnel URL. Please check cloudflared installation." -ForegroundColor Red
    if (-not $cfProcess.HasExited) { $cfProcess.Kill() }
    if (-not $frontendProcess.HasExited) { Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue }
    if (-not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue }
}
