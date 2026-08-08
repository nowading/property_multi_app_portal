param(
    [int]$TimeoutSec = 10,
    [string]$InternalToken = $null
)

$ErrorActionPreference = "Stop"
$tests = @()
$passed = 0
$failed = 0

# Load INTERNAL_SERVICE_TOKEN from .env if not provided
if (-not $InternalToken -and (Test-Path "../.env")) {
    Get-Content "../.env" | ForEach-Object {
        if ($_ -match '^\s*INTERNAL_SERVICE_TOKEN\s*=\s*(.+)\s*$') {
            $script:InternalToken = $Matches[1].Trim('"').Trim("'")
        }
    }
}

# -------------------------------------------------------------------
# Helper: run a curl/wget inside a container and capture HTTP code
# -------------------------------------------------------------------
function Invoke-ContainerRequest {
    param(
        [string]$Container,
        [string]$Method = "GET",
        [string]$Path,
        [string]$Body = $null,
        [switch]$UseHttps,
        [string]$CaCertPath = "/app/certs/ca.crt"
    )

    $headers = @()
    if ($InternalToken) {
        $headers += "-H"
        $headers += "x-internal-token: $InternalToken"
    }

    $url = if ($UseHttps) { "https://localhost$Path" } else { "http://localhost$Path" }

    $curlArgs = @("-s", "-o", "/dev/null", "-w", "%{http_code}")
    if ($UseHttps -and $CaCertPath) {
        $curlArgs += "--cacert"
        $curlArgs += $CaCertPath
    }
    if ($Method -ne "GET") {
        $curlArgs += "-X"
        $curlArgs += $Method
    }
    if ($Body) {
        $curlArgs += "-H"
        $curlArgs += "Content-Type: application/json"
        $curlArgs += "-d"
        $curlArgs += $Body
    }
    $curlArgs += $url
    $curlArgs += $headers

    & docker compose exec -T $Container curl @curlArgs
}

function Test-Step {
    param($Name, $ScriptBlock)
    try {
        $code = & $ScriptBlock
        if ($code -ge 200 -and $code -lt 300) {
            $tests += [PSCustomObject]@{Name = $Name; Status = "PASS"; Detail = "HTTP $code"}
        } else {
            $tests += [PSCustomObject]@{Name = $Name; Status = "FAIL"; Detail = "HTTP $code"}
        }
    } catch {
        $tests += [PSCustomObject]@{Name = $Name; Status = "FAIL"; Detail = $_.Exception.Message}
    }
}

Write-Host "=== Property Multi-App Portal Smoke Test ===" -ForegroundColor Cyan
if ($InternalToken) {
    Write-Host "Internal token: loaded from .env" -ForegroundColor Gray
} else {
    Write-Host "Internal token: NOT LOADED (Phase A only — backends not yet token-gated)" -ForegroundColor Yellow
}
Write-Host ""

# Step 1: Health checks
Write-Host "[1] Service Health Checks" -ForegroundColor Yellow
# web is still host-bound on :3000
try {
    $web = Invoke-WebRequest -Uri "http://localhost:3000/" -TimeoutSec $TimeoutSec -UseBasicParsing
    $tests += [PSCustomObject]@{Name = "Web Portal Health"; Status = "PASS"; Detail = "HTTP $($web.StatusCode)"}
} catch {
    $tests += [PSCustomObject]@{Name = "Web Portal Health"; Status = "FAIL"; Detail = $_.Exception.Message}
}
Test-Step "Estimator Health" { Invoke-ContainerRequest -Container "estimator-api" -Path "/healthz" }
Test-Step "Analytics Health" { Invoke-ContainerRequest -Container "analytics-api" -Path "/actuator/health" }
Test-Step "ML Health (plaintext)" { Invoke-ContainerRequest -Container "ml-container" -Path "/health" }
Write-Host ""

# Step 2: Estimator predict
Write-Host "[2] Estimator: POST /predict" -ForegroundColor Yellow
$predictBody = '{"features": {"square_footage": 2000, "bedrooms": 3, "bathrooms": 2, "year_built": 1995, "lot_size": 6000, "distance_to_city_center": 5, "school_rating": 7}}'
Test-Step "Predict" { Invoke-ContainerRequest -Container "estimator-api" -Method "POST" -Path "/predict" -Body $predictBody }
Write-Host ""

# Step 3: Estimator history
Write-Host "[3] Estimator: GET /history" -ForegroundColor Yellow
Test-Step "History" { Invoke-ContainerRequest -Container "estimator-api" -Path "/history" }
Write-Host ""

# Step 4: Analytics stats
Write-Host "[4] Analytics: GET /api/stats" -ForegroundColor Yellow
Test-Step "Market Stats" { Invoke-ContainerRequest -Container "analytics-api" -Path "/api/stats" }
Write-Host ""

# Step 5: Analytics dataset
Write-Host "[5] Analytics: GET /api/dataset" -ForegroundColor Yellow
Test-Step "Dataset" { Invoke-ContainerRequest -Container "analytics-api" -Path "/api/dataset?page=1&page_size=10" }
Write-Host ""

# Step 6: Analytics what-if
Write-Host "[6] Analytics: POST /api/what-if" -ForegroundColor Yellow
$whatIfBody = '{"square_footage": 2500, "bedrooms": 4, "bathrooms": 2, "year_built": 2000, "lot_size": 8000, "distance_to_city_center": 3, "school_rating": 8}'
Test-Step "What-If Analysis" { Invoke-ContainerRequest -Container "analytics-api" -Method "POST" -Path "/api/what-if" -Body $whatIfBody }
Write-Host ""

# Step 7: Web → Backend integration
Write-Host "[7] Web → Backend integration (browser path)" -ForegroundColor Yellow
try {
    $webPage = Invoke-WebRequest -Uri "http://localhost:3000/estimator" -TimeoutSec $TimeoutSec -UseBasicParsing
    $tests += [PSCustomObject]@{Name = "Estimator page renders"; Status = "PASS"; Detail = "HTTP $($webPage.StatusCode)"}
} catch {
    $tests += [PSCustomObject]@{Name = "Estimator page renders"; Status = "FAIL"; Detail = $_.Exception.Message}
}
try {
    $webPage = Invoke-WebRequest -Uri "http://localhost:3000/analytics" -TimeoutSec $TimeoutSec -UseBasicParsing
    $tests += [PSCustomObject]@{Name = "Analytics page renders"; Status = "PASS"; Detail = "HTTP $($webPage.StatusCode)"}
} catch {
    $tests += [PSCustomObject]@{Name = "Analytics page renders"; Status = "FAIL"; Detail = $_.Exception.Message}
}
Write-Host ""

# Summary
Write-Host "=== Results ===" -ForegroundColor Cyan
foreach ($t in $tests) {
    $color = if ($t.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "[$($t.Status)] $($t.Name) - $($t.Detail)" -ForegroundColor $color
    if ($t.Status -eq "PASS") { $passed++ } else { $failed++ }
}
Write-Host ""
Write-Host "Passed: $passed / $($tests.Count)" -ForegroundColor $(if ($failed -eq 0) {"Green"} else {"Yellow"})
if ($failed -gt 0) {
    Write-Host "Failed: $failed" -ForegroundColor Red
    exit 1
}
