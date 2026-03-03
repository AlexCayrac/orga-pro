# 🔄 Chemins critiques du démarrage Electron - Visualisation

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    FLUX DE DÉMARRAGE ELECTRON - ORGA PRO                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝


┌──────────────────────────────────────────────────────────────────────────────┐
│ 1️⃣  INITIALISATION ELECTRON                                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  app.on('ready')
        ↓
  createWindow() ─────────────────────────────────────────────┐
        ↓                                                      │
  new BrowserWindow({                                         │
    preload: path.join(__dirname, 'preload.js')  ◀────────────┼─── ✅ REQUIS
    contextIsolation: true                                    │
  })                                                          │
        ↓                                                      │
  mainWindow.loadURL(startUrl) ──────────────────────────────┼──┐
                                                              │  ├─ voir schéma 2)
                                                              │  │
                                    ┌─────────────────────────┘  │
                                    │ (dev ou prod)              │
                                    ↓                            │
                          ✅ http://localhost:3001              │ 
                          ✅ file://build/index.html            │
                                                              ◀─┘

═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│ 2️⃣  CHARGEMENT DE LA FENÊTRE PRINCIPALE                                      │
└──────────────────────────────────────────────────────────────────────────────┘

  mainWindow.loadURL(startUrl)
        ↓
    ┌───────────────────────────────────────────┐
    │ 1) Charger le serveur React ou build/     │
    │    index.html                             │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ 2) Injecter preload.js en tant que        │
    │    bridge IPC                             │
    │    ✅ public/preload.js                   │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ 3) Exposer electronAPI au window global   │
    │    (importExcel, exportOrgchart, etc.)   │
    └───────────────────────────────────────────┘
        ↓
    ✅ App React démarrée - prête à utiliser

═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│ 3️⃣  IPC HANDLERS - Enregistrés au démarrage                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  À la lecture de public/electron.js:
  
  ┌─ ipcMain.handle('import-excel', ...) ✅ (dans electron.js)
  ├─ ipcMain.handle('export-orgchart', ...) ✅ 
  ├─ ipcMain.handle('open-export-window', ...) ✅
  ├─ ipcMain.handle('open-differences-window', ...) ✅
  ├─ ipcMain.handle('save-data', ...) ✅
  ├─ ipcMain.handle('load-saved-data', ...) ✅
  ├─ ipcMain.handle('focus-window', ...) ✅
  └─ ... (+15 autres handlers) ✅
  
  ❌ AUCUN handler ne charge les fichiers SAFE TO REMOVE

═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│ 4️⃣  FENÊTRES SECONDAIRES - Export & Differences                              │
└──────────────────────────────────────────────────────────────────────────────┘

  Utilisateur clique "Exporter"
        ↓
  ipcRenderer.invoke('open-export-window', svgContent, name)
        ↓
  ipcMain.handle('open-export-window', async () => {
    createExportWindow(svgContent, orgChartName)
  })
        ↓
  ┌─ if (isDev)
  │   loadURL('http://localhost:3001/export-window.html')  ✅
  └─ else
      loadURL('file://.../build/export-window.html')  ✅
        ↓
  window affichée

  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

  Même pattern pour differences-window:
  
  ipcRenderer.invoke('open-differences-window', diffs)
        ↓
  loadURL(`file://${path.join(__dirname, 'differences-window.html')}`)  ✅
        ↓
  window affichée

═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│ 5️⃣  FLUX DE DONNÉES - IPC ↔ Main Process                                     │
└──────────────────────────────────────────────────────────────────────────────┘

  Renderer Process                     Main Process
  (browser)                           (Node.js)
  
  window.electronAPI.importExcel()  ──⇒  ipcMain.handle('import-excel')
         ↓                                       ↓
  ipcRenderer.invoke()                ExcelImporter.importFile()
         ↓                                       ↓
  [promesse en attente]                  [charge fichier Excel]
                                               ↓
                                          [parse données]
                                               ↓
  ⇐── retourner les données                return importedData

  ❌ AUCUN fichier SAFE TO REMOVE n'intervient dans ce flux

═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│ 6️⃣  CHEMIN PHOTO - Lecture depuis le projet                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  ipcRenderer.invoke('find-photo-for-contact', firstName, lastName, matricule)
        ↓
  ipcMain.handle('find-photo-for-contact', async (event, ...) => {
    
    ✅ photoDir = path.join(__dirname, '..', 'data', 'Photo_Organigramme')
    
    ✅ fs.existsSync(photoDir)
    
    ✅ fs.readdirSync(photoDir)
    
    ❌ Aucun des fichiers SAFE TO REMOVE n'intervient ici
  })
        ↓
  return dataUrl (photo base64 ou null)

