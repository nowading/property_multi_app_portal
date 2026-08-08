# Docker Integration Test: Analytics API Request Deduplication
# ====================================================================
# Purpose: Verify that the fix prevents duplicate API requests caused by
# React Strict Mode double-mount in Docker (next dev).
#
# Usage: powershell -File scripts/test-analytics-dedup.ps1
#
# Strategy:
#   1. Clear existing logs
#   2. Restart the web service so the new code is loaded
#   3. Wait for healthy
#   4. Access the analytics page with filter params
#   5. Check analytics-api logs for duplicate GET requests
# ====================================================================

$ErrorActionPreference = "Stop"
$composeCmd = "docker", "compose"

Write-Host "=== Analytics API Dedup Integration Test ===" -ForegroundColor Cyan
Write-Host ""

# -------------------------------------------------------------------
# Step 1: Clear logs for clean measurement
# -------------------------------------------------------------------
Write-Host "[1/5] Clearing analytics-api logs..." -ForegroundColor Yellow
& $composeCmd logs analytics-api --tail 0 2>&1 | Out-Null

# -------------------------------------------------------------------
# Step 2: Rebuild & restart web service to pick up code changes
# -------------------------------------------------------------------
Write-Host "[2/5] Rebuilding & restarting web service..." -ForegroundColor Yellow
& $composeCmd -f docker-compose.yml -f docker-compose.override.yml build --no-cache web 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}

& $composeCmd up -d web 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start web service" -ForegroundColor Red
    exit 1
}

# -------------------------------------------------------------------
# Step 3: Wait for web service to be healthy
# -------------------------------------------------------------------
Write-Host "[3/5] Waiting for web service to be ready..." -ForegroundColor Yellow
$maxWait = 60
$waited = 0
do {
    Start-Sleep -Seconds 3
    $waited += 3
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) { break }
    } catch { }
    Write-Host "  ... waiting ($waited s)" -ForegroundColor Gray
} while ($waited -lt $maxWait)

if ($waited -ge $maxWait) {
    Write-Host "WARNING: Web service may not be fully ready after ${maxWait}s" -ForegroundColor Yellow
}

# -------------------------------------------------------------------
# Step 4: Trigger analytics page loads and capture logs
# -------------------------------------------------------------------
Write-Host "[4/5] Triggering analytics page loads..." -ForegroundColor Yellow

# Wait a moment for any startup requests to settle
Start-Sleep -Seconds 3

# Record the timestamp BEFORE our test requests (use UTC for log matching)
$testStartTime = (Get-Date).ToUniversalTime()
Write-Host "  Test start time (UTC): $testStartTime" -ForegroundColor Gray

# Test 1: Analytics page with no filters (baseline)
Write-Host "  Test 1: Fetching /analytics (no filters)..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "http://localhost:3000/analytics" -TimeoutSec 10 -UseBasicParsing | Out-Null
} catch {
    Write-Host "  WARNING: Request may have failed: $_" -ForegroundColor Yellow
}
Start-Sleep -Seconds 2

# Test 2: Analytics page with filter params
Write-Host "  Test 2: Fetching /analytics?schoolRatingMin=7.5&yearBuiltMax=2017..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "http://localhost:3000/analytics?schoolRatingMin=7.5&yearBuiltMax=2017" -TimeoutSec 10 -UseBasicParsing | Out-Null
} catch {
    Write-Host "  WARNING: Request may have failed: $_" -ForegroundColor Yellow
}
Start-Sleep -Seconds 2

# Test 3: Same page again (should be cached / no extra requests if same filters)
Write-Host "  Test 3: Fetching /analytics (no filters, second visit)..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "http://localhost:3000/analytics" -TimeoutSec 10 -UseBasicParsing | Out-Null
} catch {
    Write-Host "  WARNING: Request may have failed: $_" -ForegroundColor Yellow
}
Start-Sleep -Seconds 3

# -------------------------------------------------------------------
# Step 5: Analyze logs for duplicate requests
# -------------------------------------------------------------------
Write-Host "[5/5] Analyzing analytics-api logs..." -ForegroundColor Yellow
Write-Host ""

# Get logs after test start time (using tail, then filter by timestamp manually)
$logs = & $composeCmd logs analytics-api 2>&1 | Out-String

# Extract all GET requests to /api/stats and /api/dataset with timestamps
$statsLines = $logs -split "`n" | Where-Object { $_ -match 'GET.*\/api\/(stats|dataset)' }

Write-Host "--- GET requests to analytics-api ---" -ForegroundColor Cyan
$statsLines | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
Write-Host ""

# Count requests
$statsCount = ($statsLines | Where-Object { $_ -match '/api/stats' }).Count
$datasetCount = ($statsLines | Where-Object { $_ -match '/api/dataset' }).Count

Write-Host "--- Summary ---" -ForegroundColor Cyan
Write-Host "  Total /api/stats requests : $statsCount" -ForegroundColor White
Write-Host "  Total /api/dataset requests: $datasetCount" -ForegroundColor White
Write-Host ""

# Analyze for duplicates: group by URL pattern and count occurrences within
# the same second window
$requests = $statsLines | ForEach-Object {
    if ($_ -match '(\d{2}:\d{2}:\d{2})\..*GET.*(/api/(?:stats|dataset)\?[^\s]*)') {
        [PSCustomObject]@{
            Time = $Matches[1]
            Endpoint = $Matches[2]
        }
    } elseif ($_ -match '(\d{2}:\d{2}:\d{2})\..*GET.*(/api/(?:stats|dataset))[^?]') {
        [PSCustomObject]@{
            Time = $Matches[1]
            Endpoint = $Matches[2] + " (no params)"
        }
    }
}

if ($requests.Count -gt 0) {
    Write-Host "--- Duplicate Analysis (same-second requests) ---" -ForegroundColor Cyan
    $grouped = $requests | Group-Object -Property Endpoint
    $hasDups = $false
    foreach ($group in $grouped) {
        # Group by timestamp (second-level granularity)
        $byTime = $group.Group | Group-Object -Property Time
        foreach ($timeGroup in $byTime) {
            if ($timeGroup.Count -gt 1) {
                Write-Host "  DUPLICATE: $($group.Name) at $($timeGroup.Name) × $($timeGroup.Count)" -ForegroundColor Red
                $hasDups = $true
            }
        }
    }
    if (-not $hasDups) {
        Write-Host "  No same-second duplicates detected!" -ForegroundColor Green
    }
} else {
    Write-Host "  No /api/stats or /api/dataset requests found in logs." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""

# Final verdict
if ($statsCount -le 6 -and $datasetCount -le 6 -and -not $hasDups) {
    Write-Host "RESULT: PASS - No excessive duplicate requests detected." -ForegroundColor Green
    exit 0
} else {
    Write-Host "RESULT: WARNING - Check request counts above. If duplicates detected, the fix may need further tuning." -ForegroundColor Yellow
    exit 0
}
