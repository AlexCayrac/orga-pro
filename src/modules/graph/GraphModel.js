/**
 * GraphModel
 * Structure en mémoire optimisée pour layout et recalculs incrémentaux
 * - personsById: Map<id, person>
 * - unionsById: Map<id, union>
 * - childrenByUnion: Map<unionId, personId[]>
 * - partnersByUnion: Map<unionId, personId[]>
 * - unionsByPerson: Map<personId, unionId[]>
 * - unionsByChild: Map<personId, unionId[]>
 */

class GraphModel {
  constructor() {
    this.clear();
  }

  clear() {
    this.personsById = new Map();
    this.unionsById = new Map();
    this.childrenByUnion = new Map();
    this.partnersByUnion = new Map();
    this.unionsByPerson = new Map();
    this.unionsByChild = new Map();
  }

  /**
   * Build graph from contacts array and optional unions array
   * contacts: Array of person objects (must include id)
   * unions: optional array of union objects; if omitted, will try contacts.__unions
   */
  buildGraph(contacts = [], unions = null) {
    this.clear();

    if (!Array.isArray(contacts)) throw new Error('contacts must be an array');

    // Populate persons
    contacts.forEach(p => {
      if (!p || !p.id) return;
      // clone shallow to avoid mutating original
      const copy = Object.assign({}, p);
      this.personsById.set(String(copy.id), copy);
    });

    // Resolve unions input
    let unionsList = unions;
    if (!Array.isArray(unionsList) && Array.isArray(contacts.__unions)) {
      unionsList = contacts.__unions;
    }

    if (!Array.isArray(unionsList)) {
      // nothing to do for unions
      return this;
    }

    // Populate unions and indexes
    unionsList.forEach(u => {
      if (!u || !u.id) return;
      const uid = String(u.id);
      const partnerIds = Array.isArray(u.partnerIds) ? u.partnerIds.map(String) : [];
      const childIds = Array.isArray(u.childIds) ? u.childIds.map(String) : [];

      this.unionsById.set(uid, Object.assign({}, u, { partnerIds: partnerIds.slice(), childIds: childIds.slice() }));
      this.partnersByUnion.set(uid, partnerIds.slice());
      this.childrenByUnion.set(uid, childIds.slice());

      // index unions by partner
      partnerIds.forEach(pid => {
        const arr = this.unionsByPerson.get(pid) || [];
        if (!arr.includes(uid)) arr.push(uid);
        this.unionsByPerson.set(pid, arr);
      });

      // index unions by child
      childIds.forEach(cid => {
        const arr = this.unionsByChild.get(cid) || [];
        if (!arr.includes(uid)) arr.push(uid);
        this.unionsByChild.set(cid, arr);
      });
    });

    return this;
  }

  getParents(personId) {
    const pid = String(personId);
    const parentUnionIds = this.unionsByChild.get(pid) || [];
    const parents = new Set();
    parentUnionIds.forEach(uid => {
      const partners = this.partnersByUnion.get(uid) || [];
      partners.forEach(p => { if (String(p) !== pid) parents.add(String(p)); });
    });
    return Array.from(parents);
  }

  getChildren(personId) {
    const pid = String(personId);
    const unionIds = this.unionsByPerson.get(pid) || [];
    const children = new Set();
    unionIds.forEach(uid => {
      const ch = this.childrenByUnion.get(uid) || [];
      ch.forEach(c => children.add(String(c)));
    });
    return Array.from(children);
  }

  getPartners(personId) {
    const pid = String(personId);
    const unionIds = this.unionsByPerson.get(pid) || [];
    const partners = new Set();
    unionIds.forEach(uid => {
      const pList = this.partnersByUnion.get(uid) || [];
      pList.forEach(p => { if (String(p) !== pid) partners.add(String(p)); });
    });
    return Array.from(partners);
  }

