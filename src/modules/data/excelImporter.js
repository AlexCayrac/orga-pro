/**
 * Module d'import Excel
 * Gère la lecture et l'extraction des données depuis fichiers Excel
 */
const XLSX = require('xlsx');
const path = require('path');
const excelParser = require('./excelParser');

class ExcelImporter {
  /**
   * Importe les données d'un fichier Excel
   * @param {string} filePath - Chemin du fichier Excel
   * @returns {Promise<Object>} Données extraites du fichier
   */
  async importFile(filePath) {
    try {
      console.log('[ExcelImporter] Importing file:', filePath);
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Aucune feuille trouvée dans le fichier Excel');
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      console.log('[ExcelImporter] Raw data from Excel:', { rowCount: data.length });
      if (data.length > 0) {
        console.log('[ExcelImporter] First row (raw):', data[0]);
      }

      // Use the pure-js parser to normalize rows (parser does lightweight parsing and row-hash)
      const parsedData = excelParser.parseContactsData(data);
      
      console.log('[ExcelImporter] Parsed contacts:', { count: parsedData.length });
      if (parsedData.length > 0) {
        console.log('[ExcelImporter] First contact (parsed):', parsedData[0]);
      }

      return {
        fileName: path.basename(filePath),
        filePath: filePath,
        sheetName: sheetName,
        rowCount: data.length,
        data: parsedData,
      };
    } catch (error) {
      console.error('[ExcelImporter] Error:', error);
      throw new Error(`Erreur lors de l'import Excel : ${error.message}`);
    }
  }

  /**
   * Parse les données brutes du fichier Excel
   * @param {Array} rawData - Données brutes du fichier
   * @returns {Array} Contacts parsés
   */
  parseContactsData(rawData) {
    const timestamp = Date.now();
    
    // 🔍 DEBUG: Afficher les colonnes du fichier Excel - CRITICAL LOG
    if (rawData.length > 0) {
      // Used console.warn to ensure it's always visible
      console.warn('[ExcelImporter] 🚨🚨🚨 COLONNES DU FICHIER EXCEL 🚨🚨🚨');
      console.warn('[ExcelImporter] Noms des colonnes:', Object.keys(rawData[0]));
      console.warn('[ExcelImporter] PREMIÈRE LIGNE BRUTE:', JSON.stringify(rawData[0], null, 2));
      
      // Also log with regular console.log
      console.log('[ExcelImporter] 🔍 COLONNES DU FICHIER EXCEL:');
      console.log('[ExcelImporter]', Object.keys(rawData[0]));
      console.log('[ExcelImporter] 🔑 PREMIÈRE LIGNE COMPLÈTE:');
      console.log('[ExcelImporter]', rawData[0]);
    }
    
    // Helper: simple stable string hash for per-row detection
    const hashString = (s) => {
      if (!s) return '';
      let h = 0;
      for (let i = 0; i < s.length; i++) {
        const chr = s.charCodeAt(i);
        h = ((h << 5) - h) + chr;
        h |= 0;
      }
      return Math.abs(h).toString(16);
    };

    // Legacy: this function kept for backward compatibility if someone calls it directly.
    // Delegate to excelParser for real parsing.
    const contacts = excelParser.parseContactsData(rawData);

    // === SECONDE PASSE: Mapper les managerId (numériques, ou multiples séparés par / , ;) vers les vrais UUIDs ===
    console.log('[ExcelImporter] 🔄 Mapping manager IDs (support multi-manager)...');
    const missingManagerTokens = new Set();
    contacts.forEach((contact, idx) => {
      // Initialize managerIds container
      contact.managerIds = null;

      if (contact.managerId && !contact.managerId.startsWith('contact_')) {
        // Support multiple managers written like "043 / 060 / 077"
        const parts = contact.managerId.split(/[\/;,|]+/).map(p => p.trim()).filter(Boolean);
        const mapped = [];
        for (const part of parts) {
          // Try to match by excelId first (string match), then fallback to numeric index match
          let managerContact = contacts.find(c => c.excelId && c.excelId.toString().trim() === part.toString().trim());
          if (!managerContact) {
            const num = parseInt(part, 10);
            if (!isNaN(num) && num > 0) {
              const managerRowIndex = num - 1;
              if (managerRowIndex >= 0 && managerRowIndex < contacts.length && managerRowIndex !== idx) {
                managerContact = contacts[managerRowIndex];
              }
            }
          }
          if (managerContact && managerContact.id && managerContact.id !== contact.id) {
            mapped.push(managerContact.id);
          }
          // If not resolved, remember the raw token for placeholder creation
          if (!managerContact) missingManagerTokens.add(part.toString().trim());
        }

        if (mapped.length > 0) {
          contact.managerIds = mapped;
          contact.managerId = mapped[0]; // keep primary manager for backward compatibility
          console.log(`[ExcelImporter] ✓ ${contact.firstName}: managerIds -> ${JSON.stringify(mapped)}`);
        } else {
          contact.managerIds = null;
          contact.managerId = null;
        }
      } else if (contact.managerId && contact.managerId.startsWith('contact_')) {
        // already a UUID-style reference
        contact.managerIds = [contact.managerId];
      } else {
        contact.managerIds = null;
      }
    });

    // === FINAL DIAGNOSTIC: Résumé des champs extraits ===
    // === PLACEHOLDERS: créer des contacts factices pour managers référencés mais manquants ===
    if (missingManagerTokens.size > 0) {
      console.log('[ExcelImporter] ℹ️ Managers référencés manquants détectés:', Array.from(missingManagerTokens));
      missingManagerTokens.forEach(tok => {
        if (!tok) return;
        let placeholderId = tok;
        if (!String(tok).startsWith('contact_')) {
          placeholderId = `contact_${tok}`;
        }
        // Ensure we don't duplicate existing ids
        const exists = contacts.find(c => String(c.id) === String(placeholderId));
        if (exists) return;
        const ph = {
          id: placeholderId,
          firstName: 'Manager',
          lastName: String(tok),
          position: 'Placeholder Manager',
          email: null,
          phone: null,
          managerId: null,
          managerIds: null,
          excelId: (String(tok).match(/^\d+$/) ? String(tok) : null),
          photoPath: null,
          matricule: null,
        };
        contacts.push(ph);
        console.log('[ExcelImporter] ➕ Ajout placeholder manager:', ph.id);
      });
    }
    const stats = {
      totalContacts: contacts.length,
      withMatricule: contacts.filter(c => c.matricule).length,
      withPhotoPath: contacts.filter(c => c.photoPath).length,
      withQualification: contacts.filter(c => c.qualification).length,
      withLocalisation: contacts.filter(c => c.localisation).length,
      withAnciennete: contacts.filter(c => c.anciennete !== null && c.anciennete !== undefined).length,
      withBirthDate: contacts.filter(c => c.birthDate).length,
      withEntryDate: contacts.filter(c => c.entryDate).length,
    };
    console.warn('[ExcelImporter] 📊 RÉSUMÉ EXTRACTION CHAMPS:', stats);
    console.log('[ExcelImporter] 📊 Résumé extraction:', stats);

    return contacts;
  }

