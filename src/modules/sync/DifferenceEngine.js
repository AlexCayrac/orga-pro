/**
 * DifferenceEngine
 * Transforme les résultats de la comparaison en un format de différences structuré
 * Produit des objets {contactId, type: "ADD|UPDATE|REMOVE", fieldChanges}
 */

class DifferenceEngine {
  /**
   * Transforme les résultats de détection en format de différences
   * @param {Object} detectionResults - {additions, removals, updates} from DataComparator
   * @returns {Array} differences
   */
  createDifferences(detectionResults) {
    const { additions, removals, updates } = detectionResults;
    const differences = [];

    // Traiter les ajouts
    additions.forEach(addition => {
      differences.push({
        contactId: addition.contactId,
        type: 'ADD',
        excelContact: addition.excelContact,
        fieldChanges: null, // Les ajouts n'ont pas de "changements", c'est du nouveau
      });
    });

    // Traiter les suppressions
    removals.forEach(removal => {
      differences.push({
        contactId: removal.contactId,
        type: 'REMOVE',
        internalContact: removal.internalContact,
        fieldChanges: null, // Les suppressions n'ont pas de champs modifiés
      });
    });

    // Traiter les mises à jour
    updates.forEach(update => {
      differences.push({
        contactId: update.contactId,
        type: 'UPDATE',
        internalContact: update.internalContact,
        excelContact: update.excelContact,
        fieldChanges: update.fieldChanges,
      });
    });

    // Trier par type pour groupe READ
    differences.sort((a, b) => {
      const typeOrder = { ADD: 0, UPDATE: 1, REMOVE: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

    console.log('[DifferenceEngine] Created', differences.length, 'differences:', {
      adds: differences.filter(d => d.type === 'ADD').length,
      updates: differences.filter(d => d.type === 'UPDATE').length,
      removes: differences.filter(d => d.type === 'REMOVE').length,
    });

    return differences;
  }

  /**
   * Filtre les différences par type
   * @param {Array} differences
   * @param {String} type - "ADD", "UPDATE", "REMOVE"
   * @returns {Array}
   */
  filterByType(differences, type) {
    return differences.filter(d => d.type === type);
  }

  /**
   * Compte les différences par type
   * @param {Array} differences
   * @returns {Object}
   */
  countByType(differences) {
    return {
      adds: differences.filter(d => d.type === 'ADD').length,
      updates: differences.filter(d => d.type === 'UPDATE').length,
      removes: differences.filter(d => d.type === 'REMOVE').length,
      total: differences.length,
    };
  }

  /**
   * Génère un message lisible d'une différence
   * @param {Object} difference
   * @returns {String}
   */
  formatDifferenceMessage(difference) {
    const { contactId, type, fieldChanges } = difference;

    switch (type) {
      case 'ADD':
        return `Ajouter: ${difference.excelContact?.firstName || ''} ${difference.excelContact?.lastName || ''} (ID: ${contactId})`;

      case 'REMOVE':
        return `Supprimer: ${difference.internalContact?.firstName || ''} ${difference.internalContact?.lastName || ''} (ID: ${contactId})`;

      case 'UPDATE': {
        const fields = fieldChanges.map(f => f.fieldName).join(', ');
        return `Modifier: ${difference.internalContact?.firstName || ''} ${difference.internalContact?.lastName || ''} - Champs: ${fields} (ID: ${contactId})`;
      }

      default:
        return `Difference inconnue: ${type}`;
    }
  }

  /**
   * Crée un résumé des différences pour le UI
   * @param {Array} differences
   * @returns {Object}
   */
  createSummary(differences) {
    const counts = this.countByType(differences);
    const messages = differences.map(d => this.formatDifferenceMessage(d));

    return {
      totalDifferences: counts.total,
      additions: counts.adds,
      updates: counts.updates,
      removals: counts.removes,
      messages,
      hasDifferences: counts.total > 0,
    };
  }
}

module.exports = new DifferenceEngine();
