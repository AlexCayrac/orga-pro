/**
 * barycenterOrdering
 * Given graphModel and levels, compute an initial horizontal ordering per level
 * Returns Map<level, nodeId[]>
 */
function barycenterOrdering(graphModel, { personLevels, unionLevels }) {
  // build nodes by level
  const nodesByLevel = new Map();

  const pushNode = (lvl, id) => {
    const arr = nodesByLevel.get(lvl) || [];
    arr.push(id);
    nodesByLevel.set(lvl, arr);
  };

  graphModel.personsById.forEach((_, pid) => {
    const lvl = personLevels.has(pid) ? personLevels.get(pid) : 0;
    pushNode(lvl, pid);
  });
  graphModel.unionsById.forEach((_, uid) => {
    const lvl = unionLevels.has(uid) ? unionLevels.get(uid) : 0;
    pushNode(lvl, uid);
  });

  // initial ordering: by insertion order
  const orderByLevel = new Map();
  const maxLevel = Math.max(...Array.from(nodesByLevel.keys(), k => Number(k)), 0);

  // We'll perform a single pass top->bottom computing barycenters based on parents indices
  const positions = new Map(); // temporary index positions per node per level

  for (let level = 0; level <= maxLevel; level++) {
    const nodes = nodesByLevel.get(level) || [];
    // compute barycenter for each node based on its parents (nodes in earlier levels)
    const barycenters = nodes.map((id, idx) => {
      // parents: for person => unions where child; for union => partners
      let parents = [];
      if (graphModel.personsById.has(id)) {
        // parents are partners of unions where id is child
        const uIds = graphModel.unionsByChild.get(id) || [];
        uIds.forEach(uid => {
          const partners = graphModel.partnersByUnion.get(uid) || [];
          parents = parents.concat(partners);
        });
      } else {
        // union: parents are partners
        parents = graphModel.partnersByUnion.get(id) || [];
      }

      const parentIndices = parents.map(p => positions.has(p) ? positions.get(p) : 0);
      const bary = parentIndices.length ? parentIndices.reduce((a,b) => a+b,0)/parentIndices.length : idx;
      return { id, bary };
    });

    barycenters.sort((a,b) => a.bary - b.bary || (a.id < b.id ? -1 : 1));
    const ordered = barycenters.map(x => x.id);
    // set positions indices
    ordered.forEach((id, i) => positions.set(id, i));
    orderByLevel.set(level, ordered);
  }

  return orderByLevel;
}

module.exports = barycenterOrdering;
