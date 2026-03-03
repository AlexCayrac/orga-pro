/**
 * Module Diff Engine
 * Compare deux versions Excel et détecte les changements
 */
class DiffEngine {
  /**
   * Compare deux ensembles de contacts
   * @param {Array} previousContacts - Contacts de la version précédente
   * @param {Array} newContacts - Contacts de la nouvelle version
   * @returns {Object} Rapport de changements
   */
  compareContacts(previousContacts = [], newContacts = []) {
    const changes = {
      added: [],
      removed: [],
      modified: [],
      summary: {
        totalAdded: 0,
        totalRemoved: 0,
        totalModified: 0,
      },
    };

    // Détection des contacts supprimés et modifiés
    previousContacts.forEach((prevContact) => {
      const newContact = newContacts.find(
        (c) => this.identifyContact(c) === this.identifyContact(prevContact)
      );

      if (!newContact) {
        changes.added.push({
          type: 'removed',
          contact: prevContact,
          timestamp: new Date(),
        });
        changes.summary.totalRemoved++;
      } else {
        const modifications = this.detectModifications(prevContact, newContact);
        if (modifications.length > 0) {
          changes.modified.push({
            contact: newContact,
            modifications: modifications,
            timestamp: new Date(),
          });
          changes.summary.totalModified++;
        }
      }
    });

    // Détection des contacts ajoutés
    newContacts.forEach((newContact) => {
      const prevContact = previousContacts.find(
        (c) => this.identifyContact(c) === this.identifyContact(newContact)
      );

      if (!prevContact) {
        changes.added.push({
          type: 'added',
          contact: newContact,
          timestamp: new Date(),
        });
        changes.summary.totalAdded++;
      }
    });

    return changes;
  }

  /**
   * Identifie un contact de manière unique
   * @param {Object} contact
   * @returns {string}
   */
  identifyContact(contact) {
    return `${contact.firstName}_${contact.lastName}`.toLowerCase();
  }

  /**
   * Détecte les modifications sur un contact
   * @param {Object} prevContact
   * @param {Object} newContact
   * @returns {Array} Liste des modifications
   */
  detectModifications(prevContact, newContact) {
    const modifications = [];
    const fieldsToCheck = ['position', 'department', 'email', 'phone', 'managerId'];

    fieldsToCheck.forEach((field) => {
      if (prevContact[field] !== newContact[field]) {
        modifications.push({
          field: field,
          oldValue: prevContact[field],
          newValue: newContact[field],
        });
      }
    });

    return modifications;
  }
}

module.exports = new DiffEngine();
