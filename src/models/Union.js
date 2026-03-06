/**
 * Union
 * Représente un regroupement de partenaires (parents / co-parents / unions)
 * et la liste des enfants issus de cette union.
 */
class Union {
  constructor(data = {}) {
    this.id = data.id || `union_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.partnerIds = Array.isArray(data.partnerIds) ? data.partnerIds.slice() : [];
    this.childIds = Array.isArray(data.childIds) ? data.childIds.slice() : [];
    this.type = data.type || 'coparent'; // marriage|coparent|adoption|virtual
    this.startDate = data.startDate || null;
    this.endDate = data.endDate || null;
    this.meta = data.meta || {};
  }

  toJSON() {
    return {
      id: this.id,
      partnerIds: this.partnerIds.slice(),
      childIds: this.childIds.slice(),
      type: this.type,
      startDate: this.startDate,
      endDate: this.endDate,
      meta: this.meta,
    };
  }
}

module.exports = Union;
