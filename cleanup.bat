@echo off
REM ============================================================
REM SCRIPT DE NETTOYAGE SÉCURISÉ - LAUNCHER
REM ============================================================
REM Ce script lance le nettoyage non-destructif de manière sûre

setlocal enabledelayedexpansion

color 0A
cls

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║      NETTOYAGE NON-DESTRUCTIF DU WORKSPACE ORGA-PRO       ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Vérifier que PowerShell est disponible
powershell -command "exit" >nul 2>&1
if errorlevel 1 (
    echo ✗ ERREUR: PowerShell n'est pas accessible
    pause
    exit /b 1
)

echo.
echo 📋 FICHIERS À NETTOYER :
echo    - 2 composants JSX orphelins (ExportPreview2, ExportPreview_MINIMAL)
echo    - 4 scripts de test non-exécutés
echo    - 2 fichiers de patch/sauvegarde
echo    - 4 scripts de maintenance ponctuels
echo    - 7 fichiers de logs générés
echo    - 3 fichiers de sortie de build
echo    - 2 snapshots de données JSON (⚠️  À VÉRIFIER)
echo    - 14 fichiers de documentation de debugging
echo.
echo 💾 Espace libéré: ~50-60 MB
echo.

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                    CHOIX D'ACTION                         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo   1) PRÉVISUALISER (Dry-Run) - Voir ce qui serait nettoyé
echo      sans rien déplacer
echo.
echo   2) EXÉCUTER LE NETTOYAGE - Déplacer les fichiers vers
echo      _trash_review/ (réversible)
echo.
echo   3) EXÉCUTER + VERBOSE - Voir tous les détails
echo.
echo   4) QUITTER sans rien faire
echo.

set /p choice="Votre choix (1-4): "

if "%choice%"=="1" goto dryrun
if "%choice%"=="2" goto execute
if "%choice%"=="3" goto verbose
if "%choice%"=="4" goto quit

echo ✗ Choix invalide
goto choice

:dryrun
cls
echo.
echo ⏱️  PRÉVISUALISATION (DRY-RUN) EN COURS...
echo.
powershell -ExecutionPolicy Bypass -File "cleanup.ps1" -DryRun -Verbose
pause
goto end

:execute
cls
echo.
echo ⚠️  NETTOYAGE EN COURS... (Cela peut prendre quelques secondes)
echo.
powershell -ExecutionPolicy Bypass -File "cleanup.ps1"
echo.
echo.
echo ✓ Nettoyage terminé!
echo   Les fichiers sont dans le dossier _trash_review/
echo   Consultez CLEANUP_GUIDE.md pour les prochaines étapes
echo.
pause
goto end

:verbose
cls
echo.
echo 📊 NETTOYAGE AVEC DÉTAILS (VERBOSE) EN COURS...
echo.
powershell -ExecutionPolicy Bypass -File "cleanup.ps1" -Verbose
echo.
echo.
echo ✓ Nettoyage terminé avec détails!
echo   Consultez le log dans _trash_review/ pour tous les détails
echo.
pause
goto end

:choice
pause
goto choice

:quit
echo.
echo Nettoyage abandonné.
echo.
pause
goto end

:end
cls
