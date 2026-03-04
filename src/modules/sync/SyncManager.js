/**
 * SyncManager
 * Orchestre l'ensemble du processus de synchronisation avec Excel
 * Coordonne: ExcelLoader → DataComparator → DifferenceEngine → UpdateHistoryService → UIUpdateNotifier
 */

const ExcelLoader = require('./ExcelLoader');
const DataComparator = require('./DataComparator');
const DifferenceEngine = require('./DifferenceEngine');
const UpdateHistoryService = require('./UpdateHistoryService');
const UIUpdateNotifier = require('./UIUpdateNotifier');
const logger = require('../../utils/logger');

class SyncManager {
  constructor() {
    this.isInitialized = false;
    this.lastKnownHash = null;
    this.lastComparisonResult = null;
  }

  /**
   * Initialise le SyncManager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      logger.info('[SyncManager] Initializing...');

      // Charger l'historique
      await UpdateHistoryService.loadHistory();

      // Récupérer le dernier hash si disponible
      const recentEntries = UpdateHistoryService.getRecentEntries();
      if (recentEntries.length > 0) {
        this.lastKnownHash = recentEntries[0].excelHash;
        logger.info(`[SyncManager] Restored last known hash: ${this.lastKnownHash?.substring(0, 8)}...`);
      }

      this.isInitialized = true;
      logger.info('[SyncManager] Initialization complete');
    } catch (error) {
      logger.error('[SyncManager] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Lance une synchronisation complète
   * @param {Array} currentContacts - Les contacts internes actuels
   * @returns {Promise<Object>} {differences, excelHash, historyId}
   */
  async syncWithExcel(currentContacts, options = {}) {
    try {
      logger.info('[SyncManager] Starting sync...');
      const force = options.force === true;

      // 1. Charger le fichier Excel avec hash
      const excelData = await ExcelLoader.loadEmbeddedExcel();
      const { data: excelContacts, hash: excelHash } = excelData;

      // Log both via logger and console to ensure visibility in dev tools
      logger.info(`[SyncManager] Excel loaded with hash: ${excelHash?.substring(0, 8)}...`);
      try {
        console.log('[SyncManager] Debug hashes:', { lastKnownHash: this.lastKnownHash, excelHash });
      } catch (e) {
        // ignore
      }

      // 2. Vérifier si le fichier a changé
      if (!force && this.lastKnownHash === excelHash) {
        logger.info('[SyncManager] No changes detected (hash unchanged)');
        logger.info('[SyncManager] Hash details', { lastKnownHash: this.lastKnownHash, excelHash });
        return {
          differences: [],
          excelHash,
          lastKnownHash: this.lastKnownHash,
          hasChanges: false,
          message: 'Aucune modification détectée dans le fichier Excel',
        };
      }

      if (force) {
        logger.info('[SyncManager] Force option enabled — ignoring stored hash and performing full comparison');
      }

      // 3. Comparer les contacts
      const detectionResults = DataComparator.detectDifferences(currentContacts, excelContacts);

      // 4. Créer les différences structurées
      const differences = DifferenceEngine.createDifferences(detectionResults);

      // 5. Enregistrer dans l'historique
      const historyEntry = UpdateHistoryService.recordEntry({
        excelHash,
        differences: detectionResults,
      });

      // 6. Notifier le UI
      UIUpdateNotifier.setPendingDifferences(differences, excelHash, historyEntry.id);

      logger.info(`[SyncManager] Sync complete: ${differences.length} differences found`);

      // Sauvegarder le hash
      this.lastKnownHash = excelHash;
      this.lastComparisonResult = {
        differences,
        excelContacts,
        excelHash,
        historyId: historyEntry.id,
        timestamp: new Date().toISOString(),
      };

      const summary = DifferenceEngine.createSummary(differences);

      return {
        ...summary,
        differences,
        excelHash,
        historyId: historyEntry.id,
        hasChanges: true,
      };
    } catch (error) {
      logger.error('[SyncManager] Sync error:', error);
      throw error;
    }
  }

  /**
   * Applique les différences acceptées
   * @param {Array} acceptedDifferenceIds - Les IDs des contacts acceptées
   * @param {Array} rejectedDifferenceIds - Les IDs des contacts rejetées
   * @returns {Promise<Object>}
   */
  async applyDifferences(acceptedDifferenceIds, rejectedDifferenceIds = []) {
    try {
      logger.info(`[SyncManager] Applying differences: ${acceptedDifferenceIds.length} accepted, ${rejectedDifferenceIds.length} rejected`);

      if (!this.lastComparisonResult) {
        throw new Error('No comparison result available');
      }

      const { differences, excelContacts, historyId } = this.lastComparisonResult;

      // Filtrer les différences acceptées
      const acceptedDiffs = differences.filter(d => acceptedDifferenceIds.includes(d.contactId));

      // Enregistrer les actions utilisateur
      UpdateHistoryService.recordUserActions(historyId, acceptedDiffs, rejectedDifferenceIds);

      logger.info(`[SyncManager] Recorded user actions for history entry: ${historyId}`);

      // Retourner les données pour que App.jsx applique les changements
      return {
        acceptedDifferences: acceptedDiffs,
        excelContacts,
        historyId,
      };
    } catch (error) {
      logger.error('[SyncManager] Error applying differences:', error);
      throw error;
    }
  }

  /**
   * Annule la synchronisation en attente
   * @returns {void}
   */
  cancelSync() {
    logger.info('[SyncManager] Canceling sync');
    UIUpdateNotifier.clearPending();
    this.lastComparisonResult = null;
  }

  /**
   * Obtient les différences en attente
   * @returns {Object}
   */
  getPendingUpdates() {
    return UIUpdateNotifier.getPendingUpdates();
  }

  /**
   * Obtient l'historique des synchronisations
   * @param {Number} limit
   * @returns {Array}
   */
  getHistory(limit = 50) {
    return UpdateHistoryService.getHistory(limit);
  }

  /**
   * Obtient un résumé statistique
   * @returns {Object}
   */
  getStatistics() {
    return UpdateHistoryService.getSummary();
  }
}

module.exports = new SyncManager();

// Compatibility: provide a `.default` property so ES `import SyncManager from` works
// when bundlers/transpilers expect a default export on CommonJS modules.
try {
  module.exports.default = module.exports;
} catch (e) {
  // ignore in restricted environments
}
