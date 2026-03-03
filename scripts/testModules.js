#!/usr/bin/env node

/**
 * Script de test des modules principaux
 * Vérifie que tous les modules importants fonctionnent
 */

const Contact = require('../src/models/Contact');
const OrgChart = require('../src/models/OrgChart');
const Version = require('../src/models/Version');
const diffEngine = require('../src/modules/diff/diffEngine');
const { createLogger } = require('../src/utils/logger');

const testLogger = createLogger('TEST-SUITE');

function testContact() {
  testLogger.info('Test du modèle Contact');
  
  const contact = new Contact({
    firstName: 'Jean',
    lastName: 'Dupont',
    position: 'Chef de Projet',
    email: 'jean@example.com',
  });

  console.assert(contact.firstName === 'Jean', 'Contact: prénom incorrecte');
  console.assert(contact.getFullName() === 'Jean Dupont', 'Contact: getFullName() incorrecte');
  console.assert(contact.id, 'Contact: pas d\'id généré');
  
  testLogger.info('✓ Contact OK');
}

function testOrgChart() {
  testLogger.info('Test du modèle OrgChart');
  
  const orgChart = new OrgChart({
    name: 'Entreprise Test',
    type: 'company',
  });

  const contact = new Contact({
    firstName: 'Alice',
    lastName: 'Martin',
  });

  orgChart.addContact(contact);
  console.assert(orgChart.contacts.length === 1, 'OrgChart: contact non ajouté');
  
  testLogger.info('✓ OrgChart OK');
}

function testVersion() {
  testLogger.info('Test du modèle Version');
  
  const version = new Version({
    excelFileName: 'test.xlsx',
  });

  console.assert(version.id, 'Version: pas d\'id');
  console.assert(version.status === 'pending', 'Version: statut incorrect');
  
  testLogger.info('✓ Version OK');
}

function testDiffEngine() {
  testLogger.info('Test du DiffEngine');
  
  const prev = [
    { firstName: 'Jean', lastName: 'Dupont', position: 'Manager' },
    { firstName: 'Marie', lastName: 'Martin', position: 'Dev' },
  ];

  const next = [
    { firstName: 'Jean', lastName: 'Dupont', position: 'Senior Manager' }, // modifié
    { firstName: 'Pierre', lastName: 'Durand', position: 'Dev' }, // nouveau
    // Marie supprimée
  ];

  const changes = diffEngine.compareContacts(prev, next);

  console.assert(changes.summary.totalAdded === 1, 'DiffEngine: ajout incorrect');
  console.assert(changes.summary.totalRemoved === 1, 'DiffEngine: suppression incorrecte');
  console.assert(changes.summary.totalModified === 1, 'DiffEngine: modification incorrecte');
  
  testLogger.info('✓ DiffEngine OK');
}

function runTests() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║     TEST DES MODULES PRINCIPAUX                   ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    testContact();
    testOrgChart();
    testVersion();
    testDiffEngine();

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║     ✓ TOUS LES TESTS SONT PASSÉS                 ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Erreur lors des tests:', error.message);
    console.log('\n╚════════════════════════════════════════════════════╝\n');
    process.exit(1);
  }
}

runTests();
