/**
 * Service de détection des changements Excel
 * Automatise la comparaison entre l'organigramme existant et le fichier Excel
 */

import * as XLSX from 'xlsx';

class ExcelDiffService {
  /**
   * Charge le fichier Excel spécifié
   * @param {string} filePath - Chemin du fichier Excel
   * @returns {Promise<Array>} Contacts du fichier Excel
   */
  async loadExcelFile(filePath) {
    try {
      console.log('[ExcelDiffService] Loading Excel file:', filePath);
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Aucune feuille trouvée dans le fichier Excel');
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      console.log('[ExcelDiffService] Loaded', rawData.length, 'rows from Excel');
      return rawData;
    } catch (error) {
      console.error('[ExcelDiffService] Error loading Excel:', error);
      throw error;
    }
  }

  /**
   * Crée une clé d'identification unique pour un contact (robuste aux accents)
   * @param {Object} contact - Contact
   * @returns {string} Clé d'identification
   */
  createContactKey(contact) {
    // Utilise prénom + nom comme clé d'identification unique
    const firstName = (contact.firstName || contact.first_name || contact['Prénom'] || '').toString().trim().toLowerCase();
    const lastName = (contact.lastName || contact.last_name || contact['Nom'] || '').toString().trim().toLowerCase();
    
    // Normaliser les accents (é→e, è→e, ê→e, etc.)
    const normalizeAccents = (str) => {
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };
    
    const normalizedFirstName = normalizeAccents(firstName);
    const normalizedLastName = normalizeAccents(lastName);
    
    return `${normalizedFirstName}|${normalizedLastName}`;
  }

  /**
   * Normalise un contact Excel pour la comparaison
   * @param {Object} rawContact - Contact brut du Excel
   * @param {number} rowIndex - Index de la ligne
   * @returns {Object} Contact normalisé
   */
  normalizeExcelContact(rawContact, rowIndex) {
    // DIAGNOSTIC: Log available columns on first row
    if (rowIndex === 0) {
      const availableColumns = Object.keys(rawContact);
      console.log(`[ExcelDiffService] 📋 Colonnes Excel disponibles (ligne 0):`, availableColumns);
    }

    // Try multiple column name variants (exact case for French columns: Prenom, Nom)
    let firstName = this.getFieldValue(rawContact, [
      'firstName', 'first_name',
      'Prenom',    // French without accent (as exported by Excel)
      'Prénom',    // French with accent
      'prenom', 'prénom',
      'firstname', 'first name',
      'givenName', 'given_name'
    ]);
    let lastName = this.getFieldValue(rawContact, [
      'lastName', 'last_name',
      'Nom',       // French without accent (as exported by Excel)
      'nom',
      'lastname', 'last name',
      'familyName', 'family_name'
    ]);

    // If names are in a single full name field, try to split
    if ((!firstName || !lastName) && (rawContact.Name || rawContact.name || rawContact.FullName || rawContact.fullName || rawContact['Nom complet'])) {
      const full = (rawContact.Name || rawContact.name || rawContact.FullName || rawContact.fullName || rawContact['Nom complet']).toString().trim();
      const parts = full.split(/\s+/);
      if (parts.length >= 2) {
        if (!firstName) firstName = parts.slice(0, parts.length - 1).join(' ');
        if (!lastName) lastName = parts[parts.length - 1];
      }
    }

    // If lastName contains both names (e.g. 'noel barjon'), split heuristically
    if ((!firstName || firstName === '') && lastName && lastName.includes(' ')) {
      const parts = lastName.split(/\s+/);
      firstName = parts.slice(0, parts.length - 1).join(' ');
      lastName = parts[parts.length - 1];
    }

    // Trim again
    firstName = (firstName || '').toString().trim();
    lastName = (lastName || '').toString().trim();

    // Log first row mapping for diagnostics
    if (rowIndex === 0) {
      console.log(`[ExcelDiffService] 🔍 Première ligne mappée: firstName="${firstName}", lastName="${lastName}"`);
    }

    return {
      rowIndex: rowIndex,
      firstName,
      lastName,
      position: this.getFieldValue(rawContact, ['position', 'Position', 'Poste', 'poste']),
      department: this.getFieldValue(rawContact, ['department', 'Department', 'Département', 'departement']),
      email: this.getFieldValue(rawContact, ['email', 'Email', 'E-mail', 'e-mail']),
      phone: this.getFieldValue(rawContact, ['phone', 'Phone', 'Téléphone', 'Telephone', 'telephone', 'TELEPHONE', 'Tel']),
      managerId: this.getFieldValue(rawContact, ['managerId', 'manager_id', 'Manager', 'manager', 'Responsable', 'responsable']),
      agency: this.getFieldValue(rawContact, ['agency', 'Agency', 'Agence', 'agence']),
      _raw: rawContact,
    };
  }

