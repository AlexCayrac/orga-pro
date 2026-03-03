#!/usr/bin/env node

/**
 * Script pour générer un fichier Excel d'exemple
 * Usage: node scripts/generateExampleExcel.js
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs').promises;

async function generateExampleExcel() {
  try {
    console.log('📊 Génération du fichier Excel d\'exemple...');

    // Données d'exemple avec une structure hiérarchique
    const exampleData = [
      {
        Prénom: 'Jean',
        Nom: 'Dupont',
        Poste: 'PDG',
        Département: 'Direction',
        Email: 'jean.dupont@company.com',
        Téléphone: '+33 1 23 45 67 89',
        ManagerId: '',
      },
      {
        Prénom: 'Marie',
        Nom: 'Martin',
        Poste: 'Directrice RH',
        Département: 'Ressources Humaines',
        Email: 'marie.martin@company.com',
        Téléphone: '+33 1 23 45 67 90',
        ManagerId: '',
      },
      {
        Prénom: 'Pierre',
        Nom: 'Durand',
        Poste: 'Directeur IT',
        Département: 'Informatique',
        Email: 'pierre.durand@company.com',
        Téléphone: '+33 1 23 45 67 91',
        ManagerId: '',
      },
      {
        Prénom: 'Sophie',
        Nom: 'Bernard',
        Poste: 'Responsable RH',
        Département: 'Ressources Humaines',
        Email: 'sophie.bernard@company.com',
        Téléphone: '+33 1 23 45 67 92',
        ManagerId: '',
      },
      {
        Prénom: 'Thomas',
        Nom: 'Lefebvre',
        Poste: 'Ingénieur Logiciel',
        Département: 'Informatique',
        Email: 'thomas.lefebvre@company.com',
        Téléphone: '+33 1 23 45 67 93',
        ManagerId: '',
      },
      {
        Prénom: 'Anne',
        Nom: 'Moreau',
        Poste: 'Développeuse',
        Département: 'Informatique',
        Email: 'anne.moreau@company.com',
        Téléphone: '+33 1 23 45 67 94',
        ManagerId: '',
      },
      {
        Prénom: 'Luc',
        Nom: 'Gaston',
        Poste: 'DevOps',
        Département: 'Informatique',
        Email: 'luc.gaston@company.com',
        Téléphone: '+33 1 23 45 67 95',
        ManagerId: '',
      },
      {
        Prénom: 'Isabelle',
        Nom: 'Chevalier',
        Poste: 'Gestionnaire Paie',
        Département: 'Ressources Humaines',
        Email: 'isabelle.chevalier@company.com',
        Téléphone: '+33 1 23 45 67 96',
        ManagerId: '',
      },
    ];

    // Créer le classeur
    const worksheet = XLSX.utils.json_to_sheet(exampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Organigramme');

    // Ajuster les largeurs de colonnes
    worksheet['!cols'] = [
      { wch: 15 }, // Prénom
      { wch: 15 }, // Nom
      { wch: 25 }, // Poste
      { wch: 25 }, // Département
      { wch: 30 }, // Email
      { wch: 20 }, // Téléphone
      { wch: 15 }, // ManagerId
    ];

    // Sauvegarder le fichier
    const exampleDir = path.join(__dirname, '../data');
    await fs.mkdir(exampleDir, { recursive: true });
    
    const filePath = path.join(exampleDir, 'exemple_organigramme.xlsx');
    XLSX.writeFile(workbook, filePath);

    console.log('✅ Fichier Excel créé avec succès !');
    console.log(`📁 Localisation : ${filePath}`);
    console.log('\n📋 Contenu du fichier :');
    console.log(`   - ${exampleData.length} contacts`);
    console.log('   - Structure hiérarchique (PDG -> Directeurs -> Équipes)');
    console.log('\n💡 Vous pouvez importer ce fichier dans l\'application Orga PRO');

  } catch (error) {
    console.error('❌ Erreur lors de la génération :', error.message);
    process.exit(1);
  }
}

// Exécuter
generateExampleExcel();
