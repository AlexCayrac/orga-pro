/**
 * Modèle OrgChart
 * Représente un organigramme (entreprise ou chantier)
 */
class OrgChart {
  constructor(data) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.type = data.type || 'company'; // 'company' ou 'site'
    this.description = data.description || '';
    this.contacts = data.contacts || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.versionId = data.versionId || null;
    this.metadata = data.metadata || {};
  }

  generateId() {
    return `orgchart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addContact(contact) {
    this.contacts.push(contact);
    this.updatedAt = new Date();
  }

  removeContact(contactId) {
    this.contacts = this.contacts.filter((c) => c.id !== contactId);
    this.updatedAt = new Date();
  }

  updateContact(contactId, updatedData) {
    const contact = this.contacts.find((c) => c.id === contactId);
    if (contact) {
      Object.assign(contact, updatedData);
      contact.updatedAt = new Date();
      this.updatedAt = new Date();
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: this.description,
      contacts: this.contacts.map((c) => c.toJSON?.() || c),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      versionId: this.versionId,
      metadata: this.metadata,
    };
  }
}

export default OrgChart;
