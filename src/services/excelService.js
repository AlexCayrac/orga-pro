/**
 * Service d'Import/Export Excel
 * Gère l'importation de fichiers Excel
 */

export const excelService = {
  /**
   * Ouvre le dialogue de sélection de fichier
   */
  async openFileDialog() {
    try {
      if (!window.electronAPI?.openFileDialog) {
        console.warn('electronAPI.openFileDialog non disponible');
        return null;
      }

      return await window.electronAPI.openFileDialog();
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du dialogue:', error);
      return null;
    }
  },

  /**
   * Importe un fichier Excel
   */
  async importExcelFile(filePath) {
    try {
      if (!window.electronAPI?.importExcel) {
        console.warn('electronAPI.importExcel non disponible');
        return null;
      }

      return await window.electronAPI.importExcel(filePath);
    } catch (error) {
      console.error('Erreur lors de l\'import Excel:', error);
      return null;
    }
  },

  /**
   * Exporte un organigramme
   */
  async exportOrgchart(orgchartId, format = 'pdf') {
    try {
      if (!window.electronAPI?.exportOrgchart) {
        console.warn('electronAPI.exportOrgchart non disponible');
        return null;
      }

      return await window.electronAPI.exportOrgchart(orgchartId, format);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      return null;
    }
  },
};
