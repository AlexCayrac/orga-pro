const { placerOrganigramme } = require('../../src/modules/iaPlacementOrganigramme');

describe('IA placement: placerOrganigramme', () => {
  test('positionne les nœuds par niveau et retourne x/y', () => {
    const nodes = [
      { id: '1', name: 'Root' },
      { id: '2', name: 'Child A', parentId: '1' },
      { id: '3', name: 'Child B', parentId: '1' },
      { id: '4', name: 'Grandchild', parentId: '2' }
    ];

    const positioned = placerOrganigramme(nodes);
    expect(Array.isArray(positioned)).toBe(true);
    expect(positioned.length).toBe(nodes.length);

    // Chaque node doit avoir x et y numériques
    positioned.forEach(n => {
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
    });

    // Les enfants directs du root doivent avoir y > root.y
    const root = positioned.find(p => p.id === '1');
    const child = positioned.find(p => p.id === '2');
    expect(child.y).toBeGreaterThan(root.y);
  });
});
