/**
 * Module Data Store
 * Gère la persistance des données en JSON
 */
const fs = require('fs').promises;
const path = require('path');

class DataStore {
  constructor(storePath = './data') {
    // Utiliser le chemin fourni ou le chemin par défaut
    this.storePath = storePath;
    this.contactsFile = path.join(storePath, 'contacts.json');
    this.orgchartsFile = path.join(storePath, 'orgcharts.json');
    this.versionsFile = path.join(storePath, 'versions.json');
  }

  /**
   * S'assure que le répertoire de stockage existe
   */
  async _ensureDirectory() {
    try {
      await fs.mkdir(this.storePath, { recursive: true });
    } catch (error) {
      console.error('Erreur lors de la création du répertoire:', error);
    }
  }

  /**
   * Sauvegarde le pool de contacts
   */
  async saveContacts(contacts) {
    try {
      await this._ensureDirectory();
      await fs.writeFile(
        this.contactsFile,
        JSON.stringify(contacts, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde des contacts : ${error.message}`);
    }
  }

  /**
   * Charge le pool de contacts
   */
  async loadContacts() {
    try {
      const data = await fs.readFile(this.contactsFile, 'utf-8');
      if (!data || data.trim() === '') {
        return [];
      }
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      // Si le JSON est corrompu, retourner un tableau vide
      return [];
    }
  }

  /**
   * Sauvegarde les organigrammes
   */
  async saveOrgcharts(orgcharts) {
    try {
      await this._ensureDirectory();
      await fs.writeFile(
        this.orgchartsFile,
        JSON.stringify(orgcharts, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde des organigrammes : ${error.message}`);
    }
  }

  /**
   * Charge les organigrammes
   */
  async loadOrgcharts() {
    try {
      const data = await fs.readFile(this.orgchartsFile, 'utf-8');
      if (!data || data.trim() === '') {
        return [];
      }
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      // Si le JSON est corrompu, retourner un tableau vide
      return [];
    }
  }

  /**
   * Sauvegarde les données des projets (pour compatibilité)
   */
  async saveProjects(projects) {
    try {
      await this._ensureDirectory();
      await fs.writeFile(
        this.orgchartsFile,
        JSON.stringify(projects, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde : ${error.message}`);
    }
  }

  /**
   * Charge les projets depuis le stockage (pour compatibilité)
   */
  async loadProjects() {
    try {
      const data = await fs.readFile(this.orgchartsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Erreur lors du chargement : ${error.message}`);
    }
  }

  /**
   * Sauvegarde les versions Excel historisées
   */
  async saveVersions(versions) {
    try {
      await this._ensureDirectory();
      await fs.writeFile(
        this.versionsFile,
        JSON.stringify(versions, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde des versions : ${error.message}`);
    }
  }

  /**
   * Charge l'historique des versions
   */
  async loadVersions() {
    try {
      const data = await fs.readFile(this.versionsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Erreur lors du chargement des versions : ${error.message}`);
    }
  }
}

module.exports = DataStore;
