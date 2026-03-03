# ============================================================
# SCRIPT DE NETTOYAGE NON-DESTRUCTIF
# ============================================================
# Ce script déplace les fichiers orphelins vers _trash_review/
# pour permettre une vérification avant suppression définitive
# ============================================================

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

# Configuration
$TrashDir = "$(Get-Location)/_trash_review"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LogFile = "$TrashDir/cleanup_$Timestamp.log"

# Couleurs pour l'output
$Colors = @{
    Success = 'Green'
    Warning = 'Yellow'
    Error   = 'Red'
    Info    = 'Cyan'
    Moved   = 'Blue'
}

function Write-Log {
    param([string]$Message, [string]$Level = 'Info')
    $Timestamp = Get-Date -Format "HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    
    Add-Content -Path $LogFile -Value $LogMessage -Encoding UTF8
    
    $Color = $Colors[$Level]
    if ($Verbose -or $Level -in ('Error', 'Warning')) {
        Write-Host $LogMessage -ForegroundColor $Color
    }
}

function Ensure-TrashDirectory {
    if (-not (Test-Path $TrashDir)) {
        New-Item -ItemType Directory -Path $TrashDir -Force | Out-Null
        Write-Host "✓ Répertoire créé: $TrashDir" -ForegroundColor $Colors.Success
        Write-Log "Répertoire préservation créé: $TrashDir" 'Success'
    }
}

function Move-FileWithStructure {
    param(
        [string]$SourcePath,
        [string]$RelativePath
    )
    
    if (-not (Test-Path $SourcePath)) {
        Write-Host "✗ Fichier non trouvé: $SourcePath" -ForegroundColor $Colors.Error
        Write-Log "Fichier non trouvé: $SourcePath" 'Error'
        return $false
    }
    
    # Créer la structure de répertoires dans _trash_review
    $DestRelativePath = Join-Path "_trash_review" $RelativePath
    $DestDirectory = Split-Path $DestRelativePath -Parent
    
    if (-not (Test-Path $DestDirectory)) {
        New-Item -ItemType Directory -Path $DestDirectory -Force | Out-Null
    }
    
    try {
        if ($DryRun) {
            Write-Host "  [DRY-RUN] Déplacerait: $RelativePath → $DestRelativePath" -ForegroundColor $Colors.Info
            Write-Log "DRY-RUN: $RelativePath → $DestRelativePath" 'Info'
        } else {
            Move-Item -Path $SourcePath -Destination $DestRelativePath -Force
            Write-Host "  ✓ Déplacé: $RelativePath" -ForegroundColor $Colors.Moved
            Write-Log "Déplacé: $SourcePath → $DestRelativePath" 'Success'
        }
        return $true
    } catch {
        Write-Host "  ✗ Erreur: $_" -ForegroundColor $Colors.Error
        Write-Log "Erreur lors du déplacement de $SourcePath : $_" 'Error'
        return $false
    }
}

# ============================================================
# DÉBUT DU NETTOYAGE
# ============================================================

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  NETTOYAGE NON-DESTRUCTIF DU WORKSPACE   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "[MODE DRY-RUN] Aucun fichier ne será réellement déplacé`n" -ForegroundColor $Colors.Warning
}

# Créer le répertoire de préservation
Ensure-TrashDirectory

# Initialiser le log
Add-Content -Path $LogFile -Value "═══════════════════════════════════════════════"
Add-Content -Path $LogFile -Value "NETTOYAGE NON-DESTRUCTIF - $Timestamp"
Add-Content -Path $LogFile -Value "DRY-RUN: $DryRun"
Add-Content -Path $LogFile -Value "═══════════════════════════════════════════════`n"

$FilesToMove = @()
$TotalSize = 0

# ============================================================
# FICHIERS JSX ORPHELINS
# ============================================================
Write-Host "1️⃣  Fichiers JSX orphelins (composants inutilisés):" -ForegroundColor $Colors.Info
$JsxOrphans = @(
    'src/components/Dialogs/ExportPreview2.jsx',
    'src/components/Dialogs/ExportPreview_MINIMAL.jsx'
)

foreach ($file in $JsxOrphans) {
    if (Test-Path $file) {
        $item = Get-Item $file
        $TotalSize += $item.Length
        Move-FileWithStructure -SourcePath $file -RelativePath $file
        $FilesToMove += $file
    }
}

# ============================================================
# FICHIERS DE TEST ORPHELINS
# ============================================================
Write-Host "`n2️⃣  Scripts de test non exécutés (orphelins):" -ForegroundColor $Colors.Info
$TestOrphans = @(
    'test_layout.js',
    'test_compile.js',
    'test_simple_layout.js',
    'test_layout_deep.js'
)

foreach ($file in $TestOrphans) {
    if (Test-Path $file) {
        $item = Get-Item $file
        $TotalSize += $item.Length
        Move-FileWithStructure -SourcePath $file -RelativePath $file
        $FilesToMove += $file
    }
}

# ============================================================
# FICHIERS PATCH/SAUVEGARDE
# ============================================================
Write-Host "`n3️⃣  Fichiers de patch et sauvegarde:" -ForegroundColor $Colors.Info
$BackupFiles = @(
    'tmp_patch_backup.txt',
    'src/components/Layout/ContactsPanel.patch.txt'
)

foreach ($file in $BackupFiles) {
    if (Test-Path $file) {
        $item = Get-Item $file
        $TotalSize += $item.Length
        Move-FileWithStructure -SourcePath $file -RelativePath $file
        $FilesToMove += $file
    }
}

# ============================================================
# SCRIPTS DE MAINTENANCE ONE-OFF
# ============================================================
Write-Host "`n4️⃣  Scripts de maintenance ponctuels:" -ForegroundColor $Colors.Info
$MaintenanceScripts = @(
    'remove_line.py',
    'check_line.py',
    'fix_focus.ps1',
    'replace_focus.ps1'
)

