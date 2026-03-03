const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;
let exportWindow = null;
let exportData = null; // Stocke les données à exporter
let differencesData = null; // Stocke les différences pour la fenêtre dédiée
let differencesWindow = null;

// Désactive l'accélération matérielle pour éviter les crashs GPU sur certains
// environnements Windows/VM. Doit être appelé avant la création de la fenêtre.
try {
  app.disableHardwareAcceleration();
} catch (e) {
  // Ignore si non disponible
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  const port = process.env.PORT || 3001;
  // ✅ Charger depuis le serveur de dev React au lieu du fichier statique
  const forceProduction = false;
  const startUrl = (isDev && !forceProduction)
    ? `http://localhost:${port}`
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Maximiser la fenêtre au démarrage
  mainWindow.maximize();

  // � Intercepter F12 pour les DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 ouvre les DevTools
    if (input.key === 'f12') {
      console.log('[ELECTRON] 🔍 F12 détecté - Ouverture DevTools');
      mainWindow.webContents.toggleDevTools();
      return;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Retirer le menu complètement
  Menu.setApplicationMenu(null);
}

// Menu retiré - navigation via UI seulement

app.on('ready', () => {
  createWindow();
  // Menu retiré - navigation via UI seulement
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  // Envoyer le signal au renderer process pour sauvegarder une dernière fois
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('before-quit');
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Import DataStore pour la persistence
const DataStore = require('../src/modules/data/dataStore.js');
const ExcelImporter = require('../src/modules/data/excelImporter.js');

// Créer DataStore avec le chemin userData d'Electron
const userDataPath = path.join(app.getPath('userData'), 'data');
const dataStore = new DataStore(userDataPath);

console.log('DataStore storePath:', dataStore.storePath);
console.log('Contacts file:', dataStore.contactsFile);
console.log('Orgcharts file:', dataStore.orgchartsFile);

ipcMain.handle('open-file-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0]; // Retourne le chemin du premier fichier sélectionné
  } catch (error) {
    console.error('Erreur lors de l\'ouverture du dialog:', error);
    return null;
  }
});

ipcMain.handle('import-excel', async (event, filePath) => {
  try {
    console.log('[Electron] Import Excel:', filePath);
    process.stderr.write('\n[ELECTRON MAIN] 🚀 Import Excel débuté\n');
    const importedData = await ExcelImporter.importFile(filePath);
    console.log('[Electron] Données importées complètes:', {
      fileName: importedData.fileName,
      filePath: importedData.filePath,
      rowCount: importedData.rowCount,
      dataCount: importedData.data ? importedData.data.length : 0,
      firstItem: importedData.data?.[0]
    });
    process.stderr.write(`[ELECTRON MAIN] ✅ Import réussi: ${importedData.data?.length || 0} contacts\n`);
    console.log('[Electron] Retour complet:', importedData);
    
    // 🔑 CRITICAL: Restaurer le focus Electron au niveau du main process
    // ipcRenderer.invoke() fait perdre complètement le focus Electron/système
    // Technique NUCLÉAIRE pour forcer vraiment la restauration au OS level
    if (mainWindow && !mainWindow.isDestroyed()) {
      process.stderr.write('[ELECTRON MAIN] 🎯 RESTAURATION NUCLÉAIRE DU FOCUS AU NIVEAU OS\n');
      console.log('[Electron] 🎯 RESTAURATION NUCLÉAIRE DU FOCUS AU NIVEAU OS');
      
      // Étape 0: S'assurer que la fenêtre est "focusable"
      try {
        mainWindow.setFocusable(true);
        process.stderr.write('[ELECTRON MAIN] ✅ setFocusable(true) exécuté\n');
        console.log('[Electron] ✅ setFocusable(true) exécuté');
      } catch (err) {
        process.stderr.write('[ELECTRON MAIN] ⚠️ setFocusable() non disponible\n');
        console.log('[Electron] ⚠️ setFocusable() non disponible:', err.message);
      }
      
      // Étape 1: S'assurer que la fenêtre est visible et restaurée
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
        process.stderr.write('[ELECTRON MAIN] 📍 Fenêtre restaurée (minimisée)\n');
      }
      mainWindow.show();
      process.stderr.write('[ELECTRON MAIN] ✅ Fenêtre visible\n');
      console.log('[Electron] ✅ Fenêtre visible');
      
      // Étape 2: Ramener la fenêtre au premier plan (OS level)
      try {
        mainWindow.moveTop();
        process.stderr.write('[ELECTRON MAIN] ✅ moveTop() - Fenêtre au premier plan OS\n');
        console.log('[Electron] ✅ moveTop() - Fenêtre au premier plan OS');
      } catch (err) {
        process.stderr.write('[ELECTRON MAIN] ⚠️ moveTop() non disponible\n');
        console.log('[Electron] ⚠️ moveTop() non disponible');
      }
      
      // Étape 3: Focus immédiat (Electron + renderer)
      mainWindow.focus();
      mainWindow.webContents.focus();
      process.stderr.write('[ELECTRON MAIN] ✅ Focus principal restauré (Electron + renderer)\n');
      console.log('[Electron] ✅ Focus principal restauré (Electron + renderer)');
      
      // Étape 4: Refocus asynchrone à la prochaine itération d'événement
      setImmediate(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
          mainWindow.webContents.focus();
          process.stderr.write('[ELECTRON MAIN] ✅ Focus secondaire restauré (setImmediate)\n');
          console.log('[Electron] ✅ Focus secondaire restauré (setImmediate)');
        }
      });
      
      // Étape 5: Refocus supplémentaire après 20ms (plus court)
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
          mainWindow.webContents.focus();
          process.stderr.write('[ELECTRON MAIN] ✅ Focus tertiaire restauré (20ms)\n');
          console.log('[Electron] ✅ Focus tertiaire restauré (20ms)');
        }
      }, 20);
      
    }
    
    // ✅ Ne pas restaurer le focus immédiatement
    // Le renderer le demandera via callback après que le LoadingOverlay soit retiré
    // Cela évite les problèmes de timing avec Windows
    console.log('[Electron] ✅ Handler import-excel retourné - Le renderer demandera le focus');
    
    return importedData;
  } catch (error) {
    console.error('[Electron] Erreur lors de l\'import Excel:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-orgchart', async (event, orgchartName, options) => {
  try {
    console.log('[ELECTRON] 📤 export-orgchart - Réception options:', {
      orgchartName,
      format: options.format,
      orientation: options.orientation,
      positioning: options.positioning,
      fileName: options.fileName,
      canvasDataUrlLength: options.canvasDataUrl ? options.canvasDataUrl.length : 0
    });

    const fs = require('fs').promises;
    const path = require('path');
    
    // Utiliser le dossier personnalisé ou le dossier Téléchargements par défaut
    const downloadsPath = app.getPath('downloads');
    const exportDir = options.exportFolder 
      ? options.exportFolder 
      : path.join(downloadsPath, 'Orga PRO Exports');

    // Créer le dossier d'export s'il n'existe pas
    try {
      await fs.mkdir(exportDir, { recursive: true });
    } catch (err) {
      console.warn('[ELECTRON] ⚠️ Impossible de créer le dossier exports:', err);
    }

    const { format, fileName, canvasDataUrl } = options;

    // Déterminer l'extension
    let fileExtension = format.toLowerCase();
    if (fileExtension === 'jpeg') fileExtension = 'jpg';

    const filePath = path.join(exportDir, `${fileName}.${fileExtension}`);
    console.log('[ELECTRON] 📤 Fichier de sortie:', filePath);

    // Si c'est un PNG ou JPEG, simplement sauvegarder le dataUrl
    if (format === 'PNG' || format === 'JPEG') {
      // Convertir le dataUrl en buffer
      const base64Data = canvasDataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
      let imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Appliquer le positionnement en cropping l'image si nécessaire
      if (options.positioning && options.positioning !== 'center') {
        try {
          const sharp = require('sharp');
          const image = sharp(imageBuffer);
          const metadata = await image.metadata();
          const { width, height } = metadata;
          
          let cropWidth, cropLeft;
          if (options.positioning === 'left') {
            cropWidth = Math.floor(width * 0.66);
            cropLeft = 0;
          } else if (options.positioning === 'right') {
            cropWidth = Math.floor(width * 0.66);
            cropLeft = width - cropWidth;
          } else {
            cropWidth = width;
            cropLeft = 0;
          }
          
          if (cropWidth > 0) {
            imageBuffer = await sharp(imageBuffer)
              .extract({ left: cropLeft, top: 0, width: cropWidth, height })
              .toBuffer();
            console.log('[ELECTRON] ✂️ Image croppée selon positionnement:', options.positioning);
          }
        } catch (err) {
          console.warn('[ELECTRON] ⚠️ Cropping échoué:', err);
        }
      }
      
      // Pour JPEG, convertir depuis PNG si nécessaire
      if (format === 'JPEG') {
        try {
          const sharp = require('sharp');
          await sharp(imageBuffer)
            .jpeg({ quality: 98, progressive: true })
            .toFile(filePath);
          console.log('[ELECTRON] ✅ JPEG généré (haute qualité):', filePath);
        } catch (err) {
          console.warn('[ELECTRON] ⚠️ Sharp non disponible, sauvegarde du PNG:', err);
          // Fallback: sauvegarder en PNG
          await fs.writeFile(filePath, imageBuffer);
        }
      } else {
        // Sauvegarder directement le PNG avec compression optimale
        try {
          const sharp = require('sharp');
          await sharp(imageBuffer)
            .png({ quality: 95, compressionLevel: 9 })
            .toFile(filePath);
          console.log('[ELECTRON] ✅ PNG sauvegardé (haute qualité):', filePath);
        } catch (err) {
          // Fallback: sauvegarder directement
          await fs.writeFile(filePath, imageBuffer);
          console.log('[ELECTRON] ✅ PNG sauvegardé (fallback):', filePath);
        }
      }
    } else if (format === 'PDF') {
      try {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
          size: options.orientation === 'portrait' ? 'A4' : [options.orientation === 'landscape' ? 297 : 210, options.orientation === 'portrait' ? 210 : 297],
          margin: 10
        });

        const stream = require('fs').createWriteStream(filePath);
        doc.pipe(stream);

        // Convertir dataUrl en buffer
        const base64Data = canvasDataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Ajouter l'image au PDF
        doc.image(imageBuffer, {
          fit: [doc.page.width - 20, doc.page.height - 20],
          align: 'center',
          valign: 'center'
        });

        doc.end();

        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });

        console.log('[ELECTRON] ✅ PDF généré:', filePath);
      } catch (err) {
        console.error('[ELECTRON] ❌ Erreur génération PDF:', err);
        throw new Error('Impossible de générer le PDF: ' + err.message);
      }
    } else if (format === 'SVG') {
      // Pour SVG, nous devons recréer à partir du canvas
      // Pour maintenant, le sauvegarder comme image puis convertir
      const base64Data = canvasDataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Créer un SVG avec l'image intégrée en base64
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 700">
  <image xlink:href="${canvasDataUrl}" width="1200" height="700"/>
</svg>`;

      await fs.writeFile(filePath, svgContent);
      console.log('[ELECTRON] ✅ SVG généré:', filePath);
    }

    return {
      success: true,
      filePath: filePath
    };
  } catch (error) {
    console.error('[ELECTRON] ❌ Erreur export:', error);
    return {
      success: false,
      error: error.message
    };
  }
});


ipcMain.handle('get-projects', async () => {
  try {
    const projects = await dataStore.loadProjects();
    console.log('Projets chargés:', projects.length);
    return projects;
  } catch (error) {
    console.error('Erreur lors du chargement des projets:', error);
    return [];
  }
});

ipcMain.handle('load-saved-data', async () => {
  try {
    const loadedContacts = await dataStore.loadContacts();
    const loadedOrgcharts = await dataStore.loadOrgcharts();
    console.log('Données chargées:', { contacts: loadedContacts.length, orgcharts: loadedOrgcharts.length });
    return { loadedContacts, loadedOrgcharts };
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    return { loadedContacts: [], loadedOrgcharts: [] };
  }
});

ipcMain.handle('save-data', async (event, contacts, orgcharts) => {
  try {
    await dataStore.saveContacts(contacts);
    await dataStore.saveOrgcharts(orgcharts);
    console.log('Données sauvegardées:', { contacts: contacts.length, orgcharts: orgcharts.length });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données:', error);
    return { success: false, error: error.message };
  }
});

// Sauvegarder l'état de l'application (contacts, orgcharts, dossiers, sélections)
ipcMain.handle('save-app-state', async (event, state) => {
  try {
    // Validation: s'assurer que l'état contient les propriétés attendues
    if (!state || typeof state !== 'object') {
      throw new Error('État invalide: doit être un objet');
    }
    
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const orgcharts = Array.isArray(state.orgcharts) ? state.orgcharts : [];
    
    // ⚠️ PROTECTION: Ne pas écraser avec un état vide (surtout au deuxième refresh)
    const hasValidOrgcharts = orgcharts.length > 0;
    const hasFoldersOrDisplayFields = 
      Object.keys(state.orgchartFolders || {}).length > 0 ||
      Object.keys(state.displayFieldsByOrgChart || {}).length > 0;
    
    // ⚠️ PROTECTION: Ne pas écraser avec un état vide (surtout au deuxième refresh)
    // On a des données si: contacts OU orgcharts OU dossiers/champs affichage
    const hasSignificantData = 
      contacts.length > 0 || 
      orgcharts.length > 0 || 
      hasFoldersOrDisplayFields;
    
    console.log('[ELECTRON] 📝 save-app-state reçu:', {
      contacts: contacts.length,
      orgcharts: orgcharts.length,
      hasValidOrgcharts,
      hasFoldersOrDisplayFields,
      hasSignificantData,
      contactFolders: Object.keys(state.contactFolders || {}).length,
      orgchartFolders: Object.keys(state.orgchartFolders || {}).length,
      displayFieldsByOrgChart: Object.keys(state.displayFieldsByOrgChart || {}).length,
    });
    
    // Si aucune donnée significative → Probablement un appel vide au refresh
    // Ne pas écraser la sauvegarde précédente
    if (!hasSignificantData) {
      console.log('[ELECTRON] ⚠️ État vide détecté, conservation de l\'ancienne sauvegarde');
      return { success: true };
    }
    
    // Sauvegarder contacts et orgcharts
    await dataStore.saveContacts(contacts);
    await dataStore.saveOrgcharts(orgcharts);
    
    // Sauvegarder les dossiers et l'état UI dans un fichier JSON
    const fs = require('fs').promises;
    const appStateFile = path.join(app.getPath('userData'), 'app-state.json');
    
    const appState = {
      contactFolders: state.contactFolders,
      orgchartFolders: state.orgchartFolders,
      displayFieldsByOrgChart: state.displayFieldsByOrgChart,
      selectedOrgChartId: state.selectedOrgChartId,
      expandedFolders: state.expandedFolders,
      expandedSections: state.expandedSections,
      excelPath: state.excelPath,
      excelVersion: state.excelVersion,
      timestamp: Date.now()
    };
    
    console.log('[ELECTRON] 💾 Sauvegarde appState:', {
      orgchartFolders: appState.orgchartFolders,
      displayFieldsByOrgChart: appState.displayFieldsByOrgChart
    });
    
    await fs.writeFile(appStateFile, JSON.stringify(appState, null, 2));
    console.log('État de l\'application sauvegardé');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'état:', error);
    return { success: false, error: error.message };
  }
});

// Restaurer l'état de l'application
ipcMain.handle('restore-app-state', async () => {
  try {
    const fs = require('fs').promises;
    const appStateFile = path.join(app.getPath('userData'), 'app-state.json');
    
    let appState = null;
    try {
      const data = await fs.readFile(appStateFile, 'utf-8');
      appState = JSON.parse(data);
      console.log('[ELECTRON] 📂 Restauration appState:', {
        hasOrgchartFolders: !!appState.orgchartFolders,
        orgchartFolders: appState.orgchartFolders,
        hasDisplayFields: !!appState.displayFieldsByOrgChart,
        displayFieldsByOrgChart: appState.displayFieldsByOrgChart
      });
    } catch (err) {
      // Le fichier n'existe pas ou n'est pas valide, c'est normal à la première utilisation
      console.log('Pas d\'état sauvegardé précédemment');
      return { success: false, data: null };
    }
    
    console.log('État de l\'application restauré');
    return { success: true, data: appState };
  } catch (error) {
    console.error('Erreur lors de la restauration de l\'état:', error);
    return { success: false, data: null };
  }
});

ipcMain.handle('clear-user-data', async () => {
  try {
    const fs = require('fs').promises;
    const userDataPath = app.getPath('userData');
    
    // Fonction récursive pour supprimer un répertoire
    const removeDir = async (dirPath) => {
      try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = await fs.stat(filePath);
          if (stat.isDirectory()) {
            await removeDir(filePath);
          } else {
            await fs.unlink(filePath);
          }
        }
        await fs.rmdir(dirPath);
      } catch (err) {
        console.warn(`[clear-user-data] Erreur suppression ${dirPath}:`, err);
      }
    };
    
    // 1️⃣ Supprimer tous les fichiers JSON à la racine de userData
    const rootFiles = ['app-state.json', 'data.json', 'contacts.json', 'orgcharts.json'];
    for (const file of rootFiles) {
      const filePath = path.join(userDataPath, file);
      try {
        await fs.unlink(filePath);
        console.log(`[clear-user-data] ✓ Supprimé: ${file}`);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.warn(`[clear-user-data] ⚠️ Erreur suppression ${file}:`, err);
        }
      }
    }
    
    // 2️⃣ Supprimer le répertoire entier /data/ de manière récursive
    const dataDir = path.join(userDataPath, 'data');
    try {
      const stat = await fs.stat(dataDir);
      if (stat.isDirectory()) {
        await removeDir(dataDir);
        console.log('[clear-user-data] ✓ Répertoire /data/ supprimé complètement');
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('[clear-user-data] ℹ️ Répertoire /data/ n\'existe pas (normal)');
      } else {
        console.warn('[clear-user-data] ⚠️ Erreur suppression /data/:', err);
      }
    }
    
    console.log('[clear-user-data] ✅ Nettoyage complet effectué');
    return { success: true, message: 'Données supprimées complètement' };
  } catch (error) {
    console.error('[clear-user-data] ❌ ERREUR:', error);
    return { success: false, message: error.message };
  }
});
// 🔑 NEW: Handler pour restaurer le focus Electron après l'import
ipcMain.handle('focus-window', async () => {
  try {
    if (mainWindow) {
      console.log('[Electron] 🎯 Restauration du focus à la fenêtre');
      
      // 1️⃣ Minimiser et restaurer - technique efficace pour réveiller Electron
      // mainWindow.minimize();
      // mainWindow.restore();
      
      // 2️⃣ Appel direct au focus
      mainWindow.focus();
      mainWindow.webContents.focus();
      
      console.log('[Electron] ✅ Focus restauré');
      return { success: true };
    } else {
      console.warn('[Electron] ⚠️ Pas de mainWindow');
      return { success: false };
    }
  } catch (error) {
    console.error('[Electron] ❌ Erreur focus:', error);
    return { success: false, error: error.message };
  }
});

// 🔑 NEW: Handler simple fire-and-forget pour restaurer le focus
// Utilise ipcMain.on() au lieu de .handle() pour être asynchrone sans bloquer
ipcMain.on('request-focus', () => {
  try {
    process.stderr.write('[ELECTRON MAIN] 🎯 request-focus reçu - Application IMMÉDIATE du focus\n');
    
    // ⚡ APPLIQUER LE FOCUS IMMÉDIATEMENT sans attendre
    // Les délais long causent des pertes de focus
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Electron] 🎯 request-focus - Restauration du focus MAINTENANT');
      process.stderr.write('[ELECTRON MAIN] 🎯 Restauration du focus MAINTENANT\n');
      
      try {
        mainWindow.setFocusable(true);
      } catch (err) {
        console.log('[Electron] ⚠️ setFocusable() non disponible');
      }
      
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      
      try {
        mainWindow.moveTop();
        console.log('[Electron] ✅ moveTop() exécuté');
        process.stderr.write('[ELECTRON MAIN] ✅ moveTop() exécuté\n');
      } catch (err) {
        console.log('[Electron] ⚠️ moveTop() non disponible');
      }
      
      mainWindow.focus();
      mainWindow.webContents.focus();
      console.log('[Electron] ✅ request-focus - Focus restauré (IMMÉDIAT)');
      process.stderr.write('[ELECTRON MAIN] ✅ Focus restauré (IMMÉDIAT)\n');
      
      // Refocus supplémentaire asynchrone
      setImmediate(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
          mainWindow.webContents.focus();
          process.stderr.write('[ELECTRON MAIN] ✅ Focus restauré (setImmediate)\n');
        }
      });
    }
  } catch (error) {
    console.error('[Electron] ❌ request-focus - Erreur:', error);
    process.stderr.write(`[ELECTRON MAIN] ❌ request-focus - Erreur: ${error.message}\n`);
  }
});

// 💾 Handler pour sauvegarder AVANT reload - Attend la promesse du renderer
ipcMain.handle('save-before-reload', async (event) => {
  console.log('[ELECTRON] 💾 save-before-reload appelé - Attente de la sauvegarde...');
  // Le renderer retournera une promesse
  // On va attendre que elle se termine avant de continuer
  return new Promise((resolve) => {
    mainWindow.webContents.send('request-save-before-reload');
    // Attendre confirmation
    const timeout = setTimeout(() => {
      console.log('[ELECTRON] ⏳ Timeout sauvegarde (3s) - Procédure au reload');
      resolve(true);
    }, 3000);
    
    // Écouter la confirmation
    ipcMain.once('save-before-reload-complete', () => {
      clearTimeout(timeout);
      console.log('[ELECTRON] ✅ Sauvegarde confirmée - Procédure au reload');
      resolve(true);
    });
  });
});

// 📤 Fonction pour créer la fenêtre d'export
function createExportWindow(svgContent, orgChartName) {
  if (exportWindow) {
    exportWindow.focus();
    return;
  }

  // Obtenir les dimensions et position de la fenêtre principale
  const mainBounds = mainWindow.getBounds();
  const centerX = mainBounds.x + (mainBounds.width - 800) / 2;
  const centerY = mainBounds.y + (mainBounds.height - 500) / 2;

  exportWindow = new BrowserWindow({
    width: 800,
    height: 500,
    x: Math.round(centerX),
    y: Math.round(centerY),
    modal: false,
    parent: mainWindow,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  // Les données SVG sont déjà stockées dans exportData par le handler open-export-window
  console.log('[ELECTRON] 📤 createExportWindow - exportData exists:', !!exportData);

  const exportUrl = (isDev)
    ? 'http://localhost:3001/export-window.html'
    : `file://${path.join(__dirname, '../build/export-window.html')}`;

  console.log('[ELECTRON] 📤 Chargement fenêtre export:', exportUrl);
  exportWindow.loadURL(exportUrl);

  exportWindow.once('ready-to-show', () => {
    console.log('[ELECTRON] 📤 Affichage fenêtre export');
    exportWindow.show();
  });

  exportWindow.on('closed', () => {
    exportWindow = null;
    exportData = null;
  });
}

