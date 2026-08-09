# =============================================================================
# Generate a fresh INTERNAL_SERVICE_TOKEN (Phase B)
# =============================================================================
# Prints a 32-byte base64 token to stdout. Copy it into .env as
#   INTERNAL_SERVICE_TOKEN=<value>
# in EVERY service's environment (web, estimator-api, analytics-api,
# ml-container) so the shared secret matches.
#
# Usage:
#   powershell -File scripts/generate-internal-token.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# 32 random bytes -> base64 (43 chars, URL-safe alphabet)
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes)

Write-Host "Generated INTERNAL_SERVICE_TOKEN (32 bytes / 256 bits, base64):" -ForegroundColor Cyan
Write-Host ""
Write-Host "  INTERNAL_SERVICE_TOKEN=$token" -ForegroundColor Yellow
Write-Host ""
Write-Host "Paste the value above into .env, and into every container's env" -ForegroundColor Gray
Write-Host "(docker compose automatically maps .env -> environment block)." -ForegroundColor Gray
