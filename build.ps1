# LarkSync Build Script
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  LarkSync - Build" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean
Write-Host "[1/4] Cleaning old output..." -ForegroundColor Yellow
if (Test-Path "out") {
    Remove-Item -Recurse -Force "out"
}
Write-Host "  Done." -ForegroundColor Green

# Step 2: Install deps if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "[2/4] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  npm install failed!" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "[2/4] Dependencies exist, skipping." -ForegroundColor DarkGray
}

# Step 3: Compile TypeScript
Write-Host "[3/4] Compiling TypeScript..." -ForegroundColor Yellow
npx tsc -p ./
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Compile failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Compile OK." -ForegroundColor Green

# Step 4: Package VSIX
Write-Host "[4/4] Packaging VSIX..." -ForegroundColor Yellow

$vsceCmd = $null
try {
    $vsceCmd = Get-Command vsce -ErrorAction SilentlyContinue
}
catch {
    $vsceCmd = $null
}

if (-not $vsceCmd) {
    Write-Host "  Installing @vscode/vsce globally..." -ForegroundColor DarkGray
    npm install -g @vscode/vsce
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  vsce install failed!" -ForegroundColor Red
        exit 1
    }
}

$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$ver = $pkg.version
$outFile = "larksync-" + $ver + ".vsix"

if (Test-Path $outFile) {
    Remove-Item -Force $outFile
}

vsce package --no-dependencies
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Packaging failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Build OK!" -ForegroundColor Green
Write-Host "  Output: $outFile" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Install cmd: code --install-extension $outFile" -ForegroundColor Cyan
Write-Host ""
