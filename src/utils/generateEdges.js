// Génère des edges simples parent -> enfant depuis un tableau de nœuds
function generateEdges(nodes = []) {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter(n => n.parentId)
    .map(n => ({ from: n.parentId, to: n.id }));
}

module.exports = { generateEdges };
