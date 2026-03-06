/**
 * DataComparator
 * Compare les contacts internes avec les données Excel en utilisant l'ID comme clé primaire
 */

class DataComparator {
  /**
   * Crée une map des contacts par ID
   * @param {Array} contacts
   * @returns {Map}
   */
  createContactMap(contacts) {
    const map = new Map();
    if (Array.isArray(contacts)) {
      contacts.forEach(contact => {
        if (contact && contact.id) {
          map.set(contact.id, contact);
        }
      });
    }
    return map;
  }

  /**
   * Compare deux contacts pour détecter les différences de champs
   * @param {Object} internalContact
   * @param {Object} excelContact
   * @returns {Array} fieldChanges
   */
  compareContactFields(internalContact, excelContact) {
    const fieldsToCompare = [
      // Identity / name
      'firstName',
      'lastName',
      // Work info
      'position',
      'department',
      'agency',
      'regroupementPoste',
      // Contacts
      'email',
      'phone',
      'address',
      'localisation',
      // IDs
      'matricule',
      'excelId',
      'managerId',
      'managerIds',
      // Numbers / dates
      'age',
      'anciennete',
      'birthDate',
      'entryDate',
      // Misc
      'photoPath',
      'qualification',
      // Row-level hash to detect any cell changes not covered by explicit fields
      '__rowHash',
    ];

    const fieldChanges = [];

    fieldsToCompare.forEach(fieldName => {
      const oldValue = internalContact ? internalContact[fieldName] : undefined;
      const newValue = excelContact ? excelContact[fieldName] : undefined;

      // Special handling for managerId / managerIds: compare by normalized id set (strip prefixes)
      if (fieldName === 'managerId' || fieldName === 'managerIds') {
        const normalizeManager = (v) => {
          if (v === null || v === undefined) return [];
          if (Array.isArray(v)) {
            return v.map(x => this.normalizeManagerEntry(x)).filter(Boolean);
          }
          // Single value split on separators
          const parts = String(v).split(/[\/;,|]+/).map(p => p.trim()).filter(Boolean);
          return parts.map(p => this.normalizeManagerEntry(p)).filter(Boolean);
        };

        const oldArr = normalizeManager(oldValue).sort();
        const newArr = normalizeManager(newValue).sort();
        const oldStr = oldArr.join('|');
        const newStr = newArr.join('|');
        if (oldStr !== newStr) {
          fieldChanges.push({ fieldName, oldValue, newValue });
        }
        return;
      }

      // Handle arrays (generic)
      const oldNorm = Array.isArray(oldValue) ? this.normalizeValue(oldValue.join('|')) : this.normalizeValue(oldValue);
      const newNorm = Array.isArray(newValue) ? this.normalizeValue(newValue.join('|')) : this.normalizeValue(newValue);

      if (oldNorm !== newNorm) {
        fieldChanges.push({ fieldName, oldValue, newValue });
      }
    });

    return fieldChanges;
  }

  /**
   * Normalise une valeur pour la comparaison
   * @param {any} value
   * @returns {string}
   */
  normalizeValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
  }

  /**
   * Normalize a manager entry (strip contact_ prefix, keep numeric or identifier)
   */
  normalizeManagerEntry(entry) {
    if (entry === null || entry === undefined) return '';
    let s = String(entry).trim();
    // If form is contact_123 -> strip
    s = s.replace(/^contact_/, '');
    // Remove non-alphanumeric except _-.
    s = s.replace(/[^a-z0-9\-_.]/ig, '');
    return s.toLowerCase();
  }

  /**
   * Crée une clé nom-based pour apparier les contacts par prénom+nom (normalisé)
   * @param {Object} contact
   * @returns {String}
   */
  createNameKey(contact) {
    if (!contact) return '';
    const first = this.normalizeValue(contact.firstName || contact.first_name || contact['Prenom'] || contact['Prénom']);
    const last = this.normalizeValue(contact.lastName || contact.last_name || contact['Nom']);
    // Remove accents for stable matching
    const normalizeAccents = (s) => s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    return `${normalizeAccents(first)}|${normalizeAccents(last)}`;
  }

  /**
   * Détecte les ajouts, suppressions et modifications
   * @param {Array} internalContacts - Données internes
   * @param {Array} excelContacts - Données du fichier Excel
   * @returns {Object} {additions, removals, updates}
   */
  detectDifferences(internalContacts, excelContacts) {
    const internalMap = this.createContactMap(internalContacts);
    const excelMap = this.createContactMap(excelContacts);

    // Also create name-based maps to match contacts when IDs changed
    const internalNameMap = new Map();
    internalContacts.forEach(c => {
      if (c) {
        const key = this.createNameKey(c);
        if (key && key !== '|') internalNameMap.set(key, c.id);
      }
    });

    const excelNameMap = new Map();
    excelContacts.forEach(c => {
      if (c) {
        const key = this.createNameKey(c);
        if (key && key !== '|') excelNameMap.set(key, c);
      }
    });

    const additions = [];     // Présents dans Excel, absents dans l'app
    const removals = [];      // Présents dans l'app, absents dans Excel
    const updates = [];       // Présents dans les deux, mais différents

    console.log('[DataComparator] Comparing', internalMap.size, 'internal vs', excelMap.size, 'excel contacts');

    // Détecter les ajouts et modifications
    excelMap.forEach((excelContact, contactId) => {
      if (internalMap.has(contactId)) {
        // Contact existe dans les deux → vérifier les modifications
        const internalContact = internalMap.get(contactId);
        const fieldChanges = this.compareContactFields(internalContact, excelContact);

        if (fieldChanges.length > 0) {
          updates.push({
            contactId,
            internalContact,
            excelContact,
            fieldChanges,
          });
        }
      } else {
        // Tentative de correspondance par nom si l'ID a changé
        const nameKey = this.createNameKey(excelContact);
        if (nameKey && internalNameMap.has(nameKey)) {
          const matchedId = internalNameMap.get(nameKey);
          const internalContact = internalMap.get(matchedId);
          const fieldChanges = this.compareContactFields(internalContact, excelContact);
          if (fieldChanges.length > 0) {
            updates.push({
              contactId: matchedId,
              internalContact,
              excelContact,
              fieldChanges,
            });
          }
        } else {
          // Contact dans Excel mais pas dans l'app → ajout
          additions.push({
            contactId,
            excelContact,
          });
        }
      }
    });

    // Détecter les suppressions
    internalMap.forEach((internalContact, contactId) => {
      if (!excelMap.has(contactId)) {
        // Si le contact existe dans Excel via un appariement par nom, ne pas le considérer comme supprimé
        const nameKey = this.createNameKey(internalContact);
        if (nameKey && excelNameMap.has(nameKey)) {
          // matched by name -> treat as potentially updated (handled earlier)
          return;
        }

        // Contact dans l'app mais pas dans Excel → suppression
        removals.push({
          contactId,
          internalContact,
        });
      }
    });

    console.log('[DataComparator] Detected:', additions.length, 'additions,', removals.length, 'removals,', updates.length, 'updates');

    return {
      additions,
      removals,
      updates,
    };
  }
}

module.exports = new DataComparator();
