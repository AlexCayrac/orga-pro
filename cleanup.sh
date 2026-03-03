#!/bin/bash
# ============================================================
# SCRIPT DE NETTOYAGE NON-DESTRUCTIF (macOS/Linux)
# ============================================================
# Ce script déplace les fichiers orphelins vers _trash_review/
# pour permettre une vérification avant suppression définitive
# ============================================================

set -e

# Configuration
TRASH_DIR="_trash_review"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="$TRASH_DIR/cleanup_$TIMESTAMP.log"

# Flags
DRY_RUN=false
VERBOSE=false
TOTAL_SIZE=0
MOVED_COUNT=0

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Affichage avec couleur
print_success() {
    echo -e "${GREEN}✓${NC} $1"
    echo "[$(date +'%H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

print_info() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}ℹ${NC} $1"
    fi
    echo "[$(date +'%H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    echo "[$(date +'%H:%M:%S')] [WARNING] $1" >> "$LOG_FILE"
}

print_error() {
    echo -e "${RED}✗${NC} $1" >&2
    echo "[$(date +'%H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Usage: $0 [-d|--dry-run] [-v|--verbose]"
            exit 1
            ;;
    esac
done

# Créer le répertoire
ensure_trash_directory() {
    if [ ! -d "$TRASH_DIR" ]; then
        mkdir -p "$TRASH_DIR"
        print_success "Répertoire créé: $TRASH_DIR"
    fi
}

# Déplacer un fichier en préservant la structure
move_file_with_structure() {
    local source=$1
    local relative=$2
    
    if [ ! -f "$source" ]; then
        print_error "Fichier non trouvé: $source"
        return 1
    fi
    
    local dest_dir="$TRASH_DIR/$(dirname "$relative")"
    local dest="$TRASH_DIR/$relative"
    
    # Créer la structure si nécessaire
    mkdir -p "$dest_dir"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${BLUE}[DRY-RUN]${NC} Déplacerait: $relative → $dest"
        print_info "DRY-RUN: $relative → $dest"
    else
        mv "$source" "$dest"
        print_success "Déplacé: $relative"
    fi
    
    MOVED_COUNT=$((MOVED_COUNT + 1))
    if [ -f "$dest" ]; then
        TOTAL_SIZE=$((TOTAL_SIZE + $(stat -f%z "$dest" 2>/dev/null || stat -c%s "$dest" 2>/dev/null)))
    fi
}

# ============================================================
# DÉBUT DU NETTOYAGE
# ============================================================

echo -e "\n${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  NETTOYAGE NON-DESTRUCTIF DU WORKSPACE   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[MODE DRY-RUN] Aucun fichier ne sera réellement déplacé\n${NC}"
fi

# Créer le répertoire de préservation
ensure_trash_directory

# Initialiser le log
{
    echo "═══════════════════════════════════════════════"
    echo "NETTOYAGE NON-DESTRUCTIF - $TIMESTAMP"
    echo "DRY-RUN: $DRY_RUN"
    echo "═══════════════════════════════════════════════"
    echo ""
} > "$LOG_FILE"

# ============================================================
# FICHIERS JSX ORPHELINS
# ============================================================
echo -e "1️⃣  Fichiers JSX orphelins (composants inutilisés):"
declare -a jsx_orphans=(
    "src/components/Dialogs/ExportPreview2.jsx"
    "src/components/Dialogs/ExportPreview_MINIMAL.jsx"
)

for file in "${jsx_orphans[@]}"; do
    [ -f "$file" ] && move_file_with_structure "$file" "$file"
done

# ============================================================
# FICHIERS DE TEST ORPHELINS
# ============================================================
echo -e "\n2️⃣  Scripts de test non exécutés (orphelins):"
declare -a test_orphans=(
    "test_layout.js"
    "test_compile.js"
    "test_simple_layout.js"
    "test_layout_deep.js"
)

for file in "${test_orphans[@]}"; do
    [ -f "$file" ] && move_file_with_structure "$file" "$file"
done

# ============================================================
# FICHIERS PATCH/SAUVEGARDE
# ============================================================
echo -e "\n3️⃣  Fichiers de patch et sauvegarde:"
declare -a backup_files=(
    "tmp_patch_backup.txt"
    "src/components/Layout/ContactsPanel.patch.txt"
)

for file in "${backup_files[@]}"; do
    [ -f "$file" ] && move_file_with_structure "$file" "$file"
done

# ============================================================
# SCRIPTS DE MAINTENANCE ONE-OFF
# ============================================================
echo -e "\n4️⃣  Scripts de maintenance ponctuels:"
declare -a maintenance_scripts=(
    "remove_line.py"
    "check_line.py"
    "fix_focus.ps1"
    "replace_focus.ps1"
)

for file in "${maintenance_scripts[@]}"; do
    [ -f "$file" ] && move_file_with_structure "$file" "$file"
done

# ============================================================
# FICHIERS LOGS
# ============================================================
echo -e "\n5️⃣  Fichiers logs (générés automatiquement):"
declare -a log_files=(
    "build.log"
    "debug_start.log"
    "dev.log"
    "full_debug.log"
    "full_start.log"
    "npm_install.log"
    "start_error.log"
)

for file in "${log_files[@]}"; do
    [ -f "$file" ] && move_file_with_structure "$file" "$file"
done

# ============================================================
# FICHIERS BUILD OUTPUT
# ============================================================
echo -e "\n6️⃣  Fichiers de sortie de build:"
declare -a build_output_files=(
    "build_output.txt"
    "build-output.txt"
    "build_output_test.txt"
)

for file in "${build_output_files[@]}"; do
    [ -f "$file" ] && move_file_with_structure "$file" "$file"
done

# ============================================================
# SNAPSHOTS DE DONNÉES JSON
# ============================================================
echo -e "\n7️⃣  Snapshots de données (non utilisés):"
declare -a snapshot_files=(
    "contacts_current.json"
    "orgcharts_current.json"
)

for file in "${snapshot_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${YELLOW}⚠️  ATTENTION: $file contient des données - À VÉRIFIER avant suppression${NC}"
        move_file_with_structure "$file" "$file"
    fi
done

# ============================================================
# DOCUMENTATION DE DEBUGGING
# ============================================================
echo -e "\n8️⃣  Documentation de debugging (notes de session):"
declare -a doc_files=(
    "CONTACTS_DEBUG_FIX.md"
    "EXPORT_DEBUG.md"
    "README_FIX.md"
    "ID_REMAPPING_TEST_PLAN.md"
    "QUICK_TEST.md"
    "SESSION_SUMMARY.md"
    "SOLUTION_SUMMARY.md"
    "FIX_COMPLETE.md"
    "PIXEL_PERFECT_QA.md"
    "IMPLEMENTATION_SUMMARY.md"
    "LAYOUT_FIXES_SUMMARY.md"
    "TESTER_APERCU.md"
    "FILES_CREATED.md"
    "READING_INDEX.md"
)

for file in "${doc_files[@]}"; do
    [ -f "$file" ] && move_file_with_structure "$file" "$file"
done

# ============================================================
# RÉSUMÉ
# ============================================================
SIZE_MB=$(echo "scale=2; $TOTAL_SIZE / 1048576" | bc)

echo -e "\n${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              RÉSUMÉ DU NETTOYAGE          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}\n"

echo -e "📊 Fichiers traités: ${GREEN}$MOVED_COUNT fichiers${NC}"
echo -e "💾 Espace libéré: ${GREEN}${SIZE_MB} MB${NC}"
echo -e "📁 Destination: ${GREEN}$TRASH_DIR/${NC}"
echo -e "📝 Log complet: ${GREEN}$LOG_FILE${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}⚠️  MODE DRY-RUN: Aucun fichier n'a été réellement déplacé.${NC}"
    echo -e "   Exécutez à nouveau SANS -d pour appliquer réellement le nettoyage.\n"
else
    echo -e "\n${GREEN}✅ Nettoyage terminé avec succès!${NC}"
    echo -e "   Les fichiers sont dans: ${GREEN}$TRASH_DIR/${NC}"
    echo -e "   Vous pouvez les supprimer après vérification.\n"
fi

# Ajouter au log
{
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "RÉSUMÉ: $MOVED_COUNT fichier(s) traité(s), ${SIZE_MB} MB"
    echo "Destination: $TRASH_DIR/"
    if [ "$DRY_RUN" = true ]; then
        echo "Mode DRY-RUN - Aucun fichier réellement déplacé"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
} >> "$LOG_FILE"

exit 0
