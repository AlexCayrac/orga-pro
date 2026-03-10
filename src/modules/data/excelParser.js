/**
 * excelParser
 * Pure JS parser used both by main and renderer.
 * Does not require Node core modules so it can be bundled safely.
 */

class ExcelParser {
  isValidContactRow(row) {
    const firstName = row['Prénom'] || row['Prenom'] || row['firstName'] || row['First Name'] || row['Firstname'] || row['PRENOM'] || '';
    const lastName = row['Nom'] || row['lastName'] || row['Last Name'] || row['Lastname'] || row['NOM'] || '';
    return (firstName + lastName).trim().length > 0;
  }

  createContactFromRow(row, timestamp, index) {
    const getColumnValue = (rowObj, ...columnNames) => {
      // Try exact keys first
      for (const colName of columnNames) {
        if (rowObj[colName] !== undefined && rowObj[colName] !== null && rowObj[colName] !== '') {
          return rowObj[colName].toString().trim();
        }
      }

      // Fallback: fuzzy match keys (ignore case, spaces and non-word chars)
      const normalize = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/gi, '');
      const wanted = columnNames.map(normalize);
      for (const key of Object.keys(rowObj)) {
        const val = rowObj[key];
        if (val === undefined || val === null || val === '') continue;
        const nk = normalize(key);
        if (wanted.includes(nk)) {
          return val.toString().trim();
        }
      }

      return '';
    };

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

    const ageValue = getColumnValue(row, 'Age', 'age', 'AGE', 'Âge', 'âge', 'ÂGE');
    let parsedAge = null;
    if (ageValue !== '') {
      const num = parseInt(ageValue, 10);
      if (!isNaN(num) && num >= 0 && num <= 150) parsedAge = num;
    }

    const matricule = getColumnValue(row, 'Matricule', 'matricule', 'MATRICULE', 'Employee ID', 'employee_id');
    const photoPath = getColumnValue(row, 'Photo', 'photo', 'PHOTO', 'PhotoPath', 'photoPath', 'Photo URL', 'photo_url');
    const qualification = getColumnValue(row, 'Qualification', 'qualification', 'QUALIFICATION', 'Statut', 'statut', 'Status', 'status');
    const localisation = getColumnValue(row, 'Localisation', 'localisation', 'LOCALISATION', 'Ville', 'ville', 'City', 'city', 'Location', 'location');

    const ancienneteValue = getColumnValue(row, 'Ancienneté', 'Anciennete', 'anciennete', 'ANCIENNETE', 'Seniority', 'seniority', 'Years', 'years');
    let parsedAnciennete = null;
    if (ancienneteValue !== '') {
      const num = parseInt(ancienneteValue, 10);
      if (!isNaN(num) && num >= 0 && num <= 100) parsedAnciennete = num;
    }

    const birthDate = getColumnValue(row, 'Naissance date', 'naissance date', 'Date Naissance', 'birthDate', 'Birth Date', 'date naissance');
    const entryDate = getColumnValue(row, 'Entrée groupe', 'entree groupe', 'Entry Date', 'entryDate', 'Date Entrée', 'date entree');
    const regroupementPoste = getColumnValue(row, 'Regroupement Poste', 'regroupement poste', 'REGROUPEMENT POSTE', 'Position Grouping', 'position_grouping');

    // DEBUG: Log what we found for Regroupement Poste (only for first contact)
    if (index === 0) {
      try {
        const allKeys = Object.keys(row);
        const hasRegroupementPoste = allKeys.some(k => k.toLowerCase().includes('regroupement'));
        console.log('[excelParser] 🔍 DEBUG Row keys containing "regroupement":', 
          allKeys.filter(k => k.toLowerCase().includes('regroupement')));
        console.log('[excelParser] 🔍 DEBUG Regroupement Poste extracted value:', JSON.stringify(regroupementPoste));
        console.log('[excelParser] 🔍 DEBUG Raw row partial:', {
          'Regroupement Poste': row['Regroupement Poste'],
          'regroupement poste': row['regroupement poste'],
          'REGROUPEMENT POSTE': row['REGROUPEMENT POSTE'],
        });
      } catch (e) {
        // ignore
      }
    }

    const contact = {
      id: excelId || matricule || `${timestamp}_${index}`,
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
      parentId: managerId && managerId !== '' ? managerId : null,
      excelId: excelId || null,
      matricule: matricule || null,
      photoPath: photoPath || null,
      qualification: qualification || null,
      localisation: localisation || '',
      anciennete: parsedAnciennete,
      birthDate: birthDate || null,
      entryDate: entryDate || null,
      regroupementPoste: regroupementPoste || '',
    };

    return contact;
  }

  parseContactsData(rawData) {
    const timestamp = Date.now();

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

    const contacts = rawData
      .filter((row) => this.isValidContactRow(row))
      .map((row, index) => {
        const contact = this.createContactFromRow(row, timestamp, index);
        try {
          contact.__rowHash = hashString(JSON.stringify(row));
        } catch (e) {
          contact.__rowHash = '';
        }
        return contact;
      });

    // Map managerId strings later in the flow (the importer will still map when running in main)
    console.log("Parsed contacts:", contacts.slice(0,5));
    return contacts;
  }
}

module.exports = new ExcelParser();
