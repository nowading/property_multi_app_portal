param(
    [int]$TimeoutSec = 10,
    [string]$InternalToken = $null
)

$ErrorActionPreference = "Stop"
$script:tests = @()
$passed = 0
$failed = 0

# Load INTERNAL_SERVICE_TOKEN from .env if not provided.
# The script is invoked from the repo root (e.g. `powershell -File scripts/smoke.ps1`),
# so look for .env in the current directory.
if (-not $InternalToken -and (Test-Path "./.env")) {
    Get-Content "./.env" | ForEach-Object {
        if ($_ -match '^\s*INTERNAL_SERVICE_TOKEN\s*=\s*(.+)\s*$') {
            $script:InternalToken = $Matches[1].Trim('"').Trim("'")
        }
    }
}

# -------------------------------------------------------------------
# Helper: run an HTTP request from inside a container and capture the
# status code. We use Python (in ml-container and estimator-api) or
# wget (in analytics-api which has no Python). The Python script is
# written to a temp file on the host and piped into the container via
# stdin to dodge PowerShell argument-quoting around embedded `"` and `$`.
# -------------------------------------------------------------------
$script:SmokePyPath = Join-Path $env:TEMP "smoke_request.py"
@'
import os, ssl, sys, urllib.request, urllib.error
url = os.environ["SMOKE_URL"]
method = os.environ["SMOKE_METHOD"]
body = os.environ.get("SMOKE_BODY") or None
cafile = os.environ.get("SMOKE_CA")
token = os.environ.get("SMOKE_TOKEN")
headers = {"x-internal-token": token} if token else {}
if body is not None:
    headers["Content-Type"] = "application/json"
data = body.encode() if body else None
req = urllib.request.Request(url, data=data, method=method, headers=headers)
ctx = ssl.create_default_context(cafile=cafile) if cafile else None
try:
    resp = urllib.request.urlopen(req, timeout=8, context=ctx)
    sys.stdout.write(str(resp.status))
except urllib.error.HTTPError as e:
    sys.stdout.write(str(e.code))
except Exception as e:
    sys.stdout.write("ERR:" + type(e).__name__)
'@ | Set-Content -Path $script:SmokePyPath -Encoding UTF8 -NoNewline

function Invoke-ContainerRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Container,
        [string]$Method = "GET",
        [Parameter(Mandatory)][string]$RequestPath,
        [string]$Body = $null,
        [switch]$UseHttps,
        [string]$CaCertPath = "/app/certs/ca.crt"
    )

    # Each container's internal listen port. From the container's
    # perspective the request goes to localhost:<port> because the service
    # binds 0.0.0.0 and the request stays inside the container's network
    # namespace.
    $portByContainer = @{
        "ml-container"  = 8000
        "estimator-api" = 8001
        "analytics-api" = 8002
    }
    $port = $portByContainer[$Container]
    if (-not $port) {
        throw "Invoke-ContainerRequest: unknown container '$Container'"
    }
    $fullUrl = if ($UseHttps) {
        "https://localhost:${port}${RequestPath}"
    } else {
        "http://localhost:${port}${RequestPath}"
    }

    $env:SMOKE_URL = $fullUrl
    $env:SMOKE_METHOD = $Method
    $env:SMOKE_BODY = $Body
    $env:SMOKE_CA = $(if ($UseHttps) { $CaCertPath } else { "" })
    $env:SMOKE_TOKEN = $(if ($InternalToken) { $InternalToken } else { "" })

    # analytics-api has only curl/wget (BusyBox); ml-container and
    # estimator-api have python3. We use if/else instead of switch
    # because PowerShell ``switch`` statement inside a function invoked
    # via a scriptblock has subtle evaluation-order quirks that caused
    # the analytics branch to be skipped.
    if ($Container -eq "analytics-api") {
        # analytics-api container has no python3. Use curl (BusyBox) for
        # HTTPS-capable requests. For POST bodies we stream the JSON via
        # stdin (``-d @-``) because PowerShell's @splat on Windows cannot
        # reliably quote args whose value contains ``"``; the Windows
        # command-line parser would otherwise split the body at every
        # embedded double-quote, producing a malformed JSON payload.
        $curlArgs = @("-s", "-w", "`nHTTP_CODE:%{http_code}")
        if ($UseHttps -and $CaCertPath) {
            $curlArgs += "--cacert"
            $curlArgs += $CaCertPath
        }
        if ($env:SMOKE_TOKEN) {
            $curlArgs += "-H"
            $curlArgs += "x-internal-token: $env:SMOKE_TOKEN"
        }
        if ($Method -ne "GET") {
            $curlArgs += "-X"
            $curlArgs += $Method
        }
        $useStdinBody = $false
        if ($Body) {
            $curlArgs += "-H"
            $curlArgs += "Content-Type: application/json"
            $curlArgs += "-d"
            $curlArgs += "@-"
            $useStdinBody = $true
        }
        $curlArgs += $fullUrl
        $curlOutput = ""
        try {
            if ($useStdinBody) {
                $bodyPipe = $Body
                $curlOutput = $bodyPipe | & docker compose exec -T $Container curl @curlArgs 2>&1 | Out-String
            } else {
                $curlOutput = & docker compose exec -T $Container curl @curlArgs 2>&1 | Out-String
            }
        } catch {
            $curlOutput = $_.Exception.Message
        }
        # curl writes the response body followed by ``HTTP_CODE:<code>`` on
        # a new line; extract the trailing status code.
        $matchResult = [regex]::Match($curlOutput, 'HTTP_CODE:(\d{3})')
        if ($matchResult.Success) {
            $matchResult.Groups[1].Value
        } else {
            "ERR:curl"
        }
    } else {
        $result = Get-Content $script:SmokePyPath -Raw | & docker compose exec -T -e SMOKE_URL -e SMOKE_METHOD -e SMOKE_BODY -e SMOKE_CA -e SMOKE_TOKEN $Container python3 -
        "$result".Trim()
    }

    Remove-Item Env:SMOKE_URL,SMOKE_METHOD,SMOKE_BODY,SMOKE_CA,SMOKE_TOKEN -ErrorAction SilentlyContinue
}