// 📤 Handler pour ouvrir la fenêtre d'export
ipcMain.handle('open-export-window', async (event, svgContent, orgChartName) => {
  console.log('[ELECTRON] 📤 Ouverture fenêtre export:', orgChartName);
  console.log('[ELECTRON] 📤 SVG content length:', svgContent ? svgContent.length : 'null');
  
  // Stocker les données AVANT de créer la fenêtre
  exportData = { svgContent, orgChartName };
  console.log('[ELECTRON] 📤 exportData stocké, length:', exportData.svgContent.length);
  
  createExportWindow(svgContent, orgChartName);
  return { success: true };
});

// Dimensions des papiers en mm
const paperSizes = {
  A6: { width: 105, height: 148 },
  A5: { width: 148, height: 210 },
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
  Letter: { width: 215.9, height: 279.4 },
  Tabloid: { width: 279.4, height: 431.8 }
};

// 📤 Handler pour confirmer et exécuter l'export
ipcMain.handle('confirm-export', async (event, options) => {
  try {
    if (!exportData || !exportData.svgContent) {
      console.error('[ELECTRON] ❌ Pas de SVG à exporter');
      return { error: 'Aucune donnée à exporter' };
    }

    console.log('[ELECTRON] 📤 Début export - SVG length:', exportData.svgContent.length);
    
    const fs = require('fs').promises;
    const downloadsPath = app.getPath('downloads');
    let exportDir = options.folder || path.join(downloadsPath, 'Orga PRO Exports');
    
    try {
      await fs.mkdir(exportDir, { recursive: true });
    } catch (err) {
      console.warn('[ELECTRON] ⚠️ Impossible de créer le dossier exports:', err);
    }

    const {
      format,
      orientation,
      alignment = 'center',
      paperSize,
      paperDimensions
    } = options;

    const fileName = `${exportData.orgChartName}_${new Date().toISOString().slice(0, 10)}`;
    let filePath;
    let fileContent;

    console.log('[ELECTRON] 📤 Export avec options:', { format, orientation, alignment, paperSize });

    // Fonction pour appliquer le centrage/alignement au SVG
    // Cette fonction enveloppe le contenu SVG dans un groupe transformé
    function centerAndAlignSvg(svgContent, alignment, svgWidth, paperWidth) {
      console.log('[ELECTRON] 🔍 centerAndAlignSvg appelé avec:', { alignment, svgWidth, paperWidth, contentLength: svgContent.length });
      
      try {
        // Calculer le décalage horizontal basé sur l'alignement
        let offsetX = 0;
        
        if (alignment === 'center') {
          // Centrer le SVG sur la largeur de la page
          offsetX = (paperWidth - svgWidth) / 2;
        } else if (alignment === 'left') {
          // Aligner à gauche (pas de décalage)
          offsetX = 0;
        } else if (alignment === 'right') {
          // Aligner à droite
          offsetX = paperWidth - svgWidth;
        }

        console.log('[ELECTRON] 📍 Alignement appliqué:', { alignment, offsetX, svgWidth, paperWidth });

        // Vérifier si c'est déjà enveloppé dans un groupe
        if (svgContent.includes('<g transform="translate(')) {
          console.log('[ELECTRON] ℹ️ SVG déjà transformé, pas de modification');
          return svgContent;
        }

        // Chercher la fin du tag SVG d'ouverture
        const svgOpenTagEnd = svgContent.indexOf('>');
        if (svgOpenTagEnd === -1) {
          console.warn('[ELECTRON] ⚠️ Impossible de trouver le tag SVG');
          return svgContent;
        }

        // Chercher la balise de fermeture SVG
        const svgCloseTag = '</svg>';
        const svgCloseIndex = svgContent.lastIndexOf(svgCloseTag);
        
        if (svgCloseIndex === -1) {
          console.warn('[ELECTRON] ⚠️ Impossible de trouver la balise de fermeture SVG');
          return svgContent;
        }

        const svgStart = svgContent.substring(0, svgOpenTagEnd + 1);
        const svgBody = svgContent.substring(svgOpenTagEnd + 1, svgCloseIndex);
        const svgEnd = svgContent.substring(svgCloseIndex);

        // Envelopper le contenu dans un groupe avec transformation et le fermer correctement
        const newSvg = `${svgStart}<g transform="translate(${offsetX}, 0)">${svgBody}</g>${svgEnd}`;
        
        console.log('[ELECTRON] ✅ SVG enveloppé et centré avec offset:', offsetX);
        return newSvg;
      } catch (err) {
        console.warn('[ELECTRON] ⚠️ Erreur alignement SVG:', err.message);
        return svgContent;
      }
    }

    // Préparer le SVG avec le centrage/alignement
    let svgContentToExport = exportData.svgContent;
    
    // Extraire la largeur du SVG depuis le contenu (en pixels SVG)
    const svgWidthMatch = exportData.svgContent.match(/width=["']([^"']+)/);
    const svgWidth = svgWidthMatch ? parseFloat(svgWidthMatch[1]) : 800;
    
    // Calculer la largeur de papier en pixels (1mm ≈ 3.779528 px at 96 DPI)
    const paperWidthMm = paperDimensions?.width || 210;
    const paperWidthPx = paperWidthMm * 3.779528;
    
    // Appliquer le centrage/alignement à TOUS les formats
    console.log('[ELECTRON] 📍 Application alignement/centrage:', { alignment, svgWidth, paperWidthMm, paperWidthPx });
    svgContentToExport = centerAndAlignSvg(svgContentToExport, alignment, svgWidth, paperWidthPx);

    switch (format.toUpperCase()) {
      case 'SVG':
        filePath = path.join(exportDir, `${fileName}.svg`);
        
        fileContent = svgContentToExport;
        await fs.writeFile(filePath, fileContent, 'utf-8');
        break;

      case 'PNG':
      case 'JPEG':
        filePath = path.join(exportDir, `${fileName}.${format.toLowerCase()}`);
        
        try {
          const sharp = require('sharp');
          const svgBuffer = Buffer.from(svgContentToExport);
          
          if (format.toUpperCase() === 'PNG') {
            await sharp(svgBuffer).png().toFile(filePath);
          } else {
            await sharp(svgBuffer).jpeg({ quality: 90 }).toFile(filePath);
          }
        } catch (sharpErr) {
          console.warn('[ELECTRON] ⚠️ Sharp non disponible, export en SVG');
          filePath = path.join(exportDir, `${fileName}.svg`);
          fileContent = exportData.svgContent;
          await fs.writeFile(filePath, fileContent, 'utf-8');
        }
        break;

      case 'PDF':
        filePath = path.join(exportDir, `${fileName}.pdf`);
        
        try {
          const PDFDocument = require('pdfkit');
          const SVGtoPDF = require('svg-to-pdfkit');
          const fs = require('fs');
          
          console.log('[ELECTRON] 📄 Export PDF avec orientation:', orientation, 'paperSize:', paperSize);
          
          // Calculer les dimensions correctes
          let pageSize;
          let pageWidth, pageHeight;
          
          if (paperSize === 'Custom' && paperDimensions) {
            // Convertir mm en points (1mm = 2.834645669 points)
            pageWidth = paperDimensions.width * 2.834645669;
            pageHeight = paperDimensions.height * 2.834645669;
            pageSize = [pageWidth, pageHeight];
            console.log('[ELECTRON] 📄 Custom size (mm):', paperDimensions, 'points:', pageSize);
          } else if (paperSize && paperSizes[paperSize]) {
            const dims = paperSizes[paperSize];
            pageWidth = dims.width * 2.834645669;
            pageHeight = dims.height * 2.834645669;
            pageSize = [pageWidth, pageHeight];
            console.log('[ELECTRON] 📄 Standard size', paperSize, '(mm):', dims, 'points:', pageSize);
          } else {
            pageSize = 'A4';
            pageWidth = 210 * 2.834645669;
            pageHeight = 297 * 2.834645669;
            console.log('[ELECTRON] 📄 Default A4 size');
          }
          
          // Appliquer l'orientation pour les tailles de tableau
          if (Array.isArray(pageSize)) {
            if (orientation === 'landscape') {
              // Toujours appliquer l'orientation paysage (inverser si nécessaire)
              if (pageWidth < pageHeight) {
                [pageSize[0], pageSize[1]] = [pageSize[1], pageSize[0]];
                [pageWidth, pageHeight] = [pageHeight, pageWidth];
              }
              console.log('[ELECTRON] 📄 Paysage appliqué, nouvelles dimensions:', pageSize);
            } else if (orientation === 'portrait') {
              // Pour portrait, s'assurer que height > width
              if (pageWidth > pageHeight) {
                [pageSize[0], pageSize[1]] = [pageSize[1], pageSize[0]];
                [pageWidth, pageHeight] = [pageHeight, pageWidth];
              }
              console.log('[ELECTRON] 📄 Portrait appliqué, nouvelles dimensions:', pageSize);
            }
          }
          
          const doc = new PDFDocument({
            size: pageSize,
            margin: 20,
            bufferPages: true
          });
          
          const stream = fs.createWriteStream(filePath);
          doc.pipe(stream);
          
          console.log('[ELECTRON] 📄 Ajout SVG au PDF avec dimensions:', pageWidth - 40, 'x', pageHeight - 40);
          
          // Ajouter le SVG au PDF avec les dimensions adaptées
          SVGtoPDF(doc, svgContentToExport, 20, 20, {
            width: pageWidth - 40,
            height: pageHeight - 40
          });
          
          doc.end();
          
          await new Promise((resolve, reject) => {
            stream.on('finish', () => {
              console.log('[ELECTRON] ✅ Stream PDF fermé');
              resolve();
            });
            stream.on('error', (err) => {
              console.error('[ELECTRON] ❌ Erreur stream PDF:', err);
              reject(err);
            });
          });
          
          console.log('[ELECTRON] ✅ Export PDF réussi:', filePath);
        } catch (pdfErr) {
          console.warn('[ELECTRON] ⚠️ PDF libs non disponibles:', pdfErr.message);
          console.warn('[ELECTRON] ⚠️ Export en SVG à la place');
          filePath = path.join(exportDir, `${fileName}.svg`);
          fileContent = exportData.svgContent;
          await fs.writeFile(filePath, fileContent, 'utf-8');
        }
        break;

      default:
        return { error: `Format non supporté: ${format}` };
    }

    console.log('[ELECTRON] ✅ Export réussi:', filePath);
    return {
      success: true,
      filePath,
      message: `Fichier sauvegardé dans:\n${filePath}`
    };
  } catch (error) {
    console.error('[ELECTRON] ❌ Erreur export:', error);
    return {
      error: error.message
    };
  }
});

// 📤 Handler pour fermer la fenêtre d'export
ipcMain.handle('close-export-window', () => {
  if (exportWindow) {
    exportWindow.close();
    exportWindow = null;
    exportData = null;
  }
  return { success: true };
});

// 📤 Handler pour récupérer les données SVG
ipcMain.handle('get-svg-data', (event) => {
  console.log('[ELECTRON] 📤 get-svg-data appelé');
  console.log('[ELECTRON] 📤 exportData exists:', !!exportData);
  console.log('[ELECTRON] 📤 exportData.svgContent exists:', exportData && !!exportData.svgContent);
  console.log('[ELECTRON] 📤 exportData.svgContent length:', exportData && exportData.svgContent ? exportData.svgContent.length : 0);
  
  if (exportData && exportData.svgContent) {
    console.log('[ELECTRON] ✅ Retournant SVG');
    return { svgContent: exportData.svgContent };
  }
  console.log('[ELECTRON] ❌ Pas de SVG disponible');
  return { error: 'SVG non disponible' };
});

// 📁 Handler pour sélectionner un dossier
ipcMain.handle('select-folder', async () => {
  try {
    const window = exportWindow || mainWindow;
    if (!window) {
      return { error: 'Aucune fenêtre disponible' };
    }

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      defaultPath: app.getPath('downloads')
    });

    return result;
  } catch (err) {
    console.error('[ELECTRON] ❌ Erreur sélection dossier:', err);
    return { error: err.message, filePaths: [] };
  }
});

