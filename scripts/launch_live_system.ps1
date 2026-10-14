# DisasterSense Background Live System & Tunnel Launcher
$ErrorActionPreference = "Continue"

$WorkspaceRoot = "d:\DisasterSense"
$BackendDir = Join-Path $WorkspaceRoot "backend"
$FrontendDir = Join-Path $WorkspaceRoot "frontend"
$ScratchDir = Join-Path $WorkspaceRoot "scratch"
$PythonExe = Join-Path $WorkspaceRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $ScratchDir)) {
    New-Item -ItemType Directory -Path $ScratchDir -Force | Out-Null
}

# 1. Verify PostgreSQL
Write-Host "[1/5] Checking PostgreSQL service..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -ne "Running") {
    Start-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}
Write-Host "PostgreSQL is active." -ForegroundColor Green

# 2. Terminate previous instances on ports 8000, 3000 and cloudflared
Write-Host "[2/5] Cleaning up any old process listeners..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 8000, 3000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# 3. Start Backend
Write-Host "[3/5] Starting FastAPI backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$backendLog = Join-Path $ScratchDir "backend.log"
if (Test-Path $backendLog) { Remove-Item $backendLog -Force }

$bProc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $BackendDir `
    -RedirectStandardOutput $backendLog `
    -RedirectStandardError (Join-Path $ScratchDir "backend_err.log") `
    -PassThru

# Wait for backend health
$bReady = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/system/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($res.StatusCode -eq 200) {
            $bReady = $true
            break
        }
    } catch {
        # Keep waiting
    }
}

if ($bReady) {
    Write-Host "FastAPI backend is healthy on http://127.0.0.1:8000" -ForegroundColor Green
} else {
    Write-Host "Warning: Backend did not respond on /api/v1/system/health within 10s, continuing..." -ForegroundColor Yellow
}

# 4. Start Frontend
Write-Host "[4/5] Starting Next.js frontend on http://127.0.0.1:3000..." -ForegroundColor Yellow
$frontendLog = Join-Path $ScratchDir "frontend.log"
if (Test-Path $frontendLog) { Remove-Item $frontendLog -Force }

$fProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run start" `
    -WorkingDirectory $FrontendDir `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError (Join-Path $ScratchDir "frontend_err.log") `
    -PassThru

# Wait for frontend readiness
$fReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($res.StatusCode -eq 200) {
            $fReady = $true
            break
        }
    } catch {
        # Keep waiting
    }
}

if ($fReady) {
    Write-Host "Next.js frontend is active on http://127.0.0.1:3000" -ForegroundColor Green
} else {
    Write-Host "Frontend is initializing..." -ForegroundColor Yellow
}

# 5. Start Cloudflare Tunnel
Write-Host "[5/5] Launching Cloudflare Tunnel..." -ForegroundColor Yellow
$tunnelLog = Join-Path $ScratchDir "tunnel.log"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

$cfProc = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel", "--url", "http://127.0.0.1:3000" `
    -RedirectStandardError $tunnelLog `
    -RedirectStandardOutput (Join-Path $ScratchDir "tunnel_stdout.log") `
    -PassThru

# Wait for tunnel URL
$tunnelUrl = $null
$startWait = Get-Date
while (-not $tunnelUrl -and ((Get-Date) - $startWait).TotalSeconds -lt 25) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
            $tunnelUrl = $Matches[0]
            break
        }
    }
}

if ($tunnelUrl) {
    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "LIVE_SHAREABLE_URL: $tunnelUrl" -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Green
} else {
    Write-Host "Error: Could not retrieve Cloudflare Tunnel URL within 25 seconds." -ForegroundColor Red
    if (Test-Path $tunnelLog) {
        Get-Content $tunnelLog -Tail 15
    }
    exit 1
}
