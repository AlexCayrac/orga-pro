# 🧹 Script de Nettoyage Non-Destructif

## 📋 Vue d'ensemble

Ce script déplace automatiquement les fichiers orphelins vers un dossier `_trash_review/` sans les supprimer définitivement.

**Avantages:**
- ✅ Non-destructif (tout reste récupérable)
- ✅ Conserve l'arborescence des dossiers
- ✅ Génère un log complet de chaque opération
- ✅ Mode dry-run pour vérification avant application
- ✅ Libère ~50-60 MB

---

## 🚀 Utilisation

### Option 1 : Aperçu (Dry-Run)
Voir ce qui serait nettoyé **sans rien déplacer** :

```powershell
.\cleanup.ps1 -DryRun -Verbose
```

### Option 2 : Exécution réelle
Déplacer réellement les fichiers vers `_trash_review/` :

```powershell
.\cleanup.ps1
```

### Option 3 : Verbose
Afficher tous les détails pendant l'exécution :

```powershell
.\cleanup.ps1 -Verbose
```

---

## 📂 Structure des fichiers déplacés

Le script crée une arborescence identique dans `_trash_review/` :

```
_trash_review/
├── src/
│   ├── components/
│   │   ├── Dialogs/
│   │   │   ├── ExportPreview2.jsx
│   │   │   ├── ExportPreview_MINIMAL.jsx
│   │   │   └── ContactsPanel.patch.txt
│   ├── Layout/
│   └── ...
├── test_layout.js
├── test_compile.js
├── remove_line.py
├── check_line.py
├── *.log (tous les fichiers logs)
├── *_output.txt (fichiers de build output)
├── contacts_current.json ⚠️
├── orgcharts_current.json ⚠️
├── *(documentation de debugging)
└── cleanup_YYYY-MM-DD_HH-MM-SS.log (log de cette opération)
```

---

## 📝 Catégories de fichiers nettoyées

### 1️⃣ Composants JSX orphelins
- `ExportPreview2.jsx` - Ancienne version
- `ExportPreview_MINIMAL.jsx` - Version expérimentale

### 2️⃣ Scripts de test non exécutés
- `test_layout.js` - Test manuel
- `test_compile.js` - Vérification de syntaxe
- `test_simple_layout.js` - Test local
- `test_layout_deep.js` - Test local approfondi

### 3️⃣ Fichiers de patch/sauvegarde
- `tmp_patch_backup.txt` - Backup manuel
- `ContactsPanel.patch.txt` - Notes de patch

### 4️⃣ Scripts de maintenance ponctuels
- `remove_line.py` - Script Python one-shot
- `check_line.py` - Vérification de ligne
- `fix_focus.ps1` - Correction de focus
- `replace_focus.ps1` - Remplacement de contenu

### 5️⃣ Fichiers logs
```
build.log
debug_start.log
dev.log
full_debug.log
full_start.log
npm_install.log
start_error.log
```

### 6️⃣ Fichiers de sortie de build
- `build_output.txt`
- `build-output.txt`
- `build_output_test.txt`

### 7️⃣ Snapshots de données JSON ⚠️
- `contacts_current.json` - **À VÉRIFIER avant suppression**
- `orgcharts_current.json` - **À VÉRIFIER avant suppression**

### 8️⃣ Documentation de debugging
Notes de session et rapports de debugging :
```
CONTACTS_DEBUG_FIX.md
EXPORT_DEBUG.md
README_FIX.md
ID_REMAPPING_TEST_PLAN.md
QUICK_TEST.md
SESSION_SUMMARY.md
SOLUTION_SUMMARY.md
FIX_COMPLETE.md
PIXEL_PERFECT_QA.md
IMPLEMENTATION_SUMMARY.md
LAYOUT_FIXES_SUMMARY.md
TESTER_APERCU.md
FILES_CREATED.md
READING_INDEX.md
```

---

## 🔍 Logs d'exécution

Chaque exécution génère un log détaillé : `_trash_review/cleanup_YYYY-MM-DD_HH-MM-SS.log`

Exemple :
```
[08:15:42] [Success] Répertoire préservation créé: _trash_review/
[08:15:42] [Success] Déplacé: test_layout.js → _trash_review/test_layout.js
[08:15:42] [Success] Déplacé: build.log → _trash_review/build.log
[08:15:43] [Success] RÉSUMÉ: 47 fichier(s) traité(s), 52.34 MB
```

---

## ⚠️ Attention

### Fichiers sensibles à VÉRIFIER avant suppression :
- **contacts_current.json** - Snapshot de données (vérifier si données personnalisées)
- **orgcharts_current.json** - Snapshot de données (vérifier si données personnalisées)

**Ces fichiers ne sont PAS chargés par l'application**, mais c'est une bonne pratique de les vérifier avant suppression définitive.

### Comment vérifier ?
```powershell
# Lire le contenu
Get-Content "_trash_review/contacts_current.json" | Measure-Object -Line, -Word, -Character

# Ou ouvrir directement
Invoke-Item "_trash_review/contacts_current.json"
```

---

## 🔄 Workflow complet

### Étape 1 : Prévisualiser
```powershell
cd 'c:\Users\acayr\Desktop\DEV\Orga PRO\orga-pro'
.\cleanup.ps1 -DryRun -Verbose
```

### Étape 2 : Exécuter le nettoyage
```powershell
.\cleanup.ps1
```

### Étape 3 : Vérifier
```powershell
# Ouvrir le dossier _trash_review/
Invoke-Item "_trash_review"

# Ou consulter le log
Get-Content "_trash_review/cleanup_*.log" | Select-Object -Last 50
```

### Étape 4 : Supprimer définitivement (optionnel)
Quand vous êtes sûr que tout va bien :
```powershell
Remove-Item "_trash_review" -Recurse -Force
```

---

## 📊 Statistiques

| Métrique | Valeur |
|----------|--------|
| Fichiers traités | ~55 fichiers |
| Logs nettoyés | 7 fichiers |
| Documentation temporaire | 14 fichiers |
| Scripts orphelins | 8 fichiers |
| Taille libérée | ~50-60 MB |
| Risque technique | **ZÉRO** |

---

## ✅ Après le nettoyage

Pour que git ignore le dossier _trash_review/ :

```powershell
echo "_trash_review/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore temporary cleanup folder"
```

---

## 🆘 Troubleshooting

### "Access Denied" sur un fichier
Certains fichiers logs peuvent être verrouillés. Solutions :
```powershell
# Fermer les applications qui utilisent les fichiers
# Puis réexécuter le script

# Ou forcer le déplacement
.\cleanup.ps1 -Force
```

### Restaurer les fichiers
Tous les fichiers sont dans `_trash_review/` - Déplacez-les manuellement si besoin:
```powershell
# Récupérer un fichier
Move-Item "_trash_review/test_layout.js" ".test_layout.js"
```

---

## 📞 Notes techniques

- **Arborescence préservée** : Les sous-dossiers sont recréés
- **Logs non supprimés** : Chaque exécution génère un nouveau log
- **Sûr pour git** : Aucune modification du code source
- **Réversible** : Tout reste dans `_trash_review/`

---

**Version 1.0** | 2026-03-02