// 🔑 NEW: Find photo for contact by name and matricule
ipcMain.handle('find-photo-for-contact', async (event, firstName, lastName, matricule) => {
  console.log(`[IPC-PHOTO] 📥 Appel reçu: firstName="${firstName}" lastName="${lastName}" matricule="${matricule}"`);
  
  try {
    const fs = require('fs');
    
    // ✅ CORRECT PATH: from public/electron.js, go to ../data/Photo_Organigramme
    const photoDir = path.join(__dirname, '..', 'data', 'Photo_Organigramme');
    
    console.log('[IPC-PHOTO] 📁 Chemin photo:', photoDir);
    console.log('[IPC-PHOTO] 📁 Chemin existe:', fs.existsSync(photoDir));

    if (!fs.existsSync(photoDir)) {
      console.log('[IPC-PHOTO] ❌ Dossier photo non trouvé:', photoDir);
      return null;
    }

    // Helper: Normaliser pour comparaison (accents + case-insensitive)
    const normalize = (str) => {
      if (!str) return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer diacritiques
        .toLowerCase();                   // Minuscules pour comparaison
    };

    const normFirst = normalize(firstName);
    const normLast = normalize(lastName);
    const mat = (matricule || '').toString().trim();

    console.log(`[IPC-PHOTO] 🔤 Normalisé pour recherche: first="${normFirst}" last="${normLast}" mat="${mat}"`);

    // Lire tous les fichiers du dossier
    const files = fs.readdirSync(photoDir);
    console.log(`[IPC-PHOTO] 📂 ${files.length} fichiers trouvés`);

    // Format attendu: NOM_Prénom_MATRICULE (ex: LE DOSSEUR_François_129358)
    for (const file of files) {
      const ext = path.extname(file);
      const baseName = path.basename(file, ext);

      // Parse le nom de fichier
      const parts = baseName.split('_');
      
      if (parts.length >= 3) {
        // Dernier élément = matricule
        const fileMatricule = parts[parts.length - 1];
        // Avant-dernier = prénom
        const fileFirstName = parts[parts.length - 2];
        // Le reste = nom (peut contenir des espaces)
        const fileLastName = parts.slice(0, parts.length - 2).join('_');

        // Normaliser pour comparaison
        const normFileFirst = normalize(fileFirstName);
        const normFileLast = normalize(fileLastName);

        console.log(`[IPC-PHOTO] 🔍 Fichier: "${file}"`);
        console.log(`[IPC-PHOTO]   Parsé: last="${fileLastName}" first="${fileFirstName}" mat="${fileMatricule}"`);
        console.log(`[IPC-PHOTO]   Normalisé: last="${normFileLast}" first="${normFileFirst}"`);

        // Vérifier correspondance (sans accents, case-insensitive)
        const matchLast = normFileLast === normLast || (normLast && fileLastName.toUpperCase().includes(normLast.toUpperCase()));
        const matchFirst = normFileFirst === normFirst;
        const matchMat = mat === '' || fileMatricule === mat; // Matcher matricule si fourni

        if (matchLast && matchFirst && matchMat) {
          console.log(`[IPC-PHOTO] ✅ FICHIER TROUVÉ: ${file}`);
          try {
            const buffer = fs.readFileSync(path.join(photoDir, file));
            const extLower = ext.toLowerCase();
            const mime = 
              extLower === '.png' ? 'image/png' :
              extLower === '.webp' ? 'image/webp' :
              extLower === '.gif' ? 'image/gif' :
              'image/jpeg';
            const dataUrl = `data:${mime};base64,` + buffer.toString('base64');
            console.log(`[IPC-PHOTO] ✅✅✅ PHOTO CHARGÉE (${dataUrl.length} bytes)`);
            return dataUrl;
          } catch (readErr) {
            console.error('[IPC-PHOTO] ❌ Erreur lecture fichier:', readErr.message);
            return null;
          }
        }
      }
    }

    console.log('[IPC-PHOTO] ❌ AUCUNE PHOTO TROUVÉE pour le contact');
    
    // 🔄 FALLBACK: Chercher photo "Personne" par défaut
    console.log('[IPC-PHOTO] 🔄 Recherche fallback: photo "Personne"');
    for (const file of files) {
      const baseName = path.basename(file, path.extname(file));
      
      // Chercher fichier commençant par "Personne" (case-insensitive)
      if (baseName.toLowerCase().startsWith('personne')) {
        console.log(`[IPC-PHOTO] ✅ PHOTO "PERSONNE" TROUVÉE: ${file}`);
        try {
          const ext = path.extname(file);
          const buffer = fs.readFileSync(path.join(photoDir, file));
          const extLower = ext.toLowerCase();
          const mime = 
            extLower === '.png' ? 'image/png' :
            extLower === '.webp' ? 'image/webp' :
            extLower === '.gif' ? 'image/gif' :
            'image/jpeg';
          const dataUrl = `data:${mime};base64,` + buffer.toString('base64');
          console.log(`[IPC-PHOTO] ✅✅✅ PHOTO PERSONNE CHARGÉE (${dataUrl.length} bytes)`);
          return dataUrl;
        } catch (readErr) {
          console.error('[IPC-PHOTO] ❌ Erreur lecture fichier Personne:', readErr.message);
        }
      }
    }

    console.log('[IPC-PHOTO] ❌ AUCUNE PHOTO TROUVÉE (ni contact, ni fallback Personne)');
    return null;
  } catch (err) {
    console.error('[IPC-PHOTO] ❌❌ ERREUR GLOBALE:', err.message);
    return null;
  }
});
/**
 * Handler pour charger le fichier Excel Organigramme_Entreprise.xlsx
 * Utilisé par la fonction de détection des changements
 */
