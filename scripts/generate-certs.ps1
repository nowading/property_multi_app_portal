# =============================================================================
# Self-signed CA + service certs for mTLS (Phase C)
# =============================================================================
# Thin wrapper that invokes the Python implementation (scripts/generate_certs.py).
# The Python script uses the `cryptography` library which is already installed
# in the project's Python environment.
#
# Usage:
#   powershell -File scripts/generate-certs.ps1
#   powershell -File scripts/generate-certs.ps1 -Force
# =============================================================================

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonScript = Join-Path $ScriptDir "generate_certs.py"

# Locate the project Python
$PythonExe = $env:PYTHON_EXE
if (-not $PythonExe) {
    $Candidates = @(
        "D:\DevEnv\Python\Python313\python.exe",
        "D:\DevEnv\Python\Python312\python.exe",
        (Get-Command python -ErrorAction SilentlyContinue)?.Source,
        (Get-Command python3 -ErrorAction SilentlyContinue)?.Source
    ) | Where-Object { $_ -and (Test-Path $_) }
    $PythonExe = $Candidates | Select-Object -First 1
}
if (-not $PythonExe) {
    Write-Host "ERROR: Python executable not found. Set PYTHON_EXE or install Python." -ForegroundColor Red
    exit 1
}

$args = @($PythonScript)
if ($Force) { $args += "--force" }

& $PythonExe @args
exit $LASTEXITCODE
