param(
    [string]$BaseUrl = "http://localhost",
    [int]$TimeoutSec = 10
)

$ErrorActionPreference = "Stop"
$tests = @()
$passed = 0
$failed = 0

function Test-Api {
    param($Name, $Uri, $Method = "GET", $Body = $null)
    try {
        $params = @{Uri = "$BaseUrl$Uri"; TimeoutSec = $TimeoutSec; Method = $Method}
        if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
        $response = Invoke-WebRequest @params
        $tests += [PSCustomObject]@{Name=$Name; Status="PASS"; Detail="HTTP $($response.StatusCode)"}
        return $response
    } catch {
        $tests += [PSCustomObject]@{Name=$Name; Status="FAIL"; Detail=$_.Exception.Message}
        return $null
    }
}

Write-Host "=== Property Multi-App Portal Smoke Test ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host ""

# Step 1: Health checks
Write-Host "[1] Service Health Checks" -ForegroundColor Yellow
$estimatorHealth = Test-Api "Estimator API Health" ":8001/healthz"
$analyticsHealth = Test-Api "Analytics API Health" ":8002/actuator/health"
$webHealth = Test-Api "Web Portal Health" ":3000/"
Write-Host ""

# Step 2: Estimator predict
Write-Host "[2] Estimator: POST /predict" -ForegroundColor Yellow
$predictBody = '{"features": {"square_footage": 2000, "bedrooms": 3, "bathrooms": 2, "year_built": 1995, "lot_size": 6000, "distance_to_city_center": 5, "school_rating": 7}}'
$predictResult = Test-Api "Predict" ":8001/predict" "POST" $predictBody
if ($predictResult) {
    $data = $predictResult.Content | ConvertFrom-Json
    if ($data.success) { $tests[-1].Detail = "Predicted: `$$($data.data.predicted_price)" }
}
Write-Host ""

# Step 3: Estimator history
Write-Host "[3] Estimator: GET /history" -ForegroundColor Yellow
$history = Test-Api "History" ":8001/history"
Write-Host ""

# Step 4: Analytics stats
Write-Host "[4] Analytics: GET /api/stats" -ForegroundColor Yellow
$stats = Test-Api "Market Stats" ":8002/api/stats"
Write-Host ""

# Step 5: Analytics dataset
Write-Host "[5] Analytics: GET /api/dataset" -ForegroundColor Yellow
$dataset = Test-Api "Dataset" ":8002/api/dataset?page=1&page_size=10"
Write-Host ""

# Step 6: Analytics what-if
Write-Host "[6] Analytics: POST /api/what-if" -ForegroundColor Yellow
$whatIfBody = '{"square_footage": 2500, "bedrooms": 4, "bathrooms": 2, "year_built": 2000, "lot_size": 8000, "distance_to_city_center": 3, "school_rating": 8}'
$whatIf = Test-Api "What-If Analysis" ":8002/api/what-if" "POST" $whatIfBody
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