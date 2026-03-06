/**
 * Service de Persistance des Données
 * Gère la sauvegarde et la restauration des données
 */

export const storageService = {
  /**
   * Sauvegarde l'état complet de l'application
   */
  async saveAppState(state) {
    try {
      if (!window.electronAPI?.saveAppState) {
        console.warn('electronAPI.saveAppState non disponible');
        return false;
      }
      
      await window.electronAPI.saveAppState(state);
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      return false;
    }
  },

  /**
   * Charge l'état sauvegardé
   */
  async loadAppState() {
    try {
      if (!window.electronAPI?.restoreAppState) {
        console.warn('electronAPI.restoreAppState non disponible');
        return null;
      }

      const result = await window.electronAPI.restoreAppState();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      return null;
    }
  },

  /**
   * Charge les données (contacts et orgcharts)
   */
  async loadData() {
    try {
      if (!window.electronAPI?.loadSavedData) {
        console.warn('electronAPI.loadSavedData non disponible');
        return { loadedContacts: [], loadedOrgcharts: [] };
      }

      return await window.electronAPI.loadSavedData();
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      return { loadedContacts: [], loadedOrgcharts: [] };
    }
  },

  /**
   * Sauvegarde les données brutes
   */
  async saveData(contacts, orgcharts) {
    try {
      if (!window.electronAPI?.saveData) {
        console.warn('electronAPI.saveData non disponible');
        return false;
      }

      await window.electronAPI.saveData(contacts || [], orgcharts || []);
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des données:', error);
      return false;
    }
  },
};
