#!/usr/bin/env pwsh
param()

$filePath = "C:\Users\acayr\Desktop\DEV\Orga PRO\orga-pro\src\components\App.jsx"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Split into lines to find and replace the section
$lines = $content -split "`r?`n"

# Find the line index containing the alert
$alertLineIndex = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "alert\(" -and $lines[$i] -match "Excel importé") {
    $alertLineIndex = $i
    break
  }
}

if ($alertLineIndex -eq -1) {
  Write-Output "ERROR: Could not find the alert line!"
  exit 1
}

Write-Output "Found alert at line $($alertLineIndex + 1)"

# Find the logger.info line after the alert
$loggerLineIndex = -1
for ($i = $alertLineIndex + 1; $i -lt [Math]::Min($alertLineIndex + 10, $lines.Count); $i++) {
  if ($lines[$i] -match "logger.info\(" -and $lines[$i] -match "Excel importé") {
    $loggerLineIndex = $i
    break
  }
}

if ($loggerLineIndex -eq -1) {
  Write-Output "ERROR: Could not find the logger.info line!"
  exit 1
}

Write-Output "Found logger.info at line $($loggerLineIndex + 1)"

# Build the new lines
$newLines = @(
  '      // CRITICAL: L''alert cause une perte de focus au niveau du système d''exploitation'
  '      // SOLUTION: Appeler requestFocus() IMMÉDIATEMENT après la fermeture de l''alert'
  '      // pour que Electron reprenne le focus système SANS attendre un clic utilisateur'
  '      if (window.electronAPI && window.electronAPI.requestFocus) {'
  '        console.log(''[App] Restauration du focus après alert (requestFocus)'');'
  '        window.electronAPI.requestFocus();'
  '      }'
  ''
  "      logger.info('Excel importé', { count: importedContacts.length, folderCount });"
)

# Replace lines between alert and logger.info (inclusive of logger.info)
# First, we need to determine what to remove (everything from alert+1 to logger inclusive, except the alert line itself)
$removeStart = $alertLineIndex + 2  # Skip the alert line and the blank line after it
$removeEnd = $loggerLineIndex

# Remove old lines and insert new ones
$result = @()
$result += $lines[0..$alertLineIndex]
$result += $newLines
$result += $lines[($loggerLineIndex + 1)..($lines.Count - 1)]

# Write back
$newContent = $result -join "`r`n"
[System.IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)

Write-Output "SUCCESS: File updated!"
Write-Output "Replaced lines $($alertLineIndex + 3) to $($loggerLineIndex + 1)"