ipcMain.handle('load-excel-file', async (event, filePath) => {
  console.log('[IPC-EXCEL] 📥 Appel reçu pour charger:', filePath);
  
  try {
    const XLSX = require('xlsx');
    const fs = require('fs');
    
    // Si c'est un chemin absolu (commence par C:\ ou /), l'utiliser directement
    // Sinon, le traiter comme relatif à l'app
    let fullPath;
    if (path.isAbsolute(filePath)) {
      // Chemin absolu — l'utiliser directement
      fullPath = filePath;
      console.log('[IPC-EXCEL] 📁 Chemin absolu utilisé:', fullPath);
    } else if (filePath.startsWith('/')) {
      // Chemin relatif avec / — préfixer par app path
      fullPath = path.join(app.getAppPath(), filePath.substring(1));
      console.log('[IPC-EXCEL] 📁 Chemin relatif (/) résolu:', fullPath);
    } else {
      // Chemin relatif normal
      fullPath = path.join(app.getAppPath(), filePath);
      console.log('[IPC-EXCEL] 📁 Chemin relatif résolu:', fullPath);
    }
    
    console.log('[IPC-EXCEL] 🔍 Vérification fichier:', fullPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error('[IPC-EXCEL] ❌ Fichier non trouvé:', fullPath);
      throw new Error(`Le fichier '${fullPath}' n'existe pas`);
    }
    
    // Charger le fichier Excel
    console.log('[IPC-EXCEL] 📖 Lecture du fichier Excel...');
    const workbook = XLSX.readFile(fullPath);
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      throw new Error('Aucune feuille trouvée dans le fichier Excel');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('[IPC-EXCEL] ✅ Fichier chargé:', data.length, 'lignes');
    return data;
    
  } catch (error) {
    console.error('[IPC-EXCEL] ❌ Erreur:', error.message);
    throw error;
  }
});