  /**
   * Récupère une valeur de champ en essayant plusieurs noms possibles
   * @param {Object} obj - Objet source
   * @param {Array} fieldNames - Noms de champs à tester
   * @returns {string} Valeur trouvée ou ''
   */
  getFieldValue(obj, fieldNames) {
    for (const name of fieldNames) {
      if (obj[name] != null) {
        return obj[name].toString().trim();
      }
    }
    return '';
  }

  /**
   * Compare les contacts existants avec ceux du fichier Excel
   * @param {Array} currentContacts - Contacts actuels dans l'app
   * @param {Array} excelRawData - Données brutes du fichier Excel
   * @returns {Object} Rapport de changements
   */
  compareContactsWithExcel(currentContacts = [], excelRawData = []) {
    console.log(`[ExcelDiffService] 🔍 Comparaison: ${currentContacts.length} contacts actuels vs ${excelRawData.length} lignes Excel`);

    // Normaliser les contacts Excel
    const excelContacts = excelRawData
      .map((raw, idx) => this.normalizeExcelContact(raw, idx))
      .filter(contact => contact.firstName || contact.lastName); // Ignorer les lignes vides

    console.log(`[ExcelDiffService] ✅ Excel: ${excelContacts.length} contacts valides après normalisation`);
    
    // LOG: Show first few normalized contacts
    if (excelContacts.length > 0) {
      console.log(`[ExcelDiffService] 📝 Premiers contacts normalisés:`);
      excelContacts.slice(0, 3).forEach(c => {
        console.log(`   - "${c.firstName}|${c.lastName}" (clé: ${this.createContactKey(c)})`);
      });
    }

    // Créer des maps par clé
    const currentMap = new Map();
    currentContacts.forEach(contact => {
      const key = this.createContactKey(contact);
      if (key !== '|') { // Ignorer les contacts sans nom
        currentMap.set(key, contact);
      }
    });

    console.log(`[ExcelDiffService] ✅ App: ${currentMap.size} contacts dans la map`);

    const excelMap = new Map();
    excelContacts.forEach(contact => {
      const key = this.createContactKey(contact);
      // Skip empty keys (both first and last name empty)
      if (key && key !== '|') {
        excelMap.set(key, contact);
      }
    });

    console.log(`[ExcelDiffService] ✅ Excel: ${excelMap.size} contacts dans la map`);

    const changes = {
      added: [],        // Nouveaux contacts dans Excel
      removed: [],      // Contacts supprimés (existants mais pas dans Excel)
      modified: [],     // Contacts modifiés
      summary: {
        totalAdded: 0,
        totalRemoved: 0,
        totalModified: 0,
        total: 0,
      },
    };

    // Détecter les contacts supprimés et modifiés
    currentMap.forEach((currentContact, key) => {
      if (!excelMap.has(key)) {
        // Contact supprimé
        console.log(`[ExcelDiffService] ❌ Contact supprimé: "${key}"`);
        changes.removed.push({
          type: 'removed',
          contact: currentContact,
        });
        changes.summary.totalRemoved++;
      } else {
        // Contact existe : vérifier les modifications
        const excelContact = excelMap.get(key);
        const modifications = this.detectModifications(currentContact, excelContact);
        
        if (modifications.length > 0) {
          console.log(`[ExcelDiffService] ✏️  Contact modifié: "${key}" avec ${modifications.length} changement(s)`);
          changes.modified.push({
            type: 'modified',
            key: key,
            currentContact: currentContact,
            excelContact: excelContact,
            modifications: modifications,
          });
          changes.summary.totalModified++;
        } else {
          console.log(`[ExcelDiffService] ✅ Contact inchangé: "${key}"`);
        }
      }
    });

    // Détecter les contacts ajoutés
    excelMap.forEach((excelContact, key) => {
      if (!currentMap.has(key)) {
        console.log(`[ExcelDiffService] ➕ Contact ajouté: "${key}"`);
        changes.added.push({
          type: 'added',
          key: key,
          excelContact: excelContact,
        });
        changes.summary.totalAdded++;
      }
    });

    changes.summary.total = 
      changes.summary.totalAdded + 
      changes.summary.totalRemoved + 
      changes.summary.totalModified;

    console.log(`[ExcelDiffService] ✅ Résultats: ${changes.summary.totalAdded} ajouts, ${changes.summary.totalRemoved} suppressions, ${changes.summary.totalModified} modifications = ${changes.summary.total} total`);
    return changes;
  }

