# Deploy Production Script
Write-Host "Starting production deployment..." -ForegroundColor Green

# Check if production directory exists
if (Test-Path "../prod/ai-service") {
    Write-Host "Production directory exists. Checking for processes using it..." -ForegroundColor Yellow
    
    # Only stop processes that are actually using our production directory
    try {
        # Find processes that might be using the production directory
        $processesUsingDir = Get-Process | Where-Object {
            $_.Path -like "*prod/ai-service*" -or 
            $_.WorkingDirectory -like "*prod/ai-service*" -or
            ($_.ProcessName -eq "node" -and $_.CommandLine -like "*prod/ai-service*")
        }
        
        if ($processesUsingDir) {
            Write-Host "Found $($processesUsingDir.Count) process(es) using the production directory. Stopping..." -ForegroundColor Yellow
            foreach ($process in $processesUsingDir) {
                Write-Host "Stopping process: $($process.ProcessName) (ID: $($process.Id))" -ForegroundColor Yellow
                $process.Kill()
            }
            Start-Sleep -Seconds 3
        } else {
            Write-Host "No processes found using the production directory." -ForegroundColor Green
        }
    } catch {
        Write-Host "Warning: Error checking processes: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Remove the production directory
    Write-Host "Removing existing production directory..." -ForegroundColor Yellow
    try {
        # Force close any handles to the directory
        Start-Sleep -Seconds 2
        Remove-Item -Recurse -Force "../prod/ai-service" -ErrorAction Stop
        Write-Host "Production directory removed successfully." -ForegroundColor Green
    } catch {
        Write-Host "Error removing directory: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Trying alternative removal method..." -ForegroundColor Yellow
        
        # Try alternative removal method
        try {
            cmd /c "rmdir /s /q ..\prod\ai-service"
            Write-Host "Directory removed using alternative method." -ForegroundColor Green
        } catch {
            Write-Host "Failed to remove directory. Please manually delete ../prod/ai-service and try again." -ForegroundColor Red
            exit 1
        }
    }
}

# Copy the current directory to production
Write-Host "Copying files to production directory..." -ForegroundColor Yellow
try {
    Copy-Item -Recurse -Force "." "../prod/ai-service"
    Write-Host "Files copied successfully." -ForegroundColor Green
} catch {
    Write-Host "Error copying files: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Change to production directory
Write-Host "Changing to production directory..." -ForegroundColor Yellow
Set-Location "../prod/ai-service"

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Build the application
Write-Host "Building application..." -ForegroundColor Yellow
npm run build

# Start the production service
Write-Host "Starting production service..." -ForegroundColor Green
npm run start:prod