/**
 * Charger un fichier Excel ET calculer son hash SHA256
 */
ipcMain.handle('load-excel-file-with-hash', async (event, filePath) => {
  console.log('[IPC-EXCEL-HASH] 📥 Load with hash:', filePath);
  
  try {
    const XLSX = require('xlsx');
    const fs = require('fs');
    const crypto = require('crypto');
    
    // Résoudre le chemin (même logique que load-excel-file)
    let fullPath;
    if (path.isAbsolute(filePath)) {
      fullPath = filePath;
    } else if (filePath.startsWith('/')) {
      fullPath = path.join(app.getAppPath(), filePath.substring(1));
    } else {
      fullPath = path.join(app.getAppPath(), filePath);
    }
    
    console.log('[IPC-EXCEL-HASH] 🔍 File path:', fullPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier non trouvé: ${fullPath}`);
    }
    
    // Lire le contenu brut pour calculer le hash
    const fileContent = fs.readFileSync(fullPath);
    const hash = crypto
      .createHash('sha256')
      .update(fileContent)
      .digest('hex');
    
    console.log('[IPC-EXCEL-HASH] 🔐 Hash calculated:', hash.substring(0, 8) + '...');
    
    // Charger le fichier Excel
    const workbook = XLSX.readFile(fullPath);
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      throw new Error('Aucune feuille trouvée dans le fichier Excel');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('[IPC-EXCEL-HASH] ✅ Loaded:', data.length, 'rows, hash:', hash.substring(0, 8) + '...');
    
    return {
      data,
      filePath: fullPath,
      hash,
    };
    
  } catch (error) {
    console.error('[IPC-EXCEL-HASH] ❌ Error:', error.message);
    throw error;
  }
});

/**
 * Création et ouverture d'une fenêtre dédiée pour afficher les différences
 */
function createDifferencesWindow() {
  if (differencesWindow && !differencesWindow.isDestroyed()) {
    differencesWindow.focus();
    return;
  }

  differencesWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // Always load the local differences-window.html from the public folder so the
  // independent window works both in dev and packaged builds.
  const diffUrl = `file://${path.join(__dirname, 'differences-window.html')}`;
  differencesWindow.loadURL(diffUrl);

  differencesWindow.once('ready-to-show', () => {
    differencesWindow.show();
  });

  differencesWindow.on('closed', () => {
    differencesWindow = null;
    differencesData = null;
  });
}

// Handler pour ouvrir la fenêtre différences et stocker les données
ipcMain.handle('open-differences-window', async (event, diffs) => {
  console.log('[ELECTRON] 🔎 open-differences-window handler');
  differencesData = diffs || null;
  createDifferencesWindow();
  return { success: true };
});

// Handler pour que la fenêtre différences récupère ses données
ipcMain.handle('get-differences-data', async () => {
  return differencesData || null;
});

// Handler pour appliquer les différences depuis la fenêtre dédiée
ipcMain.handle('apply-differences', async (event, acceptedChanges) => {
  console.log('[ELECTRON] 🔎 apply-differences invoked, forwarding to main window');
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('differences-applied', acceptedChanges || []);
    }
    // Fermer la fenêtre différences si elle est ouverte
    if (differencesWindow && !differencesWindow.isDestroyed()) {
      differencesWindow.close();
    }
    differencesData = null;
    return { success: true };
  } catch (err) {
    console.error('[ELECTRON] ❌ apply-differences error:', err);
    return { error: err.message };
  }
});

// IPC: placement IA local pour organigramme
ipcMain.handle('placer-organigramme', async (event, nodes) => {
  try {
    const placer = require('../src/modules/iaPlacementOrganigramme.js');
    if (!placer || typeof placer.placerOrganigramme !== 'function') {
      // backward compatibility: exported named function may be `placerOrganigramme` or `placer`
      const fn = placer && (placer.placerOrganigramme || placer.placer || placer.placerOrganigram);
      if (typeof fn === 'function') return fn(nodes);
      return [];
    }
    return placer.placerOrganigramme(nodes);
  } catch (err) {
    console.error('[ELECTRON] placer-organigramme error:', err);
    return [];
  }
});

// Save diagnostics JSON on disk for offline inspection
ipcMain.handle('save-diagnostics', async (event, diagnostics) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const outDir = path.join(app.getPath('userData'), 'diagnostics');
    await fs.mkdir(outDir, { recursive: true });
    const filePath = path.join(outDir, `org-diagnostics-${Date.now()}.json`);
    await fs.writeFile(filePath, JSON.stringify(diagnostics, null, 2), 'utf-8');
    console.log('[ELECTRON] ✅ Diagnostics saved to', filePath);
    return { success: true, filePath };
  } catch (err) {
    console.error('[ELECTRON] ❌ Failed to save diagnostics', err);
    return { success: false, error: err.message };
  }
});