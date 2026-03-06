const GraphModel = require('../src/modules/graph/GraphModel');
const LayoutEngine = require('../src/modules/layout/LayoutEngine');
const { generateRandomFamilyGraph } = require('../../scripts/layoutBenchmark');

describe('LayoutEngine crossings reduction', () => {
  jest.setTimeout(20000);

  const cases = [
    { name: 'small family', persons: 10, unions: 2, generations: 2 },
    { name: 'medium family', persons: 50, unions: 10, generations: 3 },
    { name: 'large family', persons: 100, unions: 20, generations: 4 },
    { name: 'stress test', persons: 200, unions: 40, generations: 5 }
  ];

  cases.forEach(c => {
    test(`${c.name} should not increase crossings after layout`, () => {
      const { persons, unions } = generateRandomFamilyGraph({ persons: c.persons, unions: c.unions, generations: c.generations });

      const graph = new GraphModel();
      graph.buildGraph(persons, unions);

      const engine = new LayoutEngine(graph); // default sweepPasses = 8
      const result = engine.computeFullLayout();

      // crossings must not increase
      expect(result.crossingsAfter).toBeLessThanOrEqual(result.crossingsBefore);

      // positions map size equals total nodes
      const totalNodes = persons.length + unions.length;
      expect(result.positions.size).toBe(totalNodes);

      // expose crossings per edge for visibility (not an assertion)
      const gStats = graph.getStats();
      const edges = gStats.totalPartnerLinks + gStats.totalChildLinks;
      const cpeBefore = edges > 0 ? result.crossingsBefore / edges : 0;
      const cpeAfter = edges > 0 ? result.crossingsAfter / edges : 0;
      // log metrics
      // eslint-disable-next-line no-console
      console.log(`${c.name}: nodes=${totalNodes} edges=${edges} crossings: ${result.crossingsBefore} → ${result.crossingsAfter} (cpe ${cpeBefore.toFixed(3)} → ${cpeAfter.toFixed(3)})`);
    });
  });
});
