$filePath = "C:\Users\acayr\Desktop\DEV\Orga PRO\orga-pro\src\components\App.jsx"

# Read the file
$content = Get-Content -Path $filePath -Raw -Encoding UTF8

# Define the pattern to find and replace
$oldPattern = @"
      alert(\`✅ Excel importé!`n`$`{importedContacts.length`} contacts`n`$`{folderCount`} agences créées`);
      
      // NOTE: L'alert cause une perte de focus au niveau du système d'exploitation
      // C'est géré automatiquement par le listener window.focus event en App.jsx
      // qui restaure le focus sur l'input dès que la fenêtre regagne le focus
      
      logger.info('Excel importé', `{ count: importedContacts.length, folderCount `});
"@

$newPattern = @"
      alert(\`✅ Excel importé!`n`$`{importedContacts.length`} contacts`n`$`{folderCount`} agences créées`);
      
      // CRITICAL: L'alert cause une perte de focus au niveau du système d'exploitation
      // SOLUTION: Appeler requestFocus() IMMÉDIATEMENT après la fermeture de l'alert
      // pour que Electron reprenne le focus système SANS attendre un clic utilisateur
      if (window.electronAPI && window.electronAPI.requestFocus) {
        console.log('[App] Restauration du focus après alert (requestFocus)');
        window.electronAPI.requestFocus();
      }
      
      logger.info('Excel importé', `{ count: importedContacts.length, folderCount `});
"@

# Try simpler regex approach
$newContent = $content -replace '(?ms)(alert\(`✅ Excel importé!.*?agences créées`\);)\s*//\s*NOTE: L''alert cause une perte de focus au niveau du système d''exploitation\s*//\s*C''est géré automatiquement par le listener window\.focus event en App\.jsx\s*//\s*qui restaure le focus sur l''input dès que la fenêtre regagne le focus', '${1}
      
      // CRITICAL: L''alert cause une perte de focus au niveau du système d''exploitation
      // SOLUTION: Appeler requestFocus() IMMÉDIATEMENT après la fermeture de l''alert
      // pour que Electron reprenne le focus système SANS attendre un clic utilisateur
      if (window.electronAPI && window.electronAPI.requestFocus) {
        console.log(''[App] Restauration du focus après alert (requestFocus)'');
        window.electronAPI.requestFocus();
      }'

if ($content -ne $newContent) {
    Set-Content -Path $filePath -Value $newContent -Encoding UTF8
    Write-Host "✓ Replacement successful"
    Write-Host "File updated: $filePath"
} else {
    Write-Host "× No pattern match found - trying line-based replacement"
    
    # Split into lines
    $lines = $content -split "`n"
    
    # Find the alert line
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -like "*alert*" -and $lines[$i] -like "*Excel importé*") {
            Write-Host "Found alert at line $($i+1)"
            
            # Check the next 4 lines
            if ($i+4 -lt $lines.Count -and $lines[$i+3] -like "*NOTE*") {
                Write-Host "Found the comment section at lines $($i+4)-$($i+6)"
                
                # Build the new lines
                $lines[$i+3] = "      // CRITICAL: L'alert cause une perte de focus au niveau du système d'exploitation"
                $lines[$i+4] = "      // SOLUTION: Appeler requestFocus() IMMÉDIATEMENT après la fermeture de l'alert"
                
                # Insert new lines
                $newLines = @()
                for ($j = 0; $j -le $i+4; $j++) {
                    $newLines += $lines[$j]
                }
                
                $newLines += "      // pour que Electron reprenne le focus système SANS attendre un clic utilisateur"
                $newLines += "      if (window.electronAPI && window.electronAPI.requestFocus) {"
                $newLines += "        console.log('[App] Restauration du focus après alert (requestFocus)');"
                $newLines += "        window.electronAPI.requestFocus();"
                $newLines += "      }"
                $newLines += ""
                
                for ($j = $i+5; $j -lt $lines.Count; $j++) {
                    $newLines += $lines[$j]
                }
                
                $newContent = $newLines -join "`n"
                Set-Content -Path $filePath -Value $newContent -Encoding UTF8
                Write-Host "✓ Replacement successful via line-based method"
            }
            
            break
        }
    }
}