  /**
   * Return connected component containing the given personId
   * Traverses bipartite graph (persons <-> unions)
   */
  getConnectedComponent(personId) {
    const start = String(personId);
    if (!this.personsById.has(start)) return { personIds: [], unionIds: [] };

    const visitedPersons = new Set();
    const visitedUnions = new Set();
    const personQueue = [start];

    while (personQueue.length > 0) {
      const pid = personQueue.shift();
      if (visitedPersons.has(pid)) continue;
      visitedPersons.add(pid);

      // unions where pid is partner
      const uForPartner = this.unionsByPerson.get(pid) || [];
      uForPartner.forEach(uid => {
        if (!visitedUnions.has(uid)) {
          visitedUnions.add(uid);
          // add union's children to queue
          const childs = this.childrenByUnion.get(uid) || [];
          childs.forEach(cid => { if (!visitedPersons.has(String(cid))) personQueue.push(String(cid)); });
        }
      });

      // unions where pid is child
      const uForChild = this.unionsByChild.get(pid) || [];
      uForChild.forEach(uid => {
        if (!visitedUnions.has(uid)) {
          visitedUnions.add(uid);
          const partners = this.partnersByUnion.get(uid) || [];
          partners.forEach(par => { if (!visitedPersons.has(String(par))) personQueue.push(String(par)); });
        }
      });
    }

    return { personIds: Array.from(visitedPersons), unionIds: Array.from(visitedUnions) };
  }

  /**
   * Detect cycles parent -> child using Tarjan SCC algorithm on person-directed graph
   * Returns array of strongly connected components with size>1 (actual cycles)
   */
  detectCycles() {
    // build adjacency for person->person edges (parents -> children)
    const adj = new Map();
    this.personsById.forEach((_, pid) => adj.set(pid, []));

    this.unionsById.forEach((u, uid) => {
      const parents = this.partnersByUnion.get(uid) || [];
      const childs = this.childrenByUnion.get(uid) || [];
      parents.forEach(p => {
        const from = String(p);
        childs.forEach(c => {
          const to = String(c);
          if (!adj.has(from)) adj.set(from, []);
          adj.get(from).push(to);
        });
      });
    });

    // Tarjan
    const index = new Map();
    const lowlink = new Map();
    const onStack = new Map();
    const stack = [];
    let idx = 0;
    const sccs = [];

    const strongconnect = (v) => {
      index.set(v, idx);
      lowlink.set(v, idx);
      idx++;
      stack.push(v);
      onStack.set(v, true);

      const neighbors = adj.get(v) || [];
      neighbors.forEach(w => {
        if (!index.has(w)) {
          strongconnect(w);
          lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
        } else if (onStack.get(w)) {
          lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
        }
      });

      if (lowlink.get(v) === index.get(v)) {
        const comp = [];
        let w = null;
        do {
          w = stack.pop();
          onStack.set(w, false);
          comp.push(w);
        } while (w !== v && stack.length > 0);
        if (comp.length > 0) sccs.push(comp);
      }
    };

    adj.forEach((_, v) => {
      if (!index.has(v)) strongconnect(v);
    });

    // return only components with size > 1 (real cycles)
    return sccs.filter(c => c.length > 1);
  }

  /**
   * Compute connected components for the whole graph (persons + unions)
   * Returns array of { personIds, unionIds }
   */
  getConnectedComponents() {
    const seenPersons = new Set();
    const seenUnions = new Set();
    const components = [];

    for (const pid of this.personsById.keys()) {
      if (seenPersons.has(pid)) continue;
      const comp = this.getConnectedComponent(pid);
      comp.personIds.forEach(p => seenPersons.add(p));
      comp.unionIds.forEach(u => seenUnions.add(u));
      components.push(comp);
    }

    return components;
  }

  getStats() {
    const persons = this.personsById.size;
    const unions = this.unionsById.size;
    let totalPartnerLinks = 0;
    let totalChildLinks = 0;
    this.partnersByUnion.forEach(arr => totalPartnerLinks += arr.length);
    this.childrenByUnion.forEach(arr => totalChildLinks += arr.length);

    const components = this.getConnectedComponents().length;

    return {
      persons,
      unions,
      totalPartnerLinks,
      totalChildLinks,
      components,
    };
  }
}

module.exports = GraphModel;