  /**
   * Détecte les modifications sur un contact
   * @param {Object} currentContact - Contact actuel
   * @param {Object} excelContact - Contact du Excel
   * @returns {Array} Liste des modifications
   */
  detectModifications(currentContact, excelContact) {
    const modifications = [];
    const fieldsToCheck = ['position', 'department', 'email', 'phone', 'managerId', 'agency'];

    fieldsToCheck.forEach(field => {
      // Normaliser les valeurs : trim, et si empty, utiliser empty string
      const currentValue = this.normalizeFieldValue(currentContact[field]);
      const excelValue = this.normalizeFieldValue(excelContact[field]);

      // Ignorer les modifications si les deux sont vides
      if (currentValue === '' && excelValue === '') {
        return;
      }

      // Ignorer si les deux sont identiques (même après normalisation)
      if (currentValue === excelValue) {
        return;
      }

      // Déterminer si les valeurs sont différentes (case-insensitive pour certains champs)
      let isDifferent = false;
      
      if (field === 'email') {
        // Email : case-insensitive
        isDifferent = currentValue.toLowerCase() !== excelValue.toLowerCase();
      } else {
        // Autres champs : case-sensitive mais trim whitespace
        isDifferent = currentValue !== excelValue;
      }

      if (isDifferent) {
        console.log(`[ExcelDiffService] 📝 Modification détectée sur "${currentContact.firstName} ${currentContact.lastName}": ${field} = "${currentValue}" → "${excelValue}"`);
        modifications.push({
          field: field,
          oldValue: currentValue,
          newValue: excelValue,
        });
      }
    });

    return modifications;
  }

  /**
   * Normalise une valeur de champ pour la comparaison
   * @param {any} value - Valeur à normaliser
   * @returns {string} Valeur normalisée
   */
  normalizeFieldValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    const str = value.toString().trim();
    
    // Normaliser les accents similairement à createContactKey pour cohérence
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /**
   * Applique une modification acceptée à un contact
   * @param {Object} contact - Contact à modifier
   * @param {Object} modification - Modification { field, oldValue, newValue }
   * @returns {Object} Contact modifié
   */
  applyModification(contact, modification) {
    const updated = { ...contact };
    updated[modification.field] = modification.newValue;
    return updated;
  }

  /**
   * Applique une liste de modifications acceptées
   * @param {Array} contacts - Contacts actuels
   * @param {Array} acceptedChanges - Changements acceptés
   * @returns {Array} Contacts mis à jour
   */
  applyChanges(contacts, acceptedChanges) {
    let updated = [...contacts];

    acceptedChanges.forEach(change => {
      if (change.type === 'added') {
        // Ajouter le nouveau contact
        const newContact = {
          id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          ...change.excelContact,
        };
        delete newContact._raw;
        updated.push(newContact);
      } else if (change.type === 'removed') {
        // Supprimer le contact
        updated = updated.filter(c => this.createContactKey(c) !== change.key);
      } else if (change.type === 'modified') {
        // Modifier le contact
        updated = updated.map(c => {
          if (this.createContactKey(c) === change.key) {
            let modified = { ...c };
            change.modifications.forEach(mod => {
              modified = this.applyModification(modified, mod);
            });
            return modified;
          }
          return c;
        });
      }
    });

    return updated;
  }
}

export default new ExcelDiffService();
