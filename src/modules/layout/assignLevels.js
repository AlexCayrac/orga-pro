/**
 * assignLevels
 * Calcule les niveaux générationnels pour persons et unions
 * Retourne { personLevels: Map, unionLevels: Map }
 */
function assignLevels(graphModel, options = {}) {
  const personLevels = new Map();
  const unionLevels = new Map();

  // initialize persons: those with no parent unions => level 0
  graphModel.personsById.forEach((_, pid) => {
    const parentUnions = graphModel.unionsByChild.get(pid) || [];
    if (!parentUnions || parentUnions.length === 0) personLevels.set(pid, 0);
  });

  // others start undefined
  // iterate propagation
  let changed = true;
  let passes = 0;
  const maxPasses = options.maxPasses || 20;

  while (changed && passes < maxPasses) {
    changed = false;
    passes++;

    // Update union levels from partners
    graphModel.unionsById.forEach((u, uid) => {
      const partners = graphModel.partnersByUnion.get(uid) || [];
      const pLevels = partners.map(p => (personLevels.has(p) ? personLevels.get(p) : 0));
      const newULevel = pLevels.length > 0 ? Math.max(...pLevels) : 0;
      if (unionLevels.get(uid) !== newULevel) {
        unionLevels.set(uid, newULevel);
        changed = true;
      }

      // children levels
      const childs = graphModel.childrenByUnion.get(uid) || [];
      childs.forEach(cid => {
        const desired = newULevel + 1;
        if (!personLevels.has(cid) || personLevels.get(cid) < desired) {
          personLevels.set(cid, desired);
          changed = true;
        }
      });
    });
  }

  // normalize levels to start at 0
  const allLevels = [];
  personLevels.forEach(v => allLevels.push(v));
  unionLevels.forEach(v => allLevels.push(v));
  const minLevel = allLevels.length ? Math.min(...allLevels) : 0;
  if (minLevel > 0) {
    personLevels.forEach((v, k) => personLevels.set(k, v - minLevel));
    unionLevels.forEach((v, k) => unionLevels.set(k, v - minLevel));
  }

  return { personLevels, unionLevels };
}

module.exports = assignLevels;
