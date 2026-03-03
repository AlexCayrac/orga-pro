const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  importExcel: (filePath) => ipcRenderer.invoke('import-excel', filePath),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  exportOrgchart: (orgchartId, format) => ipcRenderer.invoke('export-orgchart', orgchartId, format),
  openExportWindow: (svgContent, orgChartName) => ipcRenderer.invoke('open-export-window', svgContent, orgChartName),
  exportOrgChart: (orgchartName, options) => ipcRenderer.invoke('export-orgchart', orgchartName, options),
  confirmExport: (options) => ipcRenderer.invoke('confirm-export', options),
  closeExportWindow: () => ipcRenderer.invoke('close-export-window'),
  getSvgData: () => ipcRenderer.invoke('get-svg-data'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  loadSavedData: () => ipcRenderer.invoke('load-saved-data'),
  saveData: (contacts, orgcharts) => ipcRenderer.invoke('save-data', contacts, orgcharts),
  saveAppState: (state) => ipcRenderer.invoke('save-app-state', state),
  restoreAppState: () => ipcRenderer.invoke('restore-app-state'),
  clearUserData: () => ipcRenderer.invoke('clear-user-data'),
  onBeforeQuit: (callback) => ipcRenderer.on('before-quit', () => callback()),

  focusWindow: () => ipcRenderer.invoke('focus-window'),
  // 🔑 NEW: Fire-and-forget focus request
  requestFocus: () => ipcRenderer.send('request-focus'),
  // 🔑 NEW: Find photo for contact by name and matricule from data/Photo_Organigramme
  findPhotoForContact: (firstName, lastName, matricule) => ipcRenderer.invoke('find-photo-for-contact', firstName, lastName, matricule),
  
  // 🔑 NEW: Load Excel file for diff detection
  loadExcelFile: (filePath) => ipcRenderer.invoke('load-excel-file', filePath),
  // 🔑 NEW: Load Excel file with hash calculation
  loadExcelFileWithHash: (filePath) => ipcRenderer.invoke('load-excel-file-with-hash', filePath),
  // 🔑 NEW: Open differences in a separate window (main process will store data)
  openDifferencesWindow: (differences) => ipcRenderer.invoke('open-differences-window', differences),
  // 🔑 NEW: Get differences data from main process (used inside the differences window)
  getDifferencesData: () => ipcRenderer.invoke('get-differences-data'),
  // 🔑 NEW: Apply accepted differences from the differences window (will be forwarded to main window)
  applyDifferences: (acceptedChanges) => ipcRenderer.invoke('apply-differences', acceptedChanges),
  // 🔑 NEW: Listen for applied differences in the main window
  onDifferencesApplied: (callback) => ipcRenderer.on('differences-applied', (event, data) => callback(data)),
  // IA placement organigramme
  placerOrganigramme: (nodes) => ipcRenderer.invoke('placer-organigramme', nodes),
  // Sauvegarder les diagnostics sur le disque (pour debug hors console)
  saveDiagnostics: (diagnostics) => ipcRenderer.invoke('save-diagnostics', diagnostics),
});
