/**
 * UpdateHistoryService
 * Gère l'historique des synchronisations avec la piste d'audit complète
 */

const logger = require('../../utils/logger');

class UpdateHistoryService {
  constructor() {
    this.history = [];
    this.maxHistorySize = 100; // Limiter l'historique à 100 entrées
  }

  /**
   * Charge l'historique depuis le stockage persistant
   * @returns {Promise<Array>}
   */
  async loadHistory() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('syncHistory');
        this.history = stored ? JSON.parse(stored) : [];
        logger.info(`[UpdateHistoryService] Loaded ${this.history.length} history entries`);
      }
    } catch (error) {
      logger.error('[UpdateHistoryService] Error loading history:', error);
      this.history = [];
    }
    return this.history;
  }

  /**
   * Enregistre une nouvelle entrée d'historique
   * @param {Object} entry
   * @returns {void}
   */
  recordEntry(entry) {
    const record = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      excelHash: entry.excelHash,
      differences: {
        additions: entry.differences?.additions?.length || 0,
        updates: entry.differences?.updates?.length || 0,
        removals: entry.differences?.removals?.length || 0,
      },
      userActions: entry.userActions || {
        accepted: [],
        rejected: [],
      },
      status: entry.status || 'pending', // pending, partial, complete
      notes: entry.notes || '',
    };

    this.history.unshift(record); // Ajouter au début

    // Limiter la taille de l'historique
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    this.persistHistory();
    logger.info(`[UpdateHistoryService] Recorded entry: ${record.id}`);

    return record;
  }

  /**
   * Enregistre les actions utilisateur sur une entrée
   * @param {String} entryId
   * @param {Array} acceptedDifferences
   * @param {Array} rejectedDifferences
   * @returns {void}
   */
  recordUserActions(entryId, acceptedDifferences, rejectedDifferences) {
    const entry = this.history.find(h => h.id === entryId);
    if (entry) {
      entry.userActions = {
        accepted: acceptedDifferences || [],
        rejected: rejectedDifferences || [],
      };
      entry.status = 'complete';
      entry.completedAt = new Date().toISOString();
      this.persistHistory();
      logger.info(`[UpdateHistoryService] Recorded actions for ${entryId}: ${acceptedDifferences?.length || 0} accepted, ${rejectedDifferences?.length || 0} rejected`);
    }
  }

  /**
   * Récupère les entrées d'historique
   * @param {Number} limit - Nombre d'entrées à retourner (par défaut 50)
   * @returns {Array}
   */
  getHistory(limit = 50) {
    return this.history.slice(0, limit);
  }

  /**
   * Récupère une entrée spécifique
   * @param {String} entryId
   * @returns {Object|null}
   */
  getEntry(entryId) {
    return this.history.find(h => h.id === entryId) || null;
  }

  /**
   * Récupère les entrées récentes (dernières 24h)
   * @returns {Array}
   */
  getRecentEntries() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.history.filter(
      entry => new Date(entry.timestamp) > oneDayAgo,
    );
  }

  /**
   * Efface l'historique
   * @returns {void}
   */
  clearHistory() {
    this.history = [];
    this.persistHistory();
    logger.info('[UpdateHistoryService] History cleared');
  }

  /**
   * Sauvegarde l'historique en stockage persistant
   * @returns {void}
   */
  persistHistory() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('syncHistory', JSON.stringify(this.history));
      }
    } catch (error) {
      logger.error('[UpdateHistoryService] Error persisting history:', error);
    }
  }

  /**
   * Génère un résumé des stats d'historique
   * @returns {Object}
   */
  getSummary() {
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalDifferences = 0;

    this.history.forEach(entry => {
      totalAccepted += entry.userActions?.accepted?.length || 0;
      totalRejected += entry.userActions?.rejected?.length || 0;
      totalDifferences += (entry.differences?.additions || 0) +
                         (entry.differences?.updates || 0) +
                         (entry.differences?.removals || 0);
    });

    return {
      totalEntries: this.history.length,
      totalDifferences,
      totalAccepted,
      totalRejected,
      acceptanceRate: totalDifferences > 0
        ? `${((totalAccepted / (totalAccepted + totalRejected)) * 100).toFixed(2)}%`
        : 'N/A',
      lastSync: this.history.length > 0 ? this.history[0].timestamp : null,
    };
  }
}

module.exports = new UpdateHistoryService();