foreach ($file in $MaintenanceScripts) {
    if (Test-Path $file) {
        $item = Get-Item $file
        $TotalSize += $item.Length
        Move-FileWithStructure -SourcePath $file -RelativePath $file
        $FilesToMove += $file
    }
}

# ============================================================
# FICHIERS LOGS
# ============================================================
Write-Host "`n5️⃣  Fichiers logs (générés automatiquement):" -ForegroundColor $Colors.Info
$LogFiles = @(
    'build.log',
    'debug_start.log',
    'dev.log',
    'full_debug.log',
    'full_start.log',
    'npm_install.log',
    'start_error.log'
)

foreach ($file in $LogFiles) {
    if (Test-Path $file) {
        $item = Get-Item $file
        $TotalSize += $item.Length
        Move-FileWithStructure -SourcePath $file -RelativePath $file
        $FilesToMove += $file
    }
}

# ============================================================
# FICHIERS BUILD OUTPUT
# ============================================================
Write-Host "`n6️⃣  Fichiers de sortie de build:" -ForegroundColor $Colors.Info
$BuildOutputFiles = @(
    'build_output.txt',
    'build-output.txt',
    'build_output_test.txt'
)

foreach ($file in $BuildOutputFiles) {
    if (Test-Path $file) {
        $item = Get-Item $file
        $TotalSize += $item.Length
        Move-FileWithStructure -SourcePath $file -RelativePath $file
        $FilesToMove += $file
    }
}

# ============================================================
# SNAPSHOTS DE DONNÉES JSON
# ============================================================
Write-Host "`n7️⃣  Snapshots de données (non utilisés):" -ForegroundColor $Colors.Warning
$SnapshotFiles = @(
    'contacts_current.json',
    'orgcharts_current.json'
)

foreach ($file in $SnapshotFiles) {
    if (Test-Path $file) {
        $item = Get-Item $file
        $TotalSize += $item.Length
        Write-Host "  ⚠️  ATTENTION: $file contient des données - À VÉRIFIER avant suppression" -ForegroundColor $Colors.Warning
        Move-FileWithStructure -SourcePath $file -RelativePath $file
        $FilesToMove += $file
    }
}

# ============================================================
# DOCUMENTATION DE DEBUGGING
# ============================================================
Write-Host "`n8️⃣  Documentation de debugging (notes de session):" -ForegroundColor $Colors.Info
$DocFiles = @(
    'CONTACTS_DEBUG_FIX.md',
    'EXPORT_DEBUG.md',
    'README_FIX.md',
    'ID_REMAPPING_TEST_PLAN.md',
    'QUICK_TEST.md',
    'SESSION_SUMMARY.md',
    'SOLUTION_SUMMARY.md',
    'FIX_COMPLETE.md',
    'PIXEL_PERFECT_QA.md',
    'IMPLEMENTATION_SUMMARY.md',
    'LAYOUT_FIXES_SUMMARY.md',
    'TESTER_APERCU.md',
    'FILES_CREATED.md',
    'READING_INDEX.md'
)

foreach ($file in $DocFiles) {
    if (Test-Path $file) {
        $item = Get-Item $file
        $TotalSize += $item.Length
        Move-FileWithStructure -SourcePath $file -RelativePath $file
        $FilesToMove += $file
    }
}

# ============================================================
# RÉSUMÉ
# ============================================================
$SizeMB = [math]::Round($TotalSize / 1MB, 2)
$Count = $FilesToMove.Count

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              RÉSUMÉ DU NETTOYAGE          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "📊 Fichiers traités: " -ForegroundColor $Colors.Info -NoNewline
Write-Host "$Count fichiers" -ForegroundColor $Colors.Success

Write-Host "💾 Espace libéré: " -ForegroundColor $Colors.Info -NoNewline
Write-Host "$SizeMB MB" -ForegroundColor $Colors.Success

Write-Host "📁 Destination: " -ForegroundColor $Colors.Info -NoNewline
Write-Host "$TrashDir/" -ForegroundColor $Colors.Success

Write-Host "📝 Log complet: " -ForegroundColor $Colors.Info -NoNewline
Write-Host "$LogFile" -ForegroundColor $Colors.Success

if ($DryRun) {
    Write-Host "`n⚠️  MODE DRY-RUN: Aucun fichier n'a été réellement déplacé." -ForegroundColor $Colors.Warning
    Write-Host "   Exécutez à nouveau SANS -DryRun pour appliquer réellement le nettoyage.`n" -ForegroundColor $Colors.Warning
} else {
    Write-Host "`n✅ Nettoyage terminé avec succès!" -ForegroundColor $Colors.Success
    Write-Host "   Les fichiers sont dans: $TrashDir/" -ForegroundColor $Colors.Success
    Write-Host "   Vous pouvez les supprimer définitivement après vérification.`n" -ForegroundColor $Colors.Success
}

Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" 'Info'
Write-Log "RÉSUMÉ: $Count fichier(s) traité(s), $SizeMB MB" 'Success'
Write-Log "Destination: $TrashDir/" 'Success'

if ($DryRun) {
    Write-Log "Mode DRY-RUN - Aucun fichier réellement déplacé" 'Warning'
}

Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" 'Info'

# Ouvrir le dossier trash review
if (-not $DryRun -and $Count -gt 0) {
    Write-Host "`n🔍 Souhaitez-vous ouvrir le dossier _trash_review/? (y/n)" -ForegroundColor Cyan -NoNewline
    $response = Read-Host
    if ($response -eq 'y' -or $response -eq 'yes') {
        Invoke-Item $TrashDir
    }
}
