// IA locale améliorée pour placement automatique d'organigramme
// Fournit `placerOrganigramme(nodes)`
// Améliorations:
// - Placement en grille pour parents ayant beaucoup d'enfants
// - Détection et résolution de chevauchements
// - Relaxation force-directed simple pour lisser les positions

function placerOrganigramme(nodes = []) {
  if (!Array.isArray(nodes)) return [];

  const SPACING_X = 150;
  const SPACING_Y = 120;
  const MIN_GAP = 30; // gap minimal horizontal accepté
  const GRID_THRESHOLD = 4; // si un parent a >= GRID_THRESHOLD enfants -> grille

  console.log('[IA-INIT]', {
    SPACING_X,
    SPACING_Y,
    MIN_GAP,
    GRID_THRESHOLD,
    inputNodesCount: nodes.length
  });

  // Map id -> node (copie)
  const nodeById = new Map(nodes.map(n => [n.id, { ...n }]));

  // Trouver racines
  const roots = nodes.filter(n => !n.parentId || !nodeById.has(n.parentId));
  console.log('[IA-ROOTS]', roots.length, 'roots found');

  // Assignation de niveaux (BFS)
  const levels = new Map(); // level -> [ids]
  const visited = new Set();
  const q = [];
  roots.forEach(r => { q.push({ id: r.id, level: 0 }); visited.add(r.id); });
  while (q.length) {
    const { id, level } = q.shift();
    if (!levels.has(level)) levels.set(level, []);
    levels.get(level).push(id);
    // enfants directs
    for (const n of nodes) {
      if (n.parentId === id && !visited.has(n.id)) { visited.add(n.id); q.push({ id: n.id, level: level + 1 }); }
    }
  }

  // Log hierarchy structure
  const hierarchyDebug = {};
  levels.forEach((ids, level) => {
    hierarchyDebug[level] = ids.length;
  });
  console.log('[IA-HIERARCHY]', hierarchyDebug, '- levels:', Object.keys(hierarchyDebug).length);

  // Initial placement: par niveau, centré
  const positions = new Map(); // id -> {x,y}
  const levelKeys = Array.from(levels.keys()).sort((a,b)=>a-b);
  levelKeys.forEach(level => {
    const ids = levels.get(level) || [];
    const totalWidth = Math.max(0, ids.length - 1) * SPACING_X;
    ids.forEach((id, idx) => {
      const x = idx * SPACING_X - totalWidth / 2;
      const y = level * SPACING_Y;
      positions.set(id, { x, y });
    });
  });

  // Place children in grid when parent has many children
  const childrenOf = new Map(); // parentId -> [childIds]
  nodes.forEach(n => { if (n.parentId) { if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []); childrenOf.get(n.parentId).push(n.id); }});

  for (const [parentId, childIds] of childrenOf.entries()) {
    if (!positions.has(parentId)) continue;
    if (childIds.length >= GRID_THRESHOLD) {
      const cols = Math.ceil(Math.sqrt(childIds.length));
      const rows = Math.ceil(childIds.length / cols);
      const parentPos = positions.get(parentId);
      const gridWidth = (cols - 1) * (SPACING_X - 20);
      const startX = parentPos.x - gridWidth / 2;
      const startY = parentPos.y + SPACING_Y / 1.2;
      childIds.forEach((cid, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = startX + col * (SPACING_X - 20);
        const y = startY + row * (SPACING_Y - 10);
        positions.set(cid, { x, y });
      });
    }
  }

  // For nodes not in positions (isolated loops), append below
  nodes.forEach(n => { if (!positions.has(n.id)) positions.set(n.id, { x: 0, y: (levelKeys.length + 1) * SPACING_Y }); });

  // Helper: resolve horizontal overlaps at same approximate Y
  function resolveOverlaps() {
    const byRow = new Map();
    positions.forEach((pos, id) => {
      const row = Math.round(pos.y);
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row).push({ id, ...pos });
    });

    let changed = false;
    for (const [row, items] of byRow.entries()) {
      items.sort((a,b)=>a.x-b.x);
      for (let i=0;i<items.length-1;i++){
        const a = items[i]; const b = items[i+1];
        const gap = b.x - a.x;
        if (gap < MIN_GAP) {
          const shift = (MIN_GAP - gap) / 2 + 1;
          // push left item left and right item right
          positions.set(a.id, { x: a.x - shift, y: a.y });
          positions.set(b.id, { x: b.x + shift, y: b.y });
          changed = true;
          // update neighbors in array so next comparisons use updated coords
          items[i].x = a.x - shift; items[i+1].x = b.x + shift;
        }
      }
    }
    return changed;
  }

  // Simple force-directed relaxation (x only + parent attraction)
  function relaxPositions(iterations = 40) {
    const K_REP = 40000; // repulsion constant
    const K_ATTR = 0.08; // attraction to parent
    const DAMP = 0.9;
    const ids = Array.from(positions.keys());

    for (let iter=0; iter<iterations; iter++) {
      const deltas = new Map(); // id -> dx
      ids.forEach(id => deltas.set(id, 0));

      // repulsive forces between nodes (lightweight O(n^2) but nodes small)
      for (let i=0;i<ids.length;i++){
        const idA = ids[i]; const posA = positions.get(idA);
        for (let j=i+1;j<ids.length;j++){
          const idB = ids[j]; const posB = positions.get(idB);
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const dist2 = dx*dx + dy*dy + 0.01;
          const force = K_REP / dist2;
          const nx = Math.sign(dx) || 1;
          const fx = nx * force * 0.001; // scaled
          deltas.set(idA, deltas.get(idA) + fx);
          deltas.set(idB, deltas.get(idB) - fx);
        }
      }

      // attractive to parent (pull children towards parent's x)
      nodes.forEach(n => {
        if (!n.parentId) return;
        if (!positions.has(n.id)) return;
        const ppos = positions.get(n.parentId);
        const cpos = positions.get(n.id);
        if (!ppos || !cpos) return;
        const dx = ppos.x - cpos.x;
        const ax = dx * K_ATTR;
        deltas.set(n.id, deltas.get(n.id) + ax);
      });

      // apply deltas with damping and small step
      let maxMove = 0;
      ids.forEach(id => {
        const d = deltas.get(id) * DAMP;
        const pos = positions.get(id);
        const nx = pos.x + d;
        positions.set(id, { x: nx, y: pos.y });
        maxMove = Math.max(maxMove, Math.abs(d));
      });

      // quick early exit
      if (maxMove < 0.01) break;
    }
  }

  // Run overlap resolution + relaxation a few times
  for (let i=0;i<6;i++) {
    const changed = resolveOverlaps();
    relaxPositions(20);
    if (!changed) break;
  }

  // Produce positioned array preserving node properties
  const positioned = [];
  nodes.forEach(n => {
    const pos = positions.get(n.id) || { x: 0, y: 0 };
    positioned.push({ ...nodeById.get(n.id), x: pos.x, y: pos.y });
  });

  // 🔍 DIAGNOSTIC: Log final positioned output
  const finalPositions = positioned.map(n => ({
    id: n.id.substring ? n.id.substring(0, 8) : 'unknown',
    name: n.name,
    x: Math.round(n.x * 10) / 10,
    y: Math.round(n.y * 10) / 10
  }));
  console.log('[IA-FINAL-OUTPUT] Positioned nodes:', finalPositions);

  // Check final spacing - warn if nodes are too close
  const spacingIssues = [];
  for (let i = 0; i < positioned.length; i++) {
    for (let j = i + 1; j < positioned.length; j++) {
      const a = positioned[i];
      const b = positioned[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) { // Less than 100px apart
        spacingIssues.push({
          pair: [a.id.substring(0, 8), b.id.substring(0, 8)],
          distance: Math.round(dist)
        });
      }
    }
  }
  if (spacingIssues.length > 0) {
    console.warn('[IA-SPACING-ISSUE] Nodes too close (<100px):', spacingIssues.slice(0, 5));
  }

  return positioned;
}

module.exports = { placerOrganigramme };
