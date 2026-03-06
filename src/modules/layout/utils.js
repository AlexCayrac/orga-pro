function segmentsIntersect(a,b,c,d) {
  // a,b,c,d are {x,y}
  function orient(p,q,r) {
    return (q.x-p.x)*(r.y-p.y) - (q.y-p.y)*(r.x-p.x);
  }
  const o1 = orient(a,b,c);
  const o2 = orient(a,b,d);
  const o3 = orient(c,d,a);
  const o4 = orient(c,d,b);
  return (o1*o2 < 0) && (o3*o4 < 0);
}

function computeLayoutStats(positions, graphModel) {
  const edges = [];
  // build edges: partner -> union, union -> child
  graphModel.unionsById.forEach((u, uid) => {
    const partners = graphModel.partnersByUnion.get(uid) || [];
    const childs = graphModel.childrenByUnion.get(uid) || [];
    partners.forEach(p => {
      const a = positions.get(String(p));
      const b = positions.get(uid);
      if (a && b) edges.push({ from: String(p), to: uid, a, b });
    });
    childs.forEach(c => {
      const a = positions.get(uid);
      const b = positions.get(String(c));
      if (a && b) edges.push({ from: uid, to: String(c), a, b });
    });
  });

  let crossings = 0;
  for (let i=0;i<edges.length;i++) {
    for (let j=i+1;j<edges.length;j++) {
      const e1 = edges[i];
      const e2 = edges[j];
      if (e1.from === e2.from || e1.from === e2.to || e1.to === e2.from || e1.to === e2.to) continue;
      if (segmentsIntersect(e1.a, e1.b, e2.a, e2.b)) crossings++;
    }
  }

  const totalLen = edges.reduce((s,e) => {
    const dx = e.a.x - e.b.x; const dy = e.a.y - e.b.y; return s + Math.sqrt(dx*dx + dy*dy);
  }, 0);

  // compute width/height
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  positions.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  if (minX===Infinity) { minX=0; maxX=0; minY=0; maxY=0; }

  return {
    crossings,
    totalEdgeLength: totalLen,
    width: maxX - minX,
    height: maxY - minY,
    edgeCount: edges.length,
  };
}

module.exports = { computeLayoutStats };