═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│ 7️⃣  PERSISTANCE - DataStore                                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  Contacts/Orgcharts sauvegardés:
  
  userDataPath = app.getPath('userData')  
                   ↓
              C:\Users\[user]\AppData\Roaming\Orga PRO\...
        
  ❌ Ne charge JAMAIS depuis le répertoire du projet
  ❌ contacts_current.json n'est jamais utilisé

═══════════════════════════════════════════════════════════════════════════════
```

## 🎯 Résumé visuel - Où les fichiers SAFE TO REMOVE s'insèrent

```
Chemin de démarrage Electron       Fichiers affectés
═══════════════════════════════════════════════════════════

✅ Création fenêtre                public/electron.js       ← REQUIS
    ↓                             public/preload.js        ← REQUIS
✅ Chargement React                build/index.html         ← REQUIS
    ↓                                  (ou localhost:3001)  ← REQUIS
✅ IPC handlers initialisés        electron.js (handlers)   ← REQUIS
    ↓                                  (zéro orphelins)     ← ✅ SAFE
✅ Fenêtres export/diff            export-window.html       ← REQUIS
    ↓                             differences-window.html   ← REQUIS
✅ DataStore persistance           app.getPath('userData')  ← ✅ SAFE
    ↓                             (pas du projet root)      ← ✅ SAFE
✅ Photo directory                 data/Photo_Organigramme  ← DONNÉES
    ↓
✅ App complètement fonctionnelle

════════════════════════════════════════════════════════════

FICHIERS SAFE TO REMOVE:           ❌ AUCUNE INTERSECTION
- build_output.txt                avec le chemin critique
- test_layout.js
- ExportPreview2.jsx
- contacts_current.json
- ... etc (14 fichiers)

════════════════════════════════════════════════════════════
```

## 📊 Tableau de dépendances

```
┌─────────────────────────────────────────────────────────────────┐
│ FICHIER                    │ DÉPEND DE...       │ ÉTAT ACTUEL    │
├─────────────────────────────────────────────────────────────────┤
│ electron.js                │ (aucun)            │ ✅ Indépendant  │
│ preload.js                 │ electron (IPC)     │ ✅ Dépend OK    │
│ package.json               │ (config)           │ ✅ Valide       │
│ public/index.html          │ build/.../app.js  │ ✅ React build  │
│ build/export-window.html   │ build/.../app.js  │ ✅ React build  │
│ build/differences-window   │ build/.../app.js  │ ✅ React build  │
│ data/Photo_Organigramme/   │ (données user)     │ ✅ En place     │
├─────────────────────────────────────────────────────────────────┤
│ src/components/...         │ (React imports)    │ ✅ Utilisés     │
│ src/modules/...            │ (require() interne)│ ✅ Utilisés     │
├─────────────────────────────────────────────────────────────────┤
│ build_output.txt           │ (aucun code)       │ ❌ ORPHELIN     │
│ ExportPreview2.jsx         │ ❌ RIEN            │ ❌ ORPHELIN     │
│ test_layout.js             │ (aucun code)       │ ❌ ORPHELIN     │
│ contacts_current.json      │ (aucun code)       │ ❌ ORPHELIN     │
│ CONTACTS_DEBUG_FIX.md      │ (aucun code)       │ ❌ ORPHELIN     │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Garantie de sécurité par vecteur

```
VECTEUR              STATUT       RAISON
═════════════════════════════════════════════════════════════════

Création fenêtre     ✅ SAFE      electron.js seul responsable
Navigation           ✅ SAFE      loadURL cherche build/ ou localhost
Menus                ✅ SAFE      aucun système de menu fichier-based
IPC handlers         ✅ SAFE      tous dans electron.js, zéro dépendance
Preload script       ✅ SAFE      isolé IPC, zéro opérations fichiers
Photo loading        ✅ SAFE      cherche data/, pas data snapshots
DataStore            ✅ SAFE      utilise userData, pas projet root
Package.json         ✅ SAFE      aucune référence aux orphelins
```

---

**Conclusion:** 🎯 Les 14 fichiers SAFE TO REMOVE n'intersectent JAMAIS aucun chemin critique du démarrage Electron.

**Suppression recommandée:** ✅ OUI - SANS RISQUE

---

*Diagramme généré: 2 Mars 2026*
