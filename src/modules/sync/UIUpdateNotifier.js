/**
 * UIUpdateNotifier
 * Fournit une interface pour notifier React des différences en attente
 * Agit comme pont entre la couche métier (sync system) et la couche présentation (React)
 */

const logger = require('../../utils/logger');

class UIUpdateNotifier {
  constructor() {
    this.pendingDifferences = [];
    this.subscribers = [];
    this.excelHash = null;
    this.updateHistoryId = null;
  }

  /**
   * Enregistre un subscriber React pour les mises à jour
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    logger.info(`[UIUpdateNotifier] Subscriber registered, total: ${this.subscribers.length}`);

    // Retourner fonction de désabonnement
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
      logger.info(`[UIUpdateNotifier] Subscriber unregistered, total: ${this.subscribers.length}`);
    };
  }

  /**
   * Notifie tous les subscribers d'une mise à jour
   * @returns {void}
   */
  notifySubscribers() {
    const updates = this.getPendingUpdates();
    logger.info(`[UIUpdateNotifier] Notifying ${this.subscribers.length} subscribers with ${updates.pendingDifferences.length} differences`);

    this.subscribers.forEach(callback => {
      try {
        callback(updates);
      } catch (error) {
        logger.error('[UIUpdateNotifier] Error in subscriber callback:', error);
      }
    });
  }

  /**
   * Définit les différences en attente
   * @param {Array} differences
   * @param {String} excelHash
   * @param {String} historyId
   * @returns {void}
   */
  setPendingDifferences(differences, excelHash = null, historyId = null) {
    this.pendingDifferences = differences || [];
    this.excelHash = excelHash;
    this.updateHistoryId = historyId;

    logger.info(`[UIUpdateNotifier] Set ${this.pendingDifferences.length} pending differences, hash: ${excelHash?.substring(0, 8)}...`);

    this.notifySubscribers();
  }

  /**
   * Obtient les mises à jour pour le UI
   * @returns {Object}
   */
  getPendingUpdates() {
    const counts = {
      total: this.pendingDifferences.length,
      adds: this.pendingDifferences.filter(d => d.type === 'ADD').length,
      updates: this.pendingDifferences.filter(d => d.type === 'UPDATE').length,
      removes: this.pendingDifferences.filter(d => d.type === 'REMOVE').length,
    };

    return {
      pendingDifferences: this.pendingDifferences,
      counts,
      excelHash: this.excelHash,
      updateHistoryId: this.updateHistoryId,
      hasPending: this.pendingDifferences.length > 0,
    };
  }

  /**
   * Efface les différences en attente
   * @returns {void}
   */
  clearPending() {
    this.pendingDifferences = [];
    this.excelHash = null;
    this.updateHistoryId = null;

    logger.info('[UIUpdateNotifier] Pending differences cleared');

    this.notifySubscribers();
  }

  /**
   * Obtient les différences filtrées par type
   * @param {String} type - "ADD", "UPDATE", "REMOVE"
   * @returns {Array}
   */
  getPendingByType(type) {
    return this.pendingDifferences.filter(d => d.type === type);
  }

  /**
   * Obtient une différence spécifique par ID
   * @param {String} contactId
   * @returns {Object|null}
   */
  getPendingDifference(contactId) {
    return this.pendingDifferences.find(d => d.contactId === contactId) || null;
  }

  /**
   * Formate une différence pour affichage
   * @param {Object} difference
   * @returns {Object}
   */
  formatForUI(difference) {
    const { contactId, type, internalContact, excelContact, fieldChanges } = difference;

    switch (type) {
      case 'ADD':
        return {
          id: contactId,
          type: 'ADD',
          displayName: `${excelContact?.firstName || ''} ${excelContact?.lastName || ''}`.trim(),
          position: excelContact?.position || 'N/A',
          details: excelContact,
          message: 'Nouveau contact à ajouter',
        };

      case 'REMOVE':
        return {
          id: contactId,
          type: 'REMOVE',
          displayName: `${internalContact?.firstName || ''} ${internalContact?.lastName || ''}`.trim(),
          position: internalContact?.position || 'N/A',
          details: internalContact,
          message: 'Contact à supprimer',
        };

      case 'UPDATE':
        return {
          id: contactId,
          type: 'UPDATE',
          displayName: `${internalContact?.firstName || ''} ${internalContact?.lastName || ''}`.trim(),
          position: internalContact?.position || 'N/A',
          fieldChanges: fieldChanges || [],
          currentData: internalContact,
          newData: excelContact,
          message: `${(fieldChanges || []).length} champ(s) à mettre à jour`,
        };

      default:
        return {
          id: contactId,
          type,
          message: 'Différence inconnue',
        };
    }
  }

  /**
   * Obtient toutes les différences formatées pour le UI
   * @returns {Array}
   */
  getFormattedDifferences() {
    return this.pendingDifferences.map(d => this.formatForUI(d));
  }

  /**
   * Obtient un badge avec le compte des différences
   * @returns {String}
   */
  getBadgeText() {
    const count = this.pendingDifferences.length;
    if (count === 0) return '';
    if (count > 99) return '99+';
    return count.toString();
  }
}

module.exports = new UIUpdateNotifier();
