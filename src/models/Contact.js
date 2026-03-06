/**
 * Modèle Contact
 * Représente un contact dans l'organigramme
 */
class Contact {
  constructor(data) {
    this.id = data.id || this.generateId();
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.position = data.position || '';
    this.department = data.department || '';
    this.email = data.email || '';
    this.phone = data.phone || '';
    this.age = data.age || null;
    this.address = data.address || '';
    this.photoPath = data.photoPath || null;
    this.managerId = data.managerId || null;
    this.managerIds = data.managerIds || null; // Support pour managers multiples
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    // Nouveaux champs (optionnels)
    this.matricule = data.matricule || null;
    this.qualification = data.qualification || null;
    this.localisation = data.localisation || '';
    this.anciennete = data.anciennete || null;
    this.birthDate = data.birthDate || null;
    this.entryDate = data.entryDate || null;
    this.regroupementPoste = data.regroupementPoste || '';
    // Relations: unions this person participates in (as partner) and parent unions where they are parent
    this.unionIds = new Set(Array.isArray(data.unionIds) ? data.unionIds : []);
    this.parentUnionIds = new Set(Array.isArray(data.parentUnionIds) ? data.parentUnionIds : []);
    this.isPlaceholder = !!data.isPlaceholder;
  }

  generateId() {
    return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getFullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  toJSON() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      position: this.position,
      department: this.department,
      email: this.email,
      phone: this.phone,
      age: this.age,
      address: this.address,
      photoPath: this.photoPath,
      managerId: this.managerId,
      managerIds: this.managerIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Nouveaux champs optionnels
      matricule: this.matricule,
      qualification: this.qualification,
      localisation: this.localisation,
      anciennete: this.anciennete,
      birthDate: this.birthDate,
      entryDate: this.entryDate,
      regroupementPoste: this.regroupementPoste,
    };
  }
}

export default Contact;
