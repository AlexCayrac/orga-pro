/**
 * Modèle Version
 * Représente une version historisée (import Excel)
 */
class Version {
  constructor(data) {
    this.id = data.id || this.generateId();
    this.excelFilePath = data.excelFilePath || '';
    this.excelFileName = data.excelFileName || '';
    this.timestamp = data.timestamp || new Date();
    this.changes = data.changes || [];
    this.status = data.status || 'pending'; // 'pending', 'validated', 'rejected'
    this.description = data.description || '';
    this.contacts = data.contacts || [];
  }

  generateId() {
    return `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      id: this.id,
      excelFilePath: this.excelFilePath,
      excelFileName: this.excelFileName,
      timestamp: this.timestamp,
      changes: this.changes,
      status: this.status,
      description: this.description,
      contacts: this.contacts,
    };
  }
}

module.exports = Version;
