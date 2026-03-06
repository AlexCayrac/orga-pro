/**
 * positioning
 * Assign x,y coordinates based on orderByLevel and levels
 * Returns Map<nodeId, {x,y}>
 */
function positioning(graphModel, orderByLevel, { personLevels, unionLevels }, options = {}) {
  const nodeWidth = options.nodeWidth || 120;
  const nodeHeight = options.nodeHeight || 48;
  const gutterX = options.gutterX || 40;
  const levelGap = options.levelGap || 120;

  const positions = new Map();

  const levels = Array.from(orderByLevel.keys()).map(Number).sort((a,b)=>a-b);

  // assign x by order
  levels.forEach(level => {
    const nodes = orderByLevel.get(level) || [];
    let x = 0;
    nodes.forEach((id, i) => {
      const cx = x + nodeWidth/2;
      const y = (level) * (nodeHeight + levelGap);
      positions.set(String(id), { x: cx, y });
      x += nodeWidth + gutterX;
    });
  });

  // post-process: center unions over their children where possible
  graphModel.unionsById.forEach((u, uid) => {
    const lvl = unionLevels.has(uid) ? unionLevels.get(uid) : 0;
    const childIds = graphModel.childrenByUnion.get(uid) || [];
    const childPos = childIds.map(cid => positions.get(String(cid))).filter(Boolean);
    if (childPos.length > 0) {
      const meanX = childPos.reduce((s,p)=>s+p.x,0)/childPos.length;
      const pos = positions.get(uid);
      if (pos) {
        // move union to meanX
        positions.set(uid, { x: meanX, y: pos.y });
      }
    }
  });

  return positions;
}

module.exports = positioning;
