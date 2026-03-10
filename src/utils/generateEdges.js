// Génère des edges simples parent -> enfant depuis un tableau de nœuds
function generateEdges(nodes = []) {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter(n => n.managerId)
    .map(n => ({ from: n.managerId, to: n.id }));
}

module.exports = { generateEdges };
