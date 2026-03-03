#!/usr/bin/env pwsh
# Script to move SAFE TO REMOVE files to .trash_review

param(
    [switch]$Preview = $false
)

$TrashDir = ".trash_review"
$ErrorCount = 0
$SuccessCount = 0

# Colors
$Colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "Cyan"
    Move    = "Blue"
}

Write-Host "`nMoving SAFE TO REMOVE files to .trash_review`n" -ForegroundColor Cyan

# Create .trash_review directory
if (-not (Test-Path $TrashDir)) {
    New-Item -ItemType Directory -Path $TrashDir -Force | Out-Null
    Write-Host "Created directory: $TrashDir/" -ForegroundColor $Colors.Success
} else {
    Write-Host "Directory exists: $TrashDir/" -ForegroundColor $Colors.Success
}

# List of files to move
Write-Host "`nFiles to move:" -ForegroundColor $Colors.Info
Write-Host ""

$FilesToMove = @(
    'build_output.txt',
    'build_output_test.txt',
    'build-output.txt',
    'tmp_patch_backup.txt',
    'src/components/Dialogs/ExportPreview2.jsx',
    'src/components/Dialogs/ExportPreview_MINIMAL.jsx',
    'src/components/Layout/OrgChartCanvas.OLD.jsx',
    'test_compile.js',
    'test_layout.js',
    'test_simple_layout.js',
    'test_layout_deep.js',
    'tests/idMappingTest.js',
    'contacts_current.json',
    'orgcharts_current.json'
)

# Move files
foreach ($file in $FilesToMove) {
    $SourcePath = $file
    
    if (Test-Path $SourcePath) {
        $DestPath = Join-Path $TrashDir $file
        $DestDir = Split-Path $DestPath -Parent
        
        if (-not (Test-Path $DestDir)) {
            New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
        }
        
        try {
            if ($Preview) {
                Write-Host "  [PREVIEW] $SourcePath -> $DestPath" -ForegroundColor $Colors.Info
            } else {
                Move-Item -Path $SourcePath -Destination $DestPath -Force
                Write-Host "  OK: $SourcePath" -ForegroundColor $Colors.Move
            }
            $SuccessCount++
        } catch {
            Write-Host "  ERROR: $file - $_" -ForegroundColor $Colors.Error
            $ErrorCount++
        }
    } else {
        Write-Host "  SKIP (not found): $file" -ForegroundColor $Colors.Warning
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Moved:       $SuccessCount files" -ForegroundColor $Colors.Success
Write-Host "Errors:      $ErrorCount files" -ForegroundColor $Colors.Error
Write-Host "Destination: .trash_review/" -ForegroundColor $Colors.Success
Write-Host "========================================" -ForegroundColor Cyan

if ($Preview) {
    Write-Host "`nPREVIEW mode - No files were moved" -ForegroundColor $Colors.Warning
    Write-Host "Run without -Preview to apply the move`n" -ForegroundColor $Colors.Warning
} else {
    Write-Host "`nMove completed!`n" -ForegroundColor $Colors.Success
    
    Write-Host "Open .trash_review folder? (y/n): " -ForegroundColor Cyan -NoNewline
    $response = Read-Host
    if ($response -eq "y") {
        Invoke-Item $TrashDir
    }
}