function Test-Step {
    param($Name, $ScriptBlock)
    try {
        $code = & $ScriptBlock
        if ($code -ge 200 -and $code -lt 300) {
            $script:tests += [PSCustomObject]@{Name = $Name; Status = "PASS"; Detail = "HTTP $code"}
        } else {
            $script:tests += [PSCustomObject]@{Name = $Name; Status = "FAIL"; Detail = "HTTP $code"}
        }
    } catch {
        $script:tests += [PSCustomObject]@{Name = $Name; Status = "FAIL"; Detail = $_.Exception.Message}
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
try {
    $web = Invoke-WebRequest -Uri "http://localhost:3000/" -TimeoutSec $TimeoutSec -UseBasicParsing
    $script:tests += [PSCustomObject]@{Name = "Web Portal Health"; Status = "PASS"; Detail = "HTTP $($web.StatusCode)"}
} catch {
    $script:tests += [PSCustomObject]@{Name = "Web Portal Health"; Status = "FAIL"; Detail = $_.Exception.Message}
}
Test-Step "Estimator Health" { Invoke-ContainerRequest -Container "estimator-api" -RequestPath "/healthz" }
Test-Step "Analytics Health" { Invoke-ContainerRequest -Container "analytics-api" -RequestPath "/actuator/health" }
# ML container is TLS-only since Phase C; probe via HTTPS with the CA cert.
Test-Step "ML Health (HTTPS, CA-verified)" { Invoke-ContainerRequest -Container "ml-container" -RequestPath "/health" -UseHttps }
Write-Host ""

# Step 2: Estimator predict
Write-Host "[2] Estimator: POST /predict" -ForegroundColor Yellow
$predictBody = '{"features": {"square_footage": 2000, "bedrooms": 3, "bathrooms": 2, "year_built": 1995, "lot_size": 6000, "distance_to_city_center": 5, "school_rating": 7}}'
Test-Step "Predict" { Invoke-ContainerRequest -Container "estimator-api" -Method "POST" -RequestPath "/predict" -Body $predictBody }
Write-Host ""

# Step 3: Estimator history
Write-Host "[3] Estimator: GET /history" -ForegroundColor Yellow
Test-Step "History" { Invoke-ContainerRequest -Container "estimator-api" -RequestPath "/history" }
Write-Host ""

# Step 4: Analytics stats
Write-Host "[4] Analytics: GET /api/stats" -ForegroundColor Yellow
Test-Step "Market Stats" { Invoke-ContainerRequest -Container "analytics-api" -RequestPath "/api/stats" }
Write-Host ""

# Step 5: Analytics dataset
Write-Host "[5] Analytics: GET /api/dataset" -ForegroundColor Yellow
Test-Step "Dataset" { Invoke-ContainerRequest -Container "analytics-api" -RequestPath "/api/dataset?page=1&page_size=10" }
Write-Host ""

# Step 6: Analytics what-if
Write-Host "[6] Analytics: POST /api/what-if" -ForegroundColor Yellow
$whatIfBody = '{"square_footage": 2500, "bedrooms": 4, "bathrooms": 2, "year_built": 2000, "lot_size": 8000, "distance_to_city_center": 3, "school_rating": 8}'
Test-Step "What-If Analysis" { Invoke-ContainerRequest -Container "analytics-api" -Method "POST" -RequestPath "/api/what-if" -Body $whatIfBody }
Write-Host ""

# Step 7: Web → Backend integration
Write-Host "[7] Web → Backend integration (browser path)" -ForegroundColor Yellow
try {
    $webPage = Invoke-WebRequest -Uri "http://localhost:3000/estimator" -TimeoutSec $TimeoutSec -UseBasicParsing
    $script:tests += [PSCustomObject]@{Name = "Estimator page renders"; Status = "PASS"; Detail = "HTTP $($webPage.StatusCode)"}
} catch {
    $script:tests += [PSCustomObject]@{Name = "Estimator page renders"; Status = "FAIL"; Detail = $_.Exception.Message}
}
try {
    $webPage = Invoke-WebRequest -Uri "http://localhost:3000/analytics" -TimeoutSec $TimeoutSec -UseBasicParsing
    $script:tests += [PSCustomObject]@{Name = "Analytics page renders"; Status = "PASS"; Detail = "HTTP $($webPage.StatusCode)"}
} catch {
    $script:tests += [PSCustomObject]@{Name = "Analytics page renders"; Status = "FAIL"; Detail = $_.Exception.Message}
}
Write-Host ""

# Summary
Write-Host "=== Results ===" -ForegroundColor Cyan
foreach ($t in $script:tests) {
    $color = if ($t.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "[$($t.Status)] $($t.Name) - $($t.Detail)" -ForegroundColor $color
    if ($t.Status -eq "PASS") { $passed++ } else { $failed++ }
}
Write-Host ""
Write-Host "Passed: $passed / $($script:tests.Count)" -ForegroundColor $(if ($failed -eq 0) {"Green"} else {"Yellow"})
if ($failed -gt 0) {
    Write-Host "Failed: $failed" -ForegroundColor Red
    exit 1
}