  /**
   * Vérifie si une ligne contient des données valides
   * @param {Object} row - Ligne de données
   * @returns {boolean}
   */
  isValidContactRow(row) {
    const firstName = row['Prénom'] || row['Prenom'] || row['firstName'] || row['First Name'] || row['Firstname'] || row['PRENOM'] || '';
    const lastName = row['Nom'] || row['lastName'] || row['Last Name'] || row['Lastname'] || row['NOM'] || '';
    
    console.log(`[ExcelImporter] Validating row - firstName="${firstName}", lastName="${lastName}"`);
    
    return (firstName + lastName).trim().length > 0;
  }

  /**
   * Crée un objet Contact à partir d'une ligne Excel
   * @param {Object} row - Ligne de données
   * @param {number} timestamp - Timestamp pour l'ID unique
   * @param {number} index - Index pour l'ID unique
   * @returns {Object}
   */
  createContactFromRow(row, timestamp, index) {
    // Helper pour simplifier la lecture des colonnes avec variantes
    const getColumnValue = (row, ...columnNames) => {
      for (const colName of columnNames) {
        if (row[colName] !== undefined && row[colName] !== null && row[colName] !== '') {
          return row[colName].toString().trim();
        }
      }
      return '';
    };

    // COLONNES PRINCIPALES (existantes)
    const managerId = getColumnValue(row, 'ManagerID', 'ManagerId', 'managerId', 'Manager ID', 'MANAGER_ID');
    const excelId = getColumnValue(row, 'ID', 'Id', 'Identifiant', 'identifiant', 'Identifier', 'id');
    const firstName = getColumnValue(row, 'Prénom', 'Prenom', 'firstName', 'First Name', 'Firstname', 'PRENOM');
    const lastName = getColumnValue(row, 'Nom', 'lastName', 'Last Name', 'Lastname', 'NOM');
    const agency = getColumnValue(row, 
      'Agence', 'agence', 'Agency', 'agency', 'AGENCE',
      'Département', 'département', 'Department', 'department',
      'Division', 'division', 'Team', 'team'
    );
    const position = getColumnValue(row, 
      'Poste', 'position', 'Position', 'POSTE',
      'Title', 'title', 'TITLE', 'Job Title', 'job title'
    );
    
    // Parsing de l'âge (existant, amélioré)
    const ageValue = getColumnValue(row, 'Age', 'age', 'AGE', 'Âge', 'âge', 'ÂGE');
    let parsedAge = null;
    if (ageValue !== '') {
      const num = parseInt(ageValue, 10);
      if (!isNaN(num) && num >= 0 && num <= 150) {
        parsedAge = num;
        console.log(`[ExcelImporter-AGE] ✓ ${firstName}: Found age="${ageValue}" → parsed=${parsedAge}`);
      } else {
        console.log(`[ExcelImporter-AGE] ❌ ${firstName}: Value "${ageValue}" is invalid`);
      }
    }
    
    // NOUVELLES COLONNES
    const matricule = getColumnValue(row, 'Matricule', 'matricule', 'MATRICULE', 'Employee ID', 'employee_id');
    const photoPath = getColumnValue(row, 'Photo', 'photo', 'PHOTO', 'PhotoPath', 'photoPath', 'Photo URL', 'photo_url');
    const qualification = getColumnValue(row, 'Qualification', 'qualification', 'QUALIFICATION', 'Statut', 'statut', 'Status', 'status');
    const localisation = getColumnValue(row, 'Localisation', 'localisation', 'LOCALISATION', 'Ville', 'ville', 'City', 'city', 'Location', 'location');
    
    // Parsing de l'ancienneté (même traitement que l'âge)
    const ancienneteValue = getColumnValue(row, 'Ancienneté', 'Anciennete', 'anciennete', 'ANCIENNETE', 'Seniority', 'seniority', 'Years', 'years');
    let parsedAnciennete = null;
    if (ancienneteValue !== '') {
      const num = parseInt(ancienneteValue, 10);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        parsedAnciennete = num;
        console.log(`[ExcelImporter-ANCIENNETE] ✓ ${firstName}: Found anciennete="${ancienneteValue}" → parsed=${parsedAnciennete}`);
      } else {
        console.log(`[ExcelImporter-ANCIENNETE] ❌ ${firstName}: Value "${ancienneteValue}" is invalid`);
      }
    }
    
