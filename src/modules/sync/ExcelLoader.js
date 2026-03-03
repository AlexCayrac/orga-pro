/**
 * ExcelLoader
 * Charge le fichier Excel interne embarqué via l'API Electron (IPC)
 * et calcule son hash pour la détection des changements
 */

const logger = require('../../utils/logger');
const excelParser = require('../data/excelParser');

class ExcelLoader {
  /**
   * Charge le fichier Excel embarqué via l'API Electron
   * Retourne { data, filePath, hash, timestamp }
   */
  async loadEmbeddedExcel() {
    try {
      // Vérifier qu'on est dans un contexte Electron (navigateur)
      if (typeof window === 'undefined' || !window.electronAPI) {
        throw new Error('[ExcelLoader] Electron API not available');
      }

      const relativeExcelPath = 'data/Organigramme_Entreprise.xlsx';
      
      logger.info(`[ExcelLoader] Loading embedded Excel via IPC: ${relativeExcelPath}`);

      // Appeler l'API Electron pour charger le fichier ET calculer le hash
      // Cette API doit être implémentée dans le main process
      if (!window.electronAPI.loadExcelFileWithHash) {
        logger.warn('[ExcelLoader] loadExcelFileWithHash not available, using loadExcelFile');
        // Fallback: utiliser loadExcelFile simple et calculer le hash nous-mêmes
        const data = await window.electronAPI.loadExcelFile(relativeExcelPath);
        const hash = this.calculateHashFromData(data);
        
        return {
          data,
          filePath: relativeExcelPath,
          hash,
          timestamp: new Date().toISOString(),
        };
      }

      // Chemin idéal: charger avec hash en une seule requête IPC
      const result = await window.electronAPI.loadExcelFileWithHash(relativeExcelPath);

      // Defensive: inspecter la structure retournée et extraire les rows
      let data = [];
      try {
        logger.info('[ExcelLoader] IPC result keys: ' + Object.keys(result || {}).join(', '));

        // Small helper to pretty-print a sample object safely
        const sample = (obj) => {
          try {
            if (!obj) return null;
            const str = JSON.stringify(obj);
            return str.length > 1000 ? str.slice(0, 1000) + '... (truncated)' : str;
          } catch (e) {
            return String(obj);
          }
        };

        // Log a tiny sample of the IPC payload for debugging
        try {
          console.log('[ExcelLoader] IPC result sample:', sample(Array.isArray(result) ? result[0] : (result && result.data ? result.data[0] : result)));
        } catch (e) {
          // ignore
        }

        if (Array.isArray(result)) {
          data = result;
        } else if (Array.isArray(result.data)) {
          data = result.data;
        } else if (result.data && Array.isArray(result.data.data)) {
          data = result.data.data;
        } else if (result.rows && Array.isArray(result.rows)) {
          data = result.rows;
        } else if (result.items && Array.isArray(result.items)) {
          data = result.items;
        } else {
          data = [];
        }
      } catch (err) {
        logger.warn('[ExcelLoader] Warning while normalizing IPC result:', err.message || err);
        data = result && result.data ? result.data : [];
      }

      logger.info(`[ExcelLoader] ✅ Excel loaded, hash: ${result.hash?.substring(0, 8)}..., rawRows: ${Array.isArray(data) ? data.length : 'NA'}`);

      // If raw rows present, log a sample of the first 3 rows
      if (Array.isArray(data) && data.length > 0) {
        try {
          const sample3 = data.slice(0, 3).map(r => {
            try { return JSON.stringify(r); } catch (e) { return String(r); }
          });
          console.log('[ExcelLoader] RAW rows sample (first 3):', sample3);
        } catch (e) {}
      }

      // Si le résultat IPC contient un hash mais pas de données, tenter un fallback simple
      if ((!data || data.length === 0) && window.electronAPI.loadExcelFile) {
        try {
          logger.warn('[ExcelLoader] IPC returned no rows — attempting fallback loadExcelFile()');
          const fb = await window.electronAPI.loadExcelFile(relativeExcelPath);
          if (Array.isArray(fb) && fb.length > 0) {
            logger.info('[ExcelLoader] Fallback loadExcelFile returned rows:', fb.length);
            data = fb;
          } else if (fb && Array.isArray(fb.data) && fb.data.length > 0) {
            data = fb.data;
            logger.info('[ExcelLoader] Fallback loadExcelFile returned nested data rows:', data.length);
          }
        } catch (fbErr) {
          logger.error('[ExcelLoader] Fallback loadExcelFile failed:', fbErr.message || fbErr);
        }
      }

      // Attempt to normalize raw rows using excelParser (same parsing used during import)
      let normalized = data || [];
      try {
        if (Array.isArray(data) && data.length > 0 && excelParser && typeof excelParser.parseContactsData === 'function') {
          logger.info('[ExcelLoader] Normalizing rows via excelParser.parseContactsData');
          normalized = excelParser.parseContactsData(data);
          logger.info(`[ExcelLoader] Normalized contacts: ${Array.isArray(normalized) ? normalized.length : 'NA'}`);
          try {
            console.log('[ExcelLoader] Normalized sample (first 3):', (normalized || []).slice(0,3).map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, __rowHash: c.__rowHash })));
          } catch (e) {}
        }
      } catch (normErr) {
        logger.warn('[ExcelLoader] Normalization failed, returning raw rows:', normErr.message || normErr);
      }

      return {
        data: normalized || [],
        filePath: result.filePath || relativeExcelPath,
        hash: result.hash,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[ExcelLoader] Error loading Excel:', error);
      throw error;
    }
  }

  /**
   * Calcule un hash simple basé sur les données
   * Utilisé en fallback si l'API Electron ne supporte pas les hashes
   * @param {Array} data
   * @returns {String}
   */
  calculateHashFromData(data) {
    if (!data) return '';
    try {
      // Utiliser JSON.stringify pour créer une représentation du contenu
      const dataStr = JSON.stringify(data);
      // Créer un simple hash basé sur la longueur et la somme des codes de caractères
      let hash = 0;
      for (let i = 0; i < dataStr.length; i++) {
        const char = dataStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return 'hash_' + Math.abs(hash).toString(16);
    } catch (error) {
      logger.error('[ExcelLoader] Error calculating hash:', error);
      return '';
    }
  }

  /**
   * Vérifie si le hash a changé
   * @param {String} hash1
   * @param {String} hash2
   * @returns {Boolean}
   */
  hasChanged(hash1, hash2) {
    if (!hash1 || !hash2) return true;
    return hash1 !== hash2;
  }
}

module.exports = new ExcelLoader();
