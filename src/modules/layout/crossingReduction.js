/**
 * crossingReduction (Sugiyama-like sweep)
 * Implements downward/upward sweeps recalculating barycenters and applying local swaps
 */

function buildEdgesBetweenLevels(graphModel, levelAIds, levelBIds) {
  const setA = new Set(levelAIds.map(String));
  const setB = new Set(levelBIds.map(String));
  const edges = [];

  graphModel.unionsById.forEach((u, uid) => {
    const partners = graphModel.partnersByUnion.get(uid) || [];
    const childs = graphModel.childrenByUnion.get(uid) || [];
    partners.forEach(p => {
      if (setA.has(String(p)) && setB.has(uid)) edges.push({ from: String(p), to: uid });
    });
    childs.forEach(c => {
      if (setA.has(uid) && setB.has(String(c))) edges.push({ from: uid, to: String(c) });
    });
  });

  return edges;
}

function countCrossingsBetweenLevels(orderA, orderB, edges) {
  const indexA = new Map();
  const indexB = new Map();
  orderA.forEach((id, i) => indexA.set(id, i));
  orderB.forEach((id, i) => indexB.set(id, i));

  const pairs = edges.map(e => ({ a: indexA.get(e.from), b: indexB.get(e.to) }))
    .filter(p => p.a !== undefined && p.b !== undefined);

  let crossings = 0;
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i+1; j < pairs.length; j++) {
      const p = pairs[i], q = pairs[j];
      if (p.a < q.a && p.b > q.b) crossings++;
      else if (p.a > q.a && p.b < q.b) crossings++;
    }
  }
  return crossings;
}

function countCrossings(orderByLevel, graphModel) {
  const levels = Array.from(orderByLevel.keys()).map(Number).sort((a,b)=>a-b);
  let total = 0;
  for (let i=0;i<levels.length-1;i++) {
    const a = orderByLevel.get(levels[i]) || [];
    const b = orderByLevel.get(levels[i+1]) || [];
    if (a.length === 0 || b.length === 0) continue;
    const edges = buildEdgesBetweenLevels(graphModel, a, b);
    total += countCrossingsBetweenLevels(a,b,edges);
  }
  return total;
}

function computeBarycentersForLevel(orderByLevel, graphModel, level, neighborLevelIds, neighborOrderMap) {
  // neighborOrderMap: Map<nodeId, index> of neighbor level
  const nodes = orderByLevel.get(level) || [];
  const result = nodes.map(id => {
    let neighbors = [];
    if (graphModel.personsById.has(id)) {
      // parents are unions where id is child
      const uIds = graphModel.unionsByChild.get(id) || [];
      uIds.forEach(uid => {
        const partners = graphModel.partnersByUnion.get(uid) || [];
        neighbors = neighbors.concat(partners);
      });
    } else {
      // union: neighbors are partners
      neighbors = graphModel.partnersByUnion.get(id) || [];
    }

    const indices = neighbors.map(n => neighborOrderMap.has(n) ? neighborOrderMap.get(n) : null).filter(v => v !== null);
    const bary = indices.length ? indices.reduce((a,b)=>a+b,0)/indices.length : null;
    return { id, bary };
  });
  return result;
}

function sweepCrossingReduction(orderByLevel, graphModel, passes = 6) {
  const levels = Array.from(orderByLevel.keys()).map(Number).sort((a,b)=>a-b);
  if (levels.length <= 1) return orderByLevel;

  for (let p=0;p<passes;p++) {
    // downward sweep
    for (let i=1;i<levels.length;i++) {
      const level = levels[i];
      const prev = levels[i-1];
      const prevOrder = orderByLevel.get(prev) || [];
      const thisOrder = orderByLevel.get(level) || [];
      const neighborOrderMap = new Map(); prevOrder.forEach((id, idx) => neighborOrderMap.set(id, idx));

      // compute barycenters based on previous level
      const b = computeBarycentersForLevel(orderByLevel, graphModel, level, prevOrder, neighborOrderMap);
      // assign bary zero fallback to current index
      const indexed = thisOrder.map((id, idx) => ({ id, bary: b.find(x=>x.id===id)?.bary ?? idx }));
      indexed.sort((x,y) => (x.bary - y.bary) || (x.id < y.id ? -1 : 1));
      const candidateOrder = indexed.map(x => x.id);

      // only accept the barycenter reordering if it does not increase global crossings
      const beforeGlobal = countCrossings(orderByLevel, graphModel);
      orderByLevel.set(level, candidateOrder);
      const afterBary = countCrossings(orderByLevel, graphModel);
      if (afterBary > beforeGlobal) {
        // revert to previous order and skip local swaps
        orderByLevel.set(level, thisOrder);
        continue;
      }

      // local adjacent swaps: accept only if global crossings do not increase
      const newOrder = candidateOrder;
      for (let j=0;j<newOrder.length-1;j++) {
        const beforeSwap = countCrossings(orderByLevel, graphModel);
        // try swap
        [newOrder[j], newOrder[j+1]] = [newOrder[j+1], newOrder[j]];
        orderByLevel.set(level, newOrder);
        const afterSwap = countCrossings(orderByLevel, graphModel);
        if (afterSwap > beforeSwap) {
          // revert
          [newOrder[j], newOrder[j+1]] = [newOrder[j+1], newOrder[j]];
          orderByLevel.set(level, newOrder);
        }
      }

      // finalize level order
      orderByLevel.set(level, newOrder);
    }

    // upward sweep
    for (let i=levels.length-2;i>=0;i--) {
      const level = levels[i];
      const next = levels[i+1];
      const nextOrder = orderByLevel.get(next) || [];
      const thisOrder = orderByLevel.get(level) || [];
      const neighborOrderMap = new Map(); nextOrder.forEach((id, idx) => neighborOrderMap.set(id, idx));

      // compute barycenters based on next level
      const b = computeBarycentersForLevel(orderByLevel, graphModel, level, nextOrder, neighborOrderMap);
      const indexed = thisOrder.map((id, idx) => ({ id, bary: b.find(x=>x.id===id)?.bary ?? idx }));
      indexed.sort((x,y) => (x.bary - y.bary) || (x.id < y.id ? -1 : 1));
      const candidateOrder = indexed.map(x => x.id);

      // only accept barycenter reorder if it doesn't worsen global crossings
      const beforeGlobalUp = countCrossings(orderByLevel, graphModel);
      orderByLevel.set(level, candidateOrder);
      const afterBaryUp = countCrossings(orderByLevel, graphModel);
      if (afterBaryUp > beforeGlobalUp) {
        orderByLevel.set(level, thisOrder);
        continue;
      }

      const newOrder = candidateOrder;
      // local swaps: accept only if global crossings do not increase
      for (let j=0;j<newOrder.length-1;j++) {
        const beforeSwap = countCrossings(orderByLevel, graphModel);
        [newOrder[j], newOrder[j+1]] = [newOrder[j+1], newOrder[j]];
        orderByLevel.set(level, newOrder);
        const afterSwap = countCrossings(orderByLevel, graphModel);
        if (afterSwap > beforeSwap) {
          [newOrder[j], newOrder[j+1]] = [newOrder[j+1], newOrder[j]];
          orderByLevel.set(level, newOrder);
        }
      }

      orderByLevel.set(level, newOrder);
    }
  }

  return orderByLevel;
}

module.exports = { sweepCrossingReduction, countCrossings };