    const birthDate = getColumnValue(row, 'Naissance date', 'naissance date', 'Date Naissance', 'birthDate', 'Birth Date', 'date naissance');
    const entryDate = getColumnValue(row, 'Entrée groupe', 'entree groupe', 'Entry Date', 'entryDate', 'Date Entrée', 'date entree');
    const regroupementPoste = getColumnValue(row, 'Regroupement Poste', 'regroupement poste', 'REGROUPEMENT POSTE', 'Position Grouping', 'position_grouping');

    // Use console.warn to ensure visibility
    console.warn(`[ExcelImporter] 📸 NOUVEAUX CHAMPS - ${firstName}:`, {
      matricule: matricule || 'VIDE',
      photoPath: photoPath || 'VIDE',
      qualification: qualification || 'VIDE',
      localisation: localisation || 'VIDE',
      anciennete: parsedAnciennete || 'VIDE',
      birthDate: birthDate || 'VIDE',
      entryDate: entryDate || 'VIDE',
    });
    
    console.log(`[ExcelImporter] 📸 Nouvelles colonnes - ${firstName}:`, {
      matricule: matricule || 'VIDE',
      photoPath: photoPath || 'VIDE',
      localisation: localisation || 'VIDE',
      anciennete: parsedAnciennete || 'VIDE'
    });

    const contact = {
      id: excelId ? `contact_${excelId}` : (matricule ? `contact_${matricule}` : `contact_${timestamp}_${index}`),
      firstName: firstName || '',
      lastName: lastName || '',
      age: parsedAge,
      phone: getColumnValue(row, 'Téléphone', 'Telephone', 'phone', 'Phone', 'TELEPHONE', 'téléphone', 'Tel', 'telephone'),
      email: getColumnValue(row, 'Email', 'email', 'EMAIL', 'Mail', 'mail', 'E-mail', 'E-MAIL'),
      address: getColumnValue(row, 'Habitation', 'habitation', 'Adresse', 'adresse', 'Address', 'address'),
      agency: agency || '',
      position: position || '',
      department: getColumnValue(row, 'Département', 'department', 'Department', 'Dept', 'dept'),
      managerId: managerId && managerId !== '' ? managerId : null,
      excelId: excelId || null,
      
      // Nouveaux champs
      matricule: matricule || null,
      photoPath: photoPath || null,
      qualification: qualification || null,
      localisation: localisation || '',
      anciennete: parsedAnciennete,
      birthDate: birthDate || null,
      entryDate: entryDate || null,
      regroupementPoste: regroupementPoste || '',
    };

    console.log(`[ExcelImporter] Contact ${index}:`, {
      firstName: contact.firstName,
      lastName: contact.lastName,
      age: contact.age,
      agency: contact.agency,
      position: contact.position,
      email: contact.email,
      matricule: contact.matricule,
      qualification: contact.qualification,
      localisation: contact.localisation,
      photoPath: contact.photoPath,
      anciennete: contact.anciennete,
    });

    return contact;
  }
}

module.exports = new ExcelImporter();
