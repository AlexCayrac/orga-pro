/**
 * 🎯 NOUVEL ALGORITHME DE LAYOUT
 * 
 * Principe: Arbre hiérarchique avec calcul récursif de largeur
 * 
 * 1. CONSTRUIRE l'arbre hiérarchique complet
 * 2. CALCULER la largeur de chaque sous-arbre (bottom-up)
 * 3. POSITIONNER X basé sur les enfants (top-down)
 * 4. POSITIONNER Y basé sur profondeur
 * 5. PLACER autonomes sans ordre de dépendance
 * 6. CALCULER les liens après positionnement final
 */

export function calculateLayoutV2(blocksToLayout, contactsData) {
  if (!blocksToLayout || blocksToLayout.length === 0) {
    return { positions: new Map(), connections: [] };
  }

  console.log(`\n[LAYOUT-V2] ════════════════════════════════════════════`);
  console.log(`[LAYOUT-V2] 🎯 NOUVEL ALGORITHME - ${blocksToLayout.length} blocs\n`);

  // === ÉTAPE 0: Setup ===
  const contactMap = new Map(contactsData.map(c => [c.id, c]));
  const blockMap = new Map(blocksToLayout.map(b => [b.contactId, b]));
  const positions = new Map();
  const connections = [];

  // === ÉTAPE 1: Construire l'arbre hiérarchique ===
  console.log(`\n[LAYOUT-V2] 🌳 ÉTAPE 1: Construction de l'arbre\n`);

  // Séparer: hiérarchique vs autonomes
  const hierarchicalContactIds = new Set();
  const autonomousContactIds = new Set();

  blocksToLayout.forEach(block => {
    const contact = contactMap.get(block.contactId);
    if (!contact) return;

    if (!contact.managerId || contact.managerId.trim() === '') {
      autonomousContactIds.add(block.contactId);
    } else {
      hierarchicalContactIds.add(block.contactId);
    }
  });

  console.log(`[LAYOUT-V2] Hiérarchiques: ${hierarchicalContactIds.size}, Autonomes: ${autonomousContactIds.size}`);

  // Construire l'arbre: children map et parents map
  const childrenOf = new Map(); // managerId → [contactId...]
  const parentOf = new Map();   // contactId → managerId

  hierarchicalContactIds.forEach(contactId => {
    const contact = contactMap.get(contactId);
    if (!contact?.managerId) return;

    const managerId = contact.managerId;
    if (!childrenOf.has(managerId)) {
      childrenOf.set(managerId, []);
    }
    childrenOf.get(managerId).push(contactId);
    parentOf.set(contactId, managerId);
  });

  // Trouver les racines (managers qui n'ont pas de parent)
  const roots = new Set();
  childrenOf.forEach((children, managerId) => {
    if (!parentOf.has(managerId)) {
      roots.add(managerId);
    }
  });

  console.log(`[LAYOUT-V2] Racines de l'arbre: ${Array.from(roots).map(id => contactMap.get(id)?.firstName).join(', ')}`);

  // === ÉTAPE 2: Calculer la profondeur et la largeur de chaque sous-arbre ===
  console.log(`\n[LAYOUT-V2] 📏 ÉTAPE 2: Calcul des profondeurs et largeurs\n`);

  const LEVEL_HEIGHT = 200;
  const BLOCK_MIN_WIDTH = 180;
  const MIN_GAP = 15;

  const depths = new Map();
  const subtreeWidths = new Map(); // contactId → largeur de son sous-arbre

  // Fonction récursive: calculer la profondeur et largeur d'un sous-arbre
  const calcDepthAndWidth = (contactId, visited = new Set()) => {
    if (visited.has(contactId)) {
      return { depth: 0, width: BLOCK_MIN_WIDTH };
    }

    const cached = { depth: depths.get(contactId), width: subtreeWidths.get(contactId) };
    if (cached.depth !== undefined && cached.width !== undefined) {
      return cached;
    }

    visited.add(contactId);

    const contact = contactMap.get(contactId);
    const block = blockMap.get(contactId);
    const blockWidth = Math.max(block?.width || BLOCK_MIN_WIDTH, BLOCK_MIN_WIDTH);

    // Récursif: calculer enfants
    const childIds = childrenOf.get(contactId) || [];
    const childResults = childIds.map(childId => calcDepthAndWidth(childId, new Set(visited)));

    let maxChildDepth = 0;
    let totalChildrenWidth = 0;

    childResults.forEach((result, index) => {
      maxChildDepth = Math.max(maxChildDepth, result.depth);
      if (index > 0) totalChildrenWidth += MIN_GAP; // gap entre enfants
      totalChildrenWidth += result.width;
    });

    const myDepth = maxChildDepth + 1;
    const myWidth = Math.max(blockWidth, totalChildrenWidth);

    depths.set(contactId, myDepth);
    subtreeWidths.set(contactId, myWidth);

    return { depth: myDepth, width: myWidth };
  };

  // Calculer pour toutes les racines
  roots.forEach(rootId => {
    calcDepthAndWidth(rootId);
  });

  // Calculer aussi pour les contacts autonomes
  autonomousContactIds.forEach(contactId => {
    const block = blockMap.get(contactId);
    const width = Math.max(block?.width || BLOCK_MIN_WIDTH, BLOCK_MIN_WIDTH);
    subtreeWidths.set(contactId, width);
    depths.set(contactId, 0);
  });

  console.log(`[LAYOUT-V2] Largeurs calculées: ${subtreeWidths.size} contacts`);

  // === ÉTAPE 3: Positionnement TOP-DOWN ===
  console.log(`\n[LAYOUT-V2] 📍 ÉTAPE 3: Positionnement (top-down)\n`);

  const START_Y = 50;
  const START_X = 100; // Position de référence pour les racines

  // Fonction récursive: placer un contact et ses enfants
  const placeNode = (contactId, x, y) => {
    positions.set(contactId, { x, y });

    const contact = contactMap.get(contactId);
    console.log(`[LAYOUT-V2]   ✓ "${contact?.firstName}" → (${x.toFixed(0)}, ${y})`);

    // Placer les enfants
    const childIds = childrenOf.get(contactId) || [];
    if (childIds.length === 0) return;

    // Enfants du même parent doivent être espacés
    const childWidths = childIds.map(cid => subtreeWidths.get(cid) || BLOCK_MIN_WIDTH);
    const totalWidth = childWidths.reduce((sum, w) => sum + w + MIN_GAP, -MIN_GAP);
    
    // Centrer les enfants sous le parent
    let childStartX = x - (totalWidth / 2);
    const childY = y + LEVEL_HEIGHT;

    childIds.forEach((childId, index) => {
      const childWidth = childWidths[index];
      const childCenterX = childStartX + (childWidth / 2);
      placeNode(childId, childCenterX, childY);
      childStartX += childWidth + MIN_GAP;
    });
  };

  // Placer tous les arbres (roots)
  roots.forEach(rootId => {
    placeNode(rootId, START_X, START_Y);
  });

  // === ÉTAPE 4: Placer les contacts autonomes ===
  console.log(`\n[LAYOUT-V2] 🟢 ÉTAPE 4: Placement des autonomes (ordre-indépendant)\n`);

  const autonomousIds = Array.from(autonomousContactIds).sort(); // Trier pour déterminisme
  if (autonomousIds.length > 0) {
    const autonomousWidths = autonomousIds.map(cid => subtreeWidths.get(cid) || BLOCK_MIN_WIDTH);
    const totalAutoWidth = autonomousWidths.reduce((sum, w) => sum + w + MIN_GAP, -MIN_GAP);
    
    let autoX = START_X - (totalAutoWidth / 2);
    const autoY = START_Y;

    autonomousIds.forEach((contactId, index) => {
      const width = autonomousWidths[index];
      const centerX = autoX + (width / 2);
      positions.set(contactId, { x: centerX, y: autoY });

      const contact = contactMap.get(contactId);
      console.log(`[LAYOUT-V2]   🟢 AUTONOME "${contact?.firstName}" → (${centerX.toFixed(0)}, ${autoY})`);
      
      autoX += width + MIN_GAP;
    });
  }

  // === ÉTAPE 5: Construire les connexions ===
  console.log(`\n[LAYOUT-V2] 🔗 ÉTAPE 5: Construction des connexions\n`);

  blocksToLayout.forEach(block => {
    const contact = contactMap.get(block.contactId);
    if (!contact?.managerId || contact.managerId.trim() === '') {
      return; // Pas de parent
    }

    const managerBlock = blocksToLayout.find(b => b.contactId === contact.managerId);
    if (!managerBlock) {
      return; // Parent pas en blocks
    }

    connections.push({
      from: contact.managerId,
      to: contact.id,
      fromBlockId: managerBlock.id,
      toBlockId: block.id
    });

    const managerContact = contactMap.get(contact.managerId);
    console.log(`[LAYOUT-V2]   ✓ "${contact.firstName}" ← "${managerContact?.firstName}"`);
  });

  console.log(`\n[LAYOUT-V2] ✅ FIN - ${positions.size} positions, ${connections.length} connexions\n`);
  console.log(`[LAYOUT-V2] ════════════════════════════════════════════\n`);

  return { positions, connections };
}
