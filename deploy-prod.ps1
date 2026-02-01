# Deploy Production Script
Write-Host "Starting production deployment..." -ForegroundColor Green

# Get the script directory (where deploy-prod.ps1 is located)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Get absolute paths
$sourceDir = $scriptDir
$prodDir = "C:\jason\dev\prod"
$targetDir = Join-Path $prodDir "ai-service"

Write-Host "Source directory: $sourceDir" -ForegroundColor Cyan
Write-Host "Target directory: $targetDir" -ForegroundColor Cyan

# Check if production directory exists and remove it completely
if (Test-Path $targetDir) {
    Write-Host "Production directory exists. Checking for processes using it..." -ForegroundColor Yellow
    
    # Only stop processes that are actually using our production directory
    try {
        # Find Node.js processes that might be running from the production directory
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
            try {
                $procPath = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
                $procPath -like "*prod/ai-service*" -or $procPath -like "*$targetDir*"
            } catch {
                $false
            }
        }
        
        if ($nodeProcesses) {
            Write-Host "Found $($nodeProcesses.Count) Node.js process(es) using the production directory. Stopping..." -ForegroundColor Yellow
            foreach ($process in $nodeProcesses) {
                Write-Host "Stopping process: $($process.ProcessName) (ID: $($process.Id))" -ForegroundColor Yellow
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Seconds 3
        } else {
            Write-Host "No processes found using the production directory." -ForegroundColor Green
        }
    } catch {
        Write-Host "Warning: Error checking processes: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Remove the entire production directory using robocopy trick for locked files
    Write-Host "Removing existing production directory..." -ForegroundColor Yellow
    try {
        Start-Sleep -Seconds 2
        # Use robocopy trick to delete directory with locked files
        $emptyDir = Join-Path $env:TEMP "empty_$([Guid]::NewGuid())"
        New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
        robocopy $emptyDir $targetDir /MIR /R:3 /W:1 /NFL /NDL /NJH /NJS | Out-Null
        Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
        Remove-Item $targetDir -Recurse -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        
        # Try alternative method if directory still exists
        if (Test-Path $targetDir) {
            Write-Host "Trying alternative removal method..." -ForegroundColor Yellow
            cmd /c "rmdir /s /q `"$targetDir`"" 2>&1 | Out-Null
            Start-Sleep -Seconds 1
        }
        
        if (Test-Path $targetDir) {
            Write-Host "Warning: Could not fully remove directory. Some files may be locked." -ForegroundColor Yellow
            Write-Host "Will attempt to remove node_modules separately..." -ForegroundColor Yellow
            # Try to at least remove node_modules
            $nodeModulesPath = Join-Path $targetDir "node_modules"
            if (Test-Path $nodeModulesPath) {
                $emptyDir2 = Join-Path $env:TEMP "empty_$([Guid]::NewGuid())"
                New-Item -ItemType Directory -Path $emptyDir2 -Force | Out-Null
                robocopy $emptyDir2 $nodeModulesPath /MIR /R:3 /W:1 /NFL /NDL /NJH /NJS | Out-Null
                Remove-Item $emptyDir2 -Force -ErrorAction SilentlyContinue
                Remove-Item $nodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
            }
        } else {
            Write-Host "Production directory removed successfully." -ForegroundColor Green
        }
    } catch {
        Write-Host "Warning: Could not fully remove directory: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Will attempt to continue..." -ForegroundColor Yellow
    }
}

# Ensure prod directory exists
if (-not (Test-Path $prodDir)) {
    New-Item -ItemType Directory -Path $prodDir -Force | Out-Null
}

# Copy the current directory to production using robocopy (better for Windows)
Write-Host "Copying files to production directory..." -ForegroundColor Yellow
try {
    # Ensure target directory exists
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    
    # Use robocopy to copy files, excluding node_modules, dist, .git, and storage
    # Robocopy handles locked files better than Copy-Item
    # Robocopy syntax: robocopy source dest [files] [options]
    $copyResult = robocopy "$sourceDir" "$targetDir" /E /XD node_modules dist .git storage /XF *.log *.pid /NFL /NDL /NJH /NJS 2>&1
    $exitCode = $LASTEXITCODE
    
    # Robocopy returns 0-7 for success (0 = no files copied, 1-7 = success), 8+ for errors
    if ($exitCode -ge 8) {
        throw "Robocopy failed with exit code $exitCode"
    }
    
    Write-Host "Files copied successfully." -ForegroundColor Green
    
    # Verify package.json was copied
    $packageJsonPath = Join-Path $targetDir "package.json"
    if (-not (Test-Path $packageJsonPath)) {
        Write-Host "ERROR: package.json was not copied! Aborting." -ForegroundColor Red
        exit 1
    }
    Write-Host "Verified: package.json exists in target directory." -ForegroundColor Green
} catch {
    Write-Host "Error copying files: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Change to production directory
Write-Host "Changing to production directory..." -ForegroundColor Yellow
Set-Location $targetDir

# Install dependencies
# If node_modules exists with locked files, use npm install instead of npm ci
$hasNodeModules = Test-Path "node_modules"
if ($hasNodeModules) {
    Write-Host "node_modules still exists. Using npm install (which handles existing files better)..." -ForegroundColor Yellow
    npm install
} elseif (Test-Path "package-lock.json") {
    Write-Host "Using package-lock.json for clean install..." -ForegroundColor Yellow
    npm ci
} else {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error installing dependencies." -ForegroundColor Red
    exit 1
}
Write-Host "Dependencies installed successfully." -ForegroundColor Green

# Build the application
Write-Host "Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building application." -ForegroundColor Red
    exit 1
}
Write-Host "Build completed successfully." -ForegroundColor Green

# Find and kill any process using port 8081
Write-Host "Checking for processes using port 8081..." -ForegroundColor Yellow
$port = 8081
$pidsToKill = @()
$netstatOutput = netstat -ano | findstr ":$port"
foreach ($line in $netstatOutput) {
    if ($line -match '\s+(\d+)\s*$') {
        $processId = [int]$matches[1]
        if ($processId -gt 0) {
            $pidsToKill += $processId
        }
    }
}

# Remove duplicates and kill processes
$pidsToKill = $pidsToKill | Sort-Object -Unique
foreach ($processId in $pidsToKill) {
    try {
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Found process $($proc.ProcessName) (PID: $processId) using port $port. Stopping..." -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
        }
    } catch {
        # Process might have already terminated
    }
}

if ($pidsToKill.Count -gt 0) {
    Write-Host "Stopped $($pidsToKill.Count) process(es) using port $port." -ForegroundColor Green
    Start-Sleep -Seconds 1
} else {
    Write-Host "No processes found using port $port." -ForegroundColor Green
}

# Start the production service
Write-Host "Starting production service..." -ForegroundColor Green
npm run start:prod


