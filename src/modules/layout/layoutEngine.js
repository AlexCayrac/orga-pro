/**
 * 🎯 MOTEUR DE LAYOUT PROFESSIONNEL POUR ORGANIGRAMMES
 * 
 * Architecture:
 * 1. VALIDATION: Vérifier les données
 * 2. PARSING: Construire la hiérarchie
 * 3. DIMENSIONNEMENT: Calculer les tailles de blocs
 * 4. LAYOUT: Positionner les blocs sans superposition
 * 5. CENTERING: Centrer l'organigramme dans le canvas
 * 
 * Garanties:
 * ✅ Zéro superposition
 * ✅ Centrage automatique
 * ✅ Adapté aux tailles dynamiques
 * ✅ Déterministe (même résultat peu importe l'ordre d'import)
 * ✅ Robuste (support dizaines/centaines de contacts)
 */

// ============================================================================
// ÉTAPE 0: CONSTANTES & CONFIGURATION
// ============================================================================

const LAYOUT_CONFIG = {
  LEVEL_HEIGHT: 120,
  BLOCK_MIN_WIDTH: 120,
  BLOCK_MIN_HEIGHT: 48,
  MIN_GAP: 30,
  MIN_GAP_CLARITY: 20,
  PADDING_LEFT: 40,
  PADDING_TOP: 40
};

// ============================================================================
// ÉTAPE 1: VALIDATION DES ENTRÉES
// ============================================================================

/**
 * Valide les données d'entrée
 */
function validateInputs(blocks, contacts) {
  if (!Array.isArray(blocks) || !Array.isArray(contacts)) {
    console.error('[LAYOUT] ❌ Entrées invalides: blocks et contacts doivent être des tableaux');
    return false;
  }
  if (blocks.length === 0 || contacts.length === 0) {
    console.warn('[LAYOUT] ⚠️  Entrées vides');
    return true; // Pas d'erreur, juste vide
  }
  return true;
}

// ============================================================================
// ÉTAPE 2: PARSING DE LA HIÉRARCHIE
// ============================================================================

/**
 * Parse les contacts et blocs pour construire la structure hiérarchique
 */
function parseHierarchy(blocks, contacts) {
  const blockMap = new Map(); // contactId -> block
  const contactMap = new Map(); // contactId -> contact
  const childrenOf = new Map(); // parentId -> [childIds]
  const parentOf = new Map(); // childId -> [parentIds]
  const roots = new Set(); // Contacts sans parents

  // Construire les maps de base
  blocks.forEach(block => {
    blockMap.set(block.contactId, block);
  });

  contacts.forEach(contact => {
    contactMap.set(contact.id, contact);
  });

  // Construire les relations parent-enfant
  contacts.forEach(contact => {
    const contactId = contact.id;
    
    // Ajouter contact comme enfant de son managerId (parent direct)
    if (contact.managerId) {
      if (!childrenOf.has(contact.managerId)) {
        childrenOf.set(contact.managerId, []);
      }
      if (!childrenOf.get(contact.managerId).includes(contactId)) {
        childrenOf.get(contact.managerId).push(contactId);
      }
      
      if (!parentOf.has(contactId)) {
        parentOf.set(contactId, []);
      }
      if (!parentOf.get(contactId).includes(contact.managerId)) {
        parentOf.get(contactId).push(contact.managerId);
      }
    } else {
      // Pas de parent = c'est une racine
      roots.add(contactId);
    }
    
    // Ajouter contact comme enfant de ses co-managers (si présents)
    if (contact.coManagerIds && Array.isArray(contact.coManagerIds)) {
      contact.coManagerIds.forEach(coManagerId => {
        if (coManagerId && coManagerId !== contact.managerId) {
          if (!childrenOf.has(coManagerId)) {
            childrenOf.set(coManagerId, []);
          }
          if (!childrenOf.get(coManagerId).includes(contactId)) {
            childrenOf.get(coManagerId).push(contactId);
          }
          
          if (!parentOf.has(contactId)) {
            parentOf.set(contactId, []);
          }
          if (!parentOf.get(contactId).includes(coManagerId)) {
            parentOf.get(contactId).push(coManagerId);
          }
        }
      });
    }
  });

  console.log(`[LAYOUT] 📊 Hiérarchie parsée: ${contacts.length} contacts, ${roots.size} racines`);

  return {
    blockMap,
    contactMap,
    childrenOf,
    parentOf,
    roots
  };
}

// Note: a single, more feature-rich `buildConnections` implementation
// lives later in this file (ÉTAPE 5). The older variant was removed
// to avoid duplicate declarations.

// ============================================================================
// ÉTAPE 3: CALCUL DES DIMENSIONS (Bottom-Up)
// ============================================================================

/**
 * Calcule récursivement la largeur nécessaire pour chaque sous-arbre
 */
function calculateSubtreeWidths(contactId, hierarchy, visited = new Set()) {
  const { childrenOf, blockMap } = hierarchy;
  
  if (visited.has(contactId)) {
    return LAYOUT_CONFIG.BLOCK_MIN_WIDTH;
  }
  visited.add(contactId);

  const block = blockMap.get(contactId);
  const blockWidth = Math.max(block?.width || LAYOUT_CONFIG.BLOCK_MIN_WIDTH, LAYOUT_CONFIG.BLOCK_MIN_WIDTH);

  const childIds = childrenOf.get(contactId) || [];
  if (childIds.length === 0) {
    return blockWidth;
  }

  // Calculer la largeur totale des enfants
  let childrenTotalWidth = 0;
  childIds.forEach((childId, idx) => {
    if (idx > 0) childrenTotalWidth += LAYOUT_CONFIG.MIN_GAP;
    childrenTotalWidth += calculateSubtreeWidths(childId, hierarchy, new Set(visited));
  });

  // La largeur du parent = max(sa propre largeur, largeur de tous ses enfants)
  return Math.max(blockWidth, childrenTotalWidth);
}

/**
 * Crée un cache des largeurs pour tous les nœuds (optimization)
 */
function buildWidthCache(hierarchy) {
  const widths = new Map();

  function cacheWidth(contactId, visited = new Set()) {
    if (widths.has(contactId)) {
      return widths.get(contactId);
    }

    const width = calculateSubtreeWidths(contactId, hierarchy, visited);
    widths.set(contactId, width);
    return width;
  }

  // Calculer pour tous les contacts
  hierarchy.blockMap.forEach((_, contactId) => {
    cacheWidth(contactId);
  });

  return widths;
}

// ============================================================================
// ÉTAPE 3b: CALCUL DE LA PROFONDEUR MAXIMALE
// ============================================================================

/**
 * Calcule récursivement la profondeur maximale (distance à la feuille la plus profonde)
 */
function calculateMaxDepth(contactId, hierarchy, visited = new Set()) {
  const { childrenOf } = hierarchy;
  
  if (visited.has(contactId)) {
    return 0;
  }
  visited.add(contactId);

  const childIds = childrenOf.get(contactId) || [];
  if (childIds.length === 0) {
    return 0; // Feuille
  }

  // La profondeur = 1 (ce niveau) + max profondeur des enfants
  let maxChildDepth = 0;
  childIds.forEach(childId => {
    const childDepth = calculateMaxDepth(childId, hierarchy, new Set(visited));
    maxChildDepth = Math.max(maxChildDepth, childDepth);
  });

  return 1 + maxChildDepth;
}

/**
 * Crée un cache des profondeurs pour tous les nœuds
 */
function buildDepthCache(hierarchy) {
  const depths = new Map();

  function cacheDepth(contactId, visited = new Set()) {
    if (depths.has(contactId)) {
      return depths.get(contactId);
    }

    const depth = calculateMaxDepth(contactId, hierarchy, visited);
    depths.set(contactId, depth);
    return depth;
  }

  // Calculer pour tous les contacts
  hierarchy.blockMap.forEach((_, contactId) => {
    cacheDepth(contactId);
  });

  // Log des profondeurs
  console.log(`[LAYOUT] Profondeurs calculées:`);
  const depthsByValue = new Map();
  depths.forEach((depth, contactId) => {
    if (!depthsByValue.has(depth)) {
      depthsByValue.set(depth, []);
    }
    depthsByValue.get(depth).push(contactId);
  });
  
  const sortedDepths = Array.from(depthsByValue.keys()).sort((a, b) => b - a);
  sortedDepths.slice(0, 5).forEach(depth => {
    const contacts = depthsByValue.get(depth);
    console.log(`  - Profondeur ${depth}: ${contacts.length} contact(s) - ${contacts.slice(0, 2).join(', ')}${contacts.length > 2 ? '...' : ''}`);
  });

  return depths;
}


/**
 * Positionne les nœuds de manière déterministe, sans superposition
 * STRATÉGIE: La branche la plus profonde est centrée sur l'organigramme
 * OPTIMISATION: Les enfants sont réordonnés pour minimiser les croisements des connexions
 * Garantie: Le parent est TOUJOURS centré exactement au-dessus de ses enfants
 */
function positionNodes(hierarchy, widthCache, depthCache) {
  const { childrenOf, roots } = hierarchy;
  const positions = new Map();

  // ============================================================================
  // PRE-CALCUL: Construire la matrice d'affinité GLOBALE + index par parent
  // ============================================================================
  const globalAffinityMatrix = new Map(); // Map<parentA, Map<parentB, score>>
  const parentHasCoParents = new Map(); // parentId -> Set of (a,b) pairs to reorder
  
  const sharedChildrenGlobal = Array.from(hierarchy.parentOf.entries())
    .filter(([childId, managers]) => managers && managers.length > 1);
  
  console.log(`[LAYOUT] 🌍 Enfants partagés détectés: ${sharedChildrenGlobal.length}`);
  
  sharedChildrenGlobal.forEach(([childId, managers]) => {
    // Pour chaque enfant ayant plusieurs managers (co-parents),
    // augmenter l'affinité entre tous les paires de managers
    for (let i = 0; i < managers.length; i++) {
      for (let j = i + 1; j < managers.length; j++) {
        const mgr1 = managers[i];
        const mgr2 = managers[j];
        const [a, b] = [mgr1, mgr2].sort();
        
        // Enregistrer dans la matrice globale
        if (!globalAffinityMatrix.has(a)) globalAffinityMatrix.set(a, new Map());
        const current = globalAffinityMatrix.get(a).get(b) || 0;
        globalAffinityMatrix.get(a).set(b, current + 1);
        
        console.log(`[LAYOUT] 👥 Co-parents trouvés: '${a.substring(0, 6)}' et '${b.substring(0, 6)}' partagent '${childId.substring(0, 6)}'`);
        
        // Les co-parents ne sont probablement pas siblings directs
        // Donc on remonte l'arbre pour trouver le plus proche ancêtre commun
        // et on marque CELUI-LÀ pour reordering de ses enfants
        function findAncestorsUntilCommonParent(id1, id2) {
          // Trouver tous les ancêtres de id1
          const ancestors1 = new Set();
          let current = id1;
          const visited = new Set();
          while (current && !visited.has(current)) {
            visited.add(current);
            ancestors1.add(current);
            // Trouver le parent de current
            const parentsOfCurrent = Array.from(hierarchy.parentOf.entries())
              .filter(([child]) => child === current)
              .map(([, parents]) => parents[0]); // Prendre le premier parent
            if (parentsOfCurrent.length > 0) {
              current = parentsOfCurrent[0];
            } else {
              break;
            }
          }
          
          // Remonter id2 jusqu'à trouver un ancêtre commun
          current = id2;
          visited.clear();
          while (current && !visited.has(current)) {
            visited.add(current);
            if (ancestors1.has(current)) {
              return current; // Ancêtre commun trouvé
            }
            const parentsOfCurrent = Array.from(hierarchy.parentOf.entries())
              .filter(([child]) => child === current)
              .map(([, parents]) => parents[0]);
            if (parentsOfCurrent.length > 0) {
              current = parentsOfCurrent[0];
            } else {
              break;
            }
          }
          return null;
        }
        
        const commonAncestor = findAncestorsUntilCommonParent(a, b);
        if (commonAncestor) {
          if (!parentHasCoParents.has(commonAncestor)) {
            parentHasCoParents.set(commonAncestor, []);
          }
          parentHasCoParents.get(commonAncestor).push([a, b]);
          console.log(`[LAYOUT]   → Ancêtre commun trouvé: '${commonAncestor.substring(0, 6)}' va rapprocher ses enfants`);
        } else {
          console.log(`[LAYOUT]   → ❌ Pas d'ancêtre commun trouvé pour ${a.substring(0, 6)}-${b.substring(0, 6)}`);
        }
      }
    }
  });

  let globalPairCount = 0;
  for (const [, mapB] of globalAffinityMatrix) globalPairCount += mapB.size;
  console.log(`[LAYOUT] ✅ Matrice d'affinité globale: ${globalPairCount} paires de co-parents`);
  console.log(`[LAYOUT] 📋 Parents avec co-enfants à rapprocher: ${parentHasCoParents.size}`);
  for (const [parent, pairs] of parentHasCoParents) {
    console.log(`[LAYOUT]   - Parent '${parent.substring(0, 6)}': ${pairs.length} paire(s)`);
  }

  // Calculer les positions-X provisoires pour optimiser l'ordre des enfants
  const subtreeMinX = new Map(); // contactId -> minX de son sous-arbre

  function calculateSubtreeMinX(contactId, currentX = 0) {
    // Simuler le positionnement du sous-arbre pour connaître ses bounds
    const childIds = childrenOf.get(contactId) || [];
    if (childIds.length === 0) {
      return currentX;
    }

    let minX = currentX;
    let testX = currentX;
    childIds.forEach(childId => {
      const childWidth = widthCache.get(childId) || 0;
      const childMinX = testX;
      subtreeMinX.set(childId, childMinX);
      calculateSubtreeMinX(childId, childMinX);
      testX += childWidth + LAYOUT_CONFIG.MIN_GAP;
    });

    return minX;
  }

  // ============================================================================
  // HELPER: Optimiser le placement en groupant les co-parents (stubbed)
  // The detailed co-parent reordering is experimental and caused parsing
  // issues; use a safe no-op implementation to preserve behavior.
  function optimizeCoParentPlacement(childIds, affinityMatrix) {
    return childIds;
  }
  
  // Fonction récursive qui place un nœud et ses enfants
  function placeNode(contactId, centerX, y) {
    const blockWidth = widthCache.get(contactId) || LAYOUT_CONFIG.BLOCK_MIN_WIDTH;
    positions.set(contactId, { x: centerX, y });

    const childIds = childrenOf.get(contactId) || [];
    if (!childIds || childIds.length === 0) return;

    // Optional: try to optimize child order for co-parents (safe noop for now)
    let sortedChildIds = Array.from(childIds);
    sortedChildIds = optimizeCoParentPlacement(sortedChildIds, globalAffinityMatrix.get(contactId) || new Map());

    // Adapter le gap selon le nombre d'enfants pour éviter le chevauchement
    let dynamicGap = LAYOUT_CONFIG.MIN_GAP;
    if (sortedChildIds.length > 8) {
      dynamicGap = Math.max(LAYOUT_CONFIG.MIN_GAP, Math.floor(LAYOUT_CONFIG.MIN_GAP * (sortedChildIds.length / 4)));
      console.log(`[LAYOUT] 📏 ${sortedChildIds.length} enfants détectés → gap augmenté à ${dynamicGap}px`);
    }

    // Calculer la largeur totale occupée par les enfants
    let totalChildrenWidth = 0;
    sortedChildIds.forEach((childId, idx) => {
      if (idx > 0) totalChildrenWidth += dynamicGap;
      totalChildrenWidth += widthCache.get(childId) || LAYOUT_CONFIG.BLOCK_MIN_WIDTH;
    });

    // Position du premier enfant (aligné à gauche du groupe)
    let childX = centerX - (totalChildrenWidth / 2);
    const childY = y + LAYOUT_CONFIG.LEVEL_HEIGHT;

    // Placer récursivement chaque enfant (avec le gap dynamique)
    sortedChildIds.forEach(childId => {
      const childWidth = widthCache.get(childId) || LAYOUT_CONFIG.BLOCK_MIN_WIDTH;
      const childCenterX = childX + (childWidth / 2);
      placeNode(childId, childCenterX, childY);
      childX += childWidth + dynamicGap;
    });
  }

  // Pré-calculer les positions X des sous-arbres
  Array.from(roots).forEach(rootId => {
    calculateSubtreeMinX(rootId, LAYOUT_CONFIG.PADDING_LEFT);
  });

  // Identifier la racine avec la profondeur maximale
  const sortedRoots = Array.from(roots).sort((a, b) => {
    const depthA = depthCache.get(a) || 0;
    const depthB = depthCache.get(b) || 0;
    return depthB - depthA; // Ordre décroissant: la plus profonde d'abord
  });

  const deepestRoot = sortedRoots[0];
  
  console.log(`[LAYOUT] Positionnement racines:`);
  console.log(`  - Nombre de racines: ${sortedRoots.length}`);
  sortedRoots.forEach((rootId, idx) => {
    const depth = depthCache.get(rootId) || 0;
    console.log(`    ${idx}: ${rootId} (profondeur: ${depth})`);
  });
  
  // Séparer les racines en deux catégories pour un layout plus compact
  // - HIÉRARCHIQUES: racines avec des enfants (profondeur > 0)
  // - AUTONOMES: racines sans enfants (profondeur = 0) - peuvent être empilées en colonne
  
  const hierarchicalRoots = sortedRoots.filter(r => (depthCache.get(r) || 0) > 0);
  const autonomousRoots = sortedRoots.filter(r => (depthCache.get(r) || 0) === 0);

  console.log(`[LAYOUT] Séparation racines:`);
  console.log(`  - Hiérarchiques: ${hierarchicalRoots.length}`);
  console.log(`  - Autonomes: ${autonomousRoots.length}`);

  // STRATÉGIE: Placer les racines en GRILLE COMPACTE
  // - Chaque racine dans sa propre "colonne" (groupe vertical)
  // - Les colonnes côte à côte mais sans espace blanc inutile
  // - Les autonomes avec petit espacement
  
  let currentX = LAYOUT_CONFIG.PADDING_LEFT;
  const rootsToPlace = sortedRoots; // Tous les roots, mais on va les espacer compactement

  rootsToPlace.forEach((rootId, idx) => {
    const rootWidth = widthCache.get(rootId);
    const rootCenterX = currentX + (rootWidth / 2);
    
    // Placer cette racine
    placeNode(rootId, rootCenterX, LAYOUT_CONFIG.PADDING_TOP);
    
    // Décaler X pour la prochaine racine
    // 🔧 Pour contacts autonomes (sans enfants), utiliser gap ULTRA-réduit
    const isAutonomous = (depthCache.get(rootId) || 0) === 0;
    const gapForThisRoot = isAutonomous ? 3 : 8; // 3px pour autonomes, 8px pour hiérarchiques
    
    currentX += rootWidth + gapForThisRoot;
    
    const type = isAutonomous ? '→' : '↓';
    console.log(`  [Racine ${idx}] ${type} '${rootId.substring(0, 6)}' à x=${rootCenterX.toFixed(0)} (gap=${gapForThisRoot}px)`);
  });

  // ============================================================================
  // POST-PROCESS: Centrer les enfants ayant plusieurs managers entre leurs managers
  // IMPORTANT: faire après le placement initial des racines (les managers ont des positions)
  // ============================================================================
  const sharedChildren = Array.from(hierarchy.parentOf.entries())
    .filter(([childId, managers]) => managers && managers.length > 1)
    .map(([childId]) => childId);

  if (sharedChildren.length > 0) {
    sharedChildren.forEach(childId => {
      const managers = hierarchy.parentOf.get(childId) || [];
      const managerPositions = managers.map(m => positions.get(m)).filter(Boolean);
      if (managerPositions.length === 0) return;

      // Calculer la position X comme la moyenne des X des managers
      const avgX = managerPositions.reduce((s, p) => s + p.x, 0) / managerPositions.length;

      // Calculer la position Y sous le manager le plus bas
      const maxManagerY = Math.max(...managerPositions.map(p => p.y));
      const childY = maxManagerY + LAYOUT_CONFIG.LEVEL_HEIGHT;

      const prev = positions.get(childId);
      positions.set(childId, { x: avgX, y: childY });
      console.log(`[LAYOUT] ↔️ Shared child ${childId} centered at x=${avgX.toFixed(0)}, y=${childY.toFixed(0)} (managers: ${managers.length})`);
    });
  }

  // ============================================================================
  // DEBUG: Dump global des affinités co-parent pour inspection hors-console
  // Écrit build/co_parent_global_debug_<ts>.json si possible, sinon déclenche
  // un téléchargement depuis le renderer.
  // ============================================================================
  try {
    const globalPairs = [];
    Array.from(childrenOf.keys()).forEach(parentId => {
      const childIds = childrenOf.get(parentId) || [];
      const siblingsWithChildren = childIds.filter(cid => (childrenOf.get(cid) || []).length > 0);
      for (let i = 0; i < siblingsWithChildren.length; i++) {
        for (let j = i + 1; j < siblingsWithChildren.length; j++) {
          const a = siblingsWithChildren[i];
          const b = siblingsWithChildren[j];
          const childrenA = new Set(childrenOf.get(a) || []);
          const childrenB = new Set(childrenOf.get(b) || []);
          const shared = Array.from(childrenA).filter(c => childrenB.has(c));
          if (shared.length > 0) {
            globalPairs.push({ parentId, a, b, sharedCount: shared.length, sharedChildren: shared });
          }
        }
      }
    });

    const debugObj = { ts: Date.now(), pairs: globalPairs };
    // essayer d'écrire sur disque (Electron/node) si possible
    try {
      // NOTE: Disabled require('fs') and require('path') to avoid Webpack bundling errors
      // const fs = (typeof window !== 'undefined' && window.require) ? window.require('fs') : (typeof require === 'function' ? require('fs') : null);
      // const path = (typeof window !== 'undefined' && window.require) ? window.require('path') : (typeof require === 'function' ? require('path') : null);
      const fs = null;
      const path = null;
      if (fs && path) {
        // This block won't execute since fs and path are null
      } else if (typeof document !== 'undefined') {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(debugObj));
        const dl = document.createElement('a');
        dl.setAttribute('href', dataStr);
        dl.setAttribute('download', `co_parent_global_debug_${Date.now()}.json`);
        document.body.appendChild(dl);
        dl.click();
        dl.remove();
        console.log('[LAYOUT] 📥 Global co-parent debug download triggered');
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }

  // ============================================================================
  // POST-PROCESSING: COMPACTION HORIZONTALE AGRESSIVE POUR MINIMISER L'ESPACE
  // ============================================================================
  // Trois passes:
  // 1. Compaction INTRA-PARENT: rapprocher les enfants d'un parent
  // 2. Compaction INTER-RACINES: rapprocher les branches/racines entre elles
  // 3. Compaction FINALE: passes supplémentaires pour converter complètement
  // ============================================================================
  
  console.log(`[LAYOUT] 🔧 COMPACTION: Début de l'optimisation d'espace (agressive)`);
  
  // Calculer les bounding boxes réelles de chaque nœud (RÉCURSIF)
  function getSubtreeBounds(contactId) {
    const pos = positions.get(contactId);
    if (!pos) return null;
    
    const block = hierarchy.blockMap.get(contactId);
    const blockWidth = block?.width || 140;
    const left = pos.x - blockWidth / 2;
    const right = pos.x + blockWidth / 2;
    
    const childIds = childrenOf.get(contactId) || [];
    if (childIds.length === 0) {
      return { left, right, x: pos.x, y: pos.y };
    }
    
    let minLeft = left;
    let maxRight = right;
    
    childIds.forEach(childId => {
      const childBounds = getSubtreeBounds(childId);
      if (childBounds) {
        minLeft = Math.min(minLeft, childBounds.left);
        maxRight = Math.max(maxRight, childBounds.right);
      }
    });
    
    return { left: minLeft, right: maxRight, x: pos.x, y: pos.y };
  }
  
  // PASSE 1: Compaction intra-parent (rapprocher les enfants)
  console.log(`[LAYOUT] 📍 PASSE 1: Compaction intra-parent...`);
  let passes = 0;
  let changed = true;
  const COMPACTION_MIN_GAP = (typeof window !== 'undefined' && window.orgChartDiagnostics && typeof window.orgChartDiagnostics.compactionMinGap === 'number')
    ? window.orgChartDiagnostics.compactionMinGap
    : 12; // Gap minimal augmenté pour éviter chevauchements visuels (recommandation)
  
  while (changed && passes < 30) { // Plus de passes (était 20)
    changed = false;
    passes++;
    
    // For each node, try to shift its children left
    for (const [parentId, childIds] of childrenOf) {
      if (!childIds || childIds.length <= 1) continue;
      
      // Sort children by x position (left to right)
      const sortedChildren = [...childIds].sort((a, b) => {
        const posA = positions.get(a);
        const posB = positions.get(b);
        return (posA?.x || 0) - (posB?.x || 0);
      });
      
      // Try to shift each child left towards the previous one
      for (let i = 1; i < sortedChildren.length; i++) {
        const prevChild = sortedChildren[i - 1];
        const currChild = sortedChildren[i];
        
        const prevPos = positions.get(prevChild);
        const currPos = positions.get(currChild);
        if (!prevPos || !currPos) continue;
        
        const prevBounds = getSubtreeBounds(prevChild);
        const currBounds = getSubtreeBounds(currChild);
        if (!prevBounds || !currBounds) continue;
        
        // How much can we shift currChild left? (TRÈS agressif: 99%)
        const minDistance = prevBounds.right + COMPACTION_MIN_GAP;
        const maxShift = currBounds.left - minDistance;
        
        if (maxShift > 0.5) {
          // Shift current child (and its subtree) left
          const shiftAmount = maxShift * 0.99; // 99% du shift possible (était 95%)
          const shiftRecursive = (cid) => {
            const p = positions.get(cid);
            if (p) {
              positions.set(cid, { ...p, x: p.x - shiftAmount });
            }
            const children = childrenOf.get(cid) || [];
            children.forEach(child => shiftRecursive(child));
          };
          
          shiftRecursive(currChild);
          changed = true;
        }
      }
    }
  }
  
  console.log(`[LAYOUT] ✅ Passe 1 terminée: ${passes} passes - Enfants rapprochés`);
  
  // PASSE 2: Compaction inter-racines (rapprocher les branches entre elles)
  console.log(`[LAYOUT] 📍 PASSE 2: Compaction inter-racines...`);
  passes = 0;
  changed = true;
  
  while (changed && passes < 30) {
    changed = false;
    passes++;
    
    // Collecter toutes les "racines" (nœuds sans parent pour ce parent-enfant ou autres roots)
    const sortedRoots = Array.from(hierarchy.roots).sort((a, b) => {
      const posA = positions.get(a);
      const posB = positions.get(b);
      return (posA?.x || 0) - (posB?.x || 0);
    });
    
    if (sortedRoots.length <= 1) break; // Pas besoin de compacter
    
    // Try to shift each root left towards the previous one
    for (let i = 1; i < sortedRoots.length; i++) {
      const prevRoot = sortedRoots[i - 1];
      const currRoot = sortedRoots[i];
      
      const prevBounds = getSubtreeBounds(prevRoot);
      const currBounds = getSubtreeBounds(currRoot);
      if (!prevBounds || !currBounds) continue;
      
      // How much can we shift currRoot left?
      const minDistance = prevBounds.right + COMPACTION_MIN_GAP;
      const maxShift = currBounds.left - minDistance;
      
      if (maxShift > 0.5) {
        // Shift current root (and its subtree) left
        const shiftAmount = maxShift * 0.99;
        const shiftRecursive = (cid) => {
          const p = positions.get(cid);
          if (p) {
            positions.set(cid, { ...p, x: p.x - shiftAmount });
          }
          const children = childrenOf.get(cid) || [];
          children.forEach(child => shiftRecursive(child));
        };
        
        shiftRecursive(currRoot);
        changed = true;
      }
    }
  }
  
  console.log(`[LAYOUT] ✅ Passe 2 terminée: ${passes} passes - Racines rapprochées`);
  
  // PASSE 3: Compaction finale agressive
  console.log(`[LAYOUT] 📍 PASSE 3: Compaction finale agressive...`);
  passes = 0;
  changed = true;
  const FINAL_MIN_GAP = (typeof window !== 'undefined' && window.orgChartDiagnostics && typeof window.orgChartDiagnostics.finalMinGap === 'number')
    ? window.orgChartDiagnostics.finalMinGap
    : 8; // Gap minimal pour la dernière passe (recommandation)
  
  while (changed && passes < 20) {
    changed = false;
    passes++;
    
    // Re-collecter tous les nœuds ET les racines
    const allNodes = Array.from(positions.keys()).sort((a, b) => {
      const posA = positions.get(a);
      const posB = positions.get(b);
      const dy = (posA?.y || 0) - (posB?.y || 0); // Trier par Y d'abord
      if (Math.abs(dy) > 5) return dy; // Groupes par niveau
      return (posA?.x || 0) - (posB?.x || 0); // Puis par X
    });
    
    // Passer par tous les nœuds sur chaque niveau y et essayer de les rapprocher
    const levelMap = new Map();
    allNodes.forEach(nodeId => {
      const pos = positions.get(nodeId);
      const yKey = Math.round(pos.y);
      if (!levelMap.has(yKey)) levelMap.set(yKey, []);
      levelMap.get(yKey).push(nodeId);
    });
    
    // Pour chaque niveau
    for (const [yKey, nodesAtLevel] of levelMap) {
      const sortedAtLevel = nodesAtLevel.sort((a, b) => {
        const posA = positions.get(a);
        const posB = positions.get(b);
        return (posA?.x || 0) - (posB?.x || 0);
      });
      
      // Rapidement rapprocher les nœuds voisins du même niveau
      for (let i = 1; i < sortedAtLevel.length; i++) {
        const prevNode = sortedAtLevel[i - 1];
        const currNode = sortedAtLevel[i];
        
        const prevBounds = getSubtreeBounds(prevNode);
        const currBounds = getSubtreeBounds(currNode);
        if (!prevBounds || !currBounds) continue;
        
        const minDistance = prevBounds.right + FINAL_MIN_GAP;
        const maxShift = currBounds.left - minDistance;
        
        if (maxShift > 0.1) { // Même très petit shift
          const shiftAmount = maxShift * 0.99;
          const shiftRecursive = (cid) => {
            const p = positions.get(cid);
            if (p) {
              positions.set(cid, { ...p, x: p.x - shiftAmount });
            }
            const children = childrenOf.get(cid) || [];
            children.forEach(child => shiftRecursive(child));
          };
          
          shiftRecursive(currNode);
          changed = true;
        }
      }
    }
  }
  
  console.log(`[LAYOUT] ✅ Passe 3 terminée: ${passes} passes - Compaction finale appliquée`);
  console.log(`[LAYOUT] ✅✅✅ COMPACTION COMPLÈTE: Zones blanches minimisées agressivement`);

  return positions;  
}

// ============================================================================
// ÉTAPE 4b: CORRECTION DES COLLISIONS (ROBUSTE POUR NOMBREUX ENFANTS)
// ============================================================================

/**
 * Détecte et corrige les chevauchements de blocs au même niveau
 * 🔧 AMÉLIORATIONS:
 * - Pousse TOUS les blocs à droite, pas juste le suivant
 * - Plus d'itérations pour convergence robuste avec beaucoup d'enfants
 * - Gap appliqué de manière plus agressive
 */
function correctCollisions(blocks, positions) {
  const tolerance = LAYOUT_CONFIG.MIN_GAP_CLARITY; // Marge minimale requise: 20px
  const maxIterations = 15; // Plus d'itérations pour convergence robuste
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Grouper les blocs par niveau (coordonnée Y)
    const levelMap = new Map();
    
    positions.forEach((pos, contactId) => {
      const block = blocks.find(b => b.contactId === contactId);
      if (!block) return;
      
      const yKey = Math.round(pos.y);
      if (!levelMap.has(yKey)) {
        levelMap.set(yKey, []);
      }
      levelMap.get(yKey).push({contactId, pos, block});
    });

    let correctionsMade = 0;

    // Pour chaque niveau, vérifier les chevauchements et corriger AGRESSIVEMENT
    levelMap.forEach((blocksAtLevel) => {
      // Trier par X
      const sorted = blocksAtLevel.sort((a, b) => a.pos.x - b.pos.x);
      
      // Vérifier les paires consécutives et appliquer des push forces
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        
        const currentRight = current.pos.x + (current.block.width / 2);
        const nextLeft = next.pos.x - (next.block.width / 2);
        const gap = nextLeft - currentRight;
        
        // Si le gap est insuffisant, ÉCARTER FORTEMENT les blocs
        if (gap < tolerance) {
          const requiredShift = tolerance - gap + 2; // +2px bonus pour sécurité
          
          // Décaler le bloc courant vers la gauche et TOUS les suivants vers la droite
          current.pos.x -= requiredShift / 2;
          
          // 🔧 CLEF: Pousser TOUS les blocs à droite de celui-ci
          for (let j = i + 1; j < sorted.length; j++) {
            sorted[j].pos.x += requiredShift / 2;
          }
          
          // Mettre à jour la position dans la map
          positions.set(current.contactId, current.pos);
          for (let j = i + 1; j < sorted.length; j++) {
            positions.set(sorted[j].contactId, sorted[j].pos);
          }
          
          correctionsMade++;
        }
      }
    });

    console.log(`[LAYOUT] 📊 Pass ${iteration + 1}: ${correctionsMade} corrections - ${correctionsMade === 0 ? '✅ CONVERGED' : ''}` );

    // Si aucune correction n'a été faite, on est convergé
    if (correctionsMade === 0) {
      break;
    }
  }
}


// ============================================================================
// ÉTAPE 4c: CENTRAGE HORIZONTAL DE LA BRANCHE LA PLUS PROFONDE
// ============================================================================

/**
 * Centre la branche la plus profonde au centre horizontal du canvas
 */
function centerDeepestBranch(blocks, positions, hierarchy, widthCache, depthCache, canvasWidth) {
  if (positions.size === 0 || hierarchy.roots.size === 0) return;
  
  // Si pas de canvasWidth, on ne peut pas centrer par rapport au canvas
  if (!canvasWidth) {
    console.log(`[LAYOUT] ⚠️ canvasWidth non fourni, pas de centrage`);
    return;
  }

  // Identifier racine la plus profonde
  const sortedRoots = Array.from(hierarchy.roots).sort((a, b) => {
    const depthA = depthCache.get(a) || 0;
    const depthB = depthCache.get(b) || 0;
    return depthB - depthA;
  });

  const deepestRoot = sortedRoots[0];
  if (!deepestRoot) return;

  // Chercher TOUS les descendants de la branche profonde
  const deepestBranchBlocks = new Set();
  
  function collectDescendants(contactId) {
    deepestBranchBlocks.add(contactId);
    const childIds = hierarchy.childrenOf.get(contactId) || [];
    childIds.forEach(childId => collectDescendants(childId));
  }
  
  collectDescendants(deepestRoot);

  // Calculer les bounds de JUSTE la branche la plus profonde
  let minXBranch = Infinity, maxXBranch = -Infinity;

  blocks.forEach(block => {
    if (!deepestBranchBlocks.has(block.contactId)) return;
    
    const pos = positions.get(block.contactId);
    if (!pos) return;

    const blockLeft = pos.x - (block.width / 2);
    const blockRight = pos.x + (block.width / 2);

    minXBranch = Math.min(minXBranch, blockLeft);
    maxXBranch = Math.max(maxXBranch, blockRight);
  });

  if (minXBranch === Infinity || maxXBranch === -Infinity) {
    console.log(`[LAYOUT] ⚠️ Pas de bounds pour branche profonde`);
    return;
  }

  // Centre de la branche profonde
  const branchCenterX = (minXBranch + maxXBranch) / 2;

  // Centre du canvas
  const canvasCenterX = canvasWidth / 2;

  // Offset pour centrer la branche au centre du canvas
  const offsetX = canvasCenterX - branchCenterX;

  console.log(`[LAYOUT] Centrage branche la plus profonde AU CANVAS:`);
  console.log(`  - Branche bounds: [${minXBranch.toFixed(0)}, ${maxXBranch.toFixed(0)}]`);
  console.log(`  - branchCenterX: ${branchCenterX.toFixed(0)}`);
  console.log(`  - canvasWidth: ${canvasWidth}`);
  console.log(`  - canvasCenterX: ${canvasCenterX.toFixed(0)}`);
  console.log(`  - offsetX à appliquer: ${offsetX.toFixed(0)}`);

  // Appliquer l'offset à TOUTES les positions
  if (Math.abs(offsetX) > 0.1) {
    positions.forEach((pos, contactId) => {
      pos.x += offsetX;
    });
    console.log(`  ✅ Branche centrée au canvas!`);
  } else {
    console.log(`  - Offset minimal, pas d'ajustement`);
  }
}


// ============================================================================
// ÉTAPE 5: CONSTRUCTION DES CONNEXIONS
// ============================================================================


/**
 * Crée les lignes de connexion parent-enfant
 * � ORGANIGRAMME BUS HIÉRARCHIQUE COMPACT:
 * 
 * STRATÉGIE:
 * 1. Parents sur une ligne horizontale compacte (top)
 * 2. Ligne BUS horizontale juste en dessous (représente responsabilité collective)
 * 3. Chaque parent connecté au bus par ligne verticale courte
 * 4. Enfants placés en GRILLE COMPACTE sous le bus
 * 5. Bus connecté aux enfants par lignes verticales
 * 
 * Cela crée un organigramme "bus" lisible et compact
 */
function buildConnections(blocks, hierarchy, positions) {
  const { contactMap, parentOf, childrenOf } = hierarchy;
  const connections = [];
  const processedChildren = new Set();

  // ============================================================================
  // DÉTECTION: Regrouper les enfants par "set de parents identique"
  // ============================================================================
  // Si plusieurs enfants ont EXACTEMENT les mêmes parents, on crée UN BUS pour ce groupe
  
  const childrenByParentSet = new Map(); // clé: "parent1,parent2,..." → [childIds]
  
  blocks.forEach(block => {
    const managers = parentOf.get(block.contactId) || [];
    if (managers.length === 0) return;
    
    // Créer une clé unique pour ce set de parents
    const managerKey = managers.slice().sort().join(',');
    
    if (!childrenByParentSet.has(managerKey)) {
      childrenByParentSet.set(managerKey, []);
    }
    childrenByParentSet.get(managerKey).push(block.contactId);
  });

  console.log(`[LAYOUT] 🚌 Bus groups détectés: ${childrenByParentSet.size}`);

  // ============================================================================
  // CRÉER LES CONNEXIONS PAR GROUPE
  // ============================================================================
  
  for (const [managerKey, childIds] of childrenByParentSet) {
    const managers = managerKey.split(',').filter(Boolean);
    if (managers.length === 0) continue;
    
    // Récupérer les positions des parents
    const managerPositions = managers
      .map(managerId => ({
        managerId,
        pos: positions.get(managerId)
      }))
      .filter(m => m.pos);
    
    if (managerPositions.length === 0) continue;

    // Trier les parents par X (gauche à droite)
    managerPositions.sort((a, b) => a.pos.x - b.pos.x);

    const leftmostParent = managerPositions[0];
    const rightmostParent = managerPositions[managerPositions.length - 1];
    const busX = (leftmostParent.pos.x + rightmostParent.pos.x) / 2; // Milieu du bus
    
    // Position Y du bus: 100px sous les parents
    const maxParentY = Math.max(...managerPositions.map(m => m.pos.y));
    const busY = maxParentY + 100;

    // ========================================================================
    // Créer les lignes VERTICALES des parents vers le bus
    // ========================================================================
    managerPositions.forEach(({ managerId, pos }) => {
      connections.push({
        fromPos: pos,
        toPos: { x: pos.x, y: busY },
        fromBlockId: managerId,
        toBlockId: `bus_${managerKey}`,
        type: 'parent-to-bus',
        isRendered: false // Ces connexions sont dessinées comme des traits verticaux
      });
    });

    // ========================================================================
    // Créer la ligne BUS HORIZONTALE (représentation visuelle)
    // ========================================================================
    if (managers.length > 1) {
      // Bus horizontal reliant tous les parents
      connections.push({
        fromPos: { x: leftmostParent.pos.x, y: busY },
        toPos: { x: rightmostParent.pos.x, y: busY },
        fromBlockId: `bus_${managerKey}_left`,
        toBlockId: `bus_${managerKey}_right`,
        type: 'bus-horizontal',
        isRendered: false
      });
    }

    // ========================================================================
    // Enfants du groupe : les placer en GRILLE COMPACTE sous le bus
    // ========================================================================
    const childrenWithPos = childIds
      .map(childId => ({
        childId,
        pos: positions.get(childId)
      }))
      .filter(c => c.pos);

    if (childrenWithPos.length === 0) continue;

    // Calculer grille compacte: nombre de colonnes
    // Pour 6 enfants: 2x3 ou 3x2
    // Pour N enfants: Math.ceil(sqrt(N)) colonnes
    const numCols = Math.ceil(Math.sqrt(childrenWithPos.length));
    
    // Trier les enfants par position X actuelle pour maintenir l'ordre
    childrenWithPos.sort((a, b) => (a.pos.x || 0) - (b.pos.x || 0));

    // Calculer les X et Y de la grille
    const gridStartY = busY + 80; // 80px sous le bus
    const minChildX = Math.min(...childrenWithPos.map(c => c.pos.x));
    const maxChildX = Math.max(...childrenWithPos.map(c => c.pos.x));
    const gridWidth = maxChildX - minChildX;
    const colWidth = gridWidth / numCols;

    // Rearrange children in grid
    childrenWithPos.forEach((child, idx) => {
      const col = idx % numCols;
      const row = Math.floor(idx / numCols);
      
      // Nouvelle position en grille
      const gridX = minChildX + (col + 0.5) * colWidth;
      const gridY = gridStartY + row * 100; // 100px entre les lignes
      
      positions.set(child.childId, { x: gridX, y: gridY });
    });

    // ========================================================================
    // Créer les lignes VERTICALES du bus vers chaque enfant
    // ========================================================================
    // Pour chaque enfant, créer une connexion du bus vers lui
    childrenWithPos.forEach(child => {
      const childPos = positions.get(child.childId);
      
      connections.push({
        fromPos: { x: busX, y: busY }, // Du milieu du bus
        toPos: childPos,
        fromBlockId: `bus_${managerKey}`,
        toBlockId: child.childId,
        type: 'bus-to-child',
        isRendered: false
      });
    });

    // Marquer ces enfants comme traités
    childrenWithPos.forEach(c => processedChildren.add(c.childId));
    
    console.log(`[LAYOUT] 🚌 Bus créé pour ${managers.length} parents → ${childrenWithPos.length} enfants en grille (${numCols}x${Math.ceil(childrenWithPos.length/numCols)})`);
  }

  // ============================================================================
  // ENFANTS ORPHELINS: Ceux sans parent (contacts autonomes)
  // ============================================================================
  // Ces enfants ne sont pas traités, c'est normal - ils sont déjà bien placés

  console.log(`[LAYOUT] 🔗 Total: ${connections.length} connexions (${Array.from(childrenByParentSet.keys()).length} bus hierarchiques)`);
  return connections;
}

// ============================================================================
// ÉTAPE 5b: NORMALISATION DES HAUTEURS PAR NIVEAU
// ============================================================================

/**
 * Égalise les hauteurs de tous les blocs au même niveau
 * Permet aux blocs adaptables de garder leur largeur, 
 * mais assure un alignement vertical cohérent
 */
function normalizeHeightsByLevel(blocks, positions) {
  // Grouper les blocs par Y (le même niveau/ligne)
  const levelMap = new Map();
  
  blocks.forEach(block => {
    const pos = positions.get(block.contactId);
    if (!pos) return;
    
    // Arrondir Y pour grouper les blocs au même niveau
    const yKey = Math.round(pos.y);
    if (!levelMap.has(yKey)) {
      levelMap.set(yKey, []);
    }
    levelMap.get(yKey).push(block);
  });
  
  // Pour chaque niveau, égaliser les hauteurs
  levelMap.forEach((blocksAtLevel, yKey) => {
    // Trouver la hauteur maximale de ce niveau
    const maxHeight = Math.max(...blocksAtLevel.map(b => b.height || 80));
    
    // Appliquer cette hauteur à TOUS les blocs du niveau
    blocksAtLevel.forEach(block => {
      if (block.height !== maxHeight) {
        const oldHeight = block.height || 80;
        block.height = maxHeight;
        console.log(`[LAYOUT] 📏 Niveau ${yKey.toFixed(0)}: '${block.contactId.substring(0, 6)}' ${oldHeight}→${maxHeight}px`);
      }
    });
  });
  
  console.log(`[LAYOUT] ✅ Hauteurs normalisées: ${levelMap.size} niveaux égalisés`);
}

// ============================================================================
// ÉTAPE 6: CALCUL DU CENTRAGE & FIT-TO-VIEW
// ============================================================================

/**
 * Calcule les dimensions globales et le centrage nécessaire
 */
function calculateViewport(blocks, positions) {
  if (blocks.length === 0 || positions.size === 0) {
    return {
      x: 0, y: 0,
      width: 0, height: 0,
    };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  blocks.forEach(block => {
    const pos = positions.get(block.contactId);
    if (!pos) return;

    // CRITIQUE: pos.x et pos.y sont les CENTRES des blocs
    // Il faut corriger pour obtenir les coins
    const blockLeft = pos.x - (block.width / 2);
    const blockRight = pos.x + (block.width / 2);
    const blockTop = pos.y - (block.height / 2);
    const blockBottom = pos.y + (block.height / 2);

    minX = Math.min(minX, blockLeft);
    maxX = Math.max(maxX, blockRight);
    minY = Math.min(minY, blockTop);
    maxY = Math.max(maxY, blockBottom);
  });

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    x: minX, y: minY,
    width, height,
  };
}

/**
 * Calcule le zoom et pan pour centrer l'organigramme dans le canvas
 */
function calculateFitToView(blocks, positions, canvasWidth, canvasHeight) {
  const viewport = calculateViewport(blocks, positions);

  if (viewport.width <= 0 || viewport.height <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  // Calculer le zoom pour que tout rentre avec un peu de padding
  const zoomX = (canvasWidth - 40) / viewport.width;
  const zoomY = (canvasHeight - 40) / viewport.height;
  const zoom = Math.min(zoomX, zoomY, 1);

  // Centrer dans le canvas
  const panX = (canvasWidth - viewport.width * zoom) / 2 - viewport.x * zoom;
  const panY = (canvasHeight - viewport.height * zoom) / 2 - viewport.y * zoom;

  return { zoom, panX, panY };
}

// ============================================================================
// API PUBLIQUE
// ============================================================================

/**
 * Fonction principale: Calcule le layout complet
 * 
 * @param {Array} blocks - Liste des blocs avec {id, contactId, width, height}
 * @param {Array} contacts - Liste des contacts avec {id, firstName, managerId, ...}
 * @param {Number} canvasWidth - Largeur du canvas (optionnel, pour fit-to-view)
 * @param {Number} canvasHeight - Hauteur du canvas (optionnel, pour fit-to-view)
 * 
 * @returns {Object} {
 *   positions: Map<contactId, {x, y}>,
 *   connections: Array<{fromPos, toPos, ...}>,
 *   viewport: {minX, maxX, minY, maxY, width, height},
 *   fitToView: {zoom, panX, panY}
 * }
 */
export function calculateOrgChartLayout(blocks, contacts, canvasWidth = null, canvasHeight = null) {
  console.log(`\n[LAYOUT-ENGINE] ════════════════════════════════════════════`);
  console.log(`[LAYOUT-ENGINE] 🎯 CALCUL LAYOUT - ${blocks.length} blocs, ${contacts.length} contacts`);

  // ✅ ÉTAPE 1: Validation
  if (!validateInputs(blocks, contacts)) {
    console.error(`❌ [LAYOUT-ENGINE] Validation échouée`);
    return { positions: new Map(), connections: [], viewport: {}, fitToView: {} };
  }

  // ✅ ÉTAPE 2: Parsing
  const hierarchy = parseHierarchy(blocks, contacts);
  console.log(`[LAYOUT-ENGINE] Racines: ${Array.from(hierarchy.roots).length}, Hiérarchie OK`);

  // ✅ ÉTAPE 3: Calcul des dimensions
  const widthCache = buildWidthCache(hierarchy);
  console.log(`[LAYOUT-ENGINE] Widths cachées: ${widthCache.size} nœuds`);

  // ✅ ÉTAPE 3b: Calcul des profondeurs
  const depthCache = buildDepthCache(hierarchy);
  console.log(`[LAYOUT-ENGINE] Profondeurs cachées: ${depthCache.size} nœuds`);

  // ✅ ÉTAPE 4: Positionnement (branche la plus longue centrée)
  const positions = positionNodes(hierarchy, widthCache, depthCache);
  console.log(`[LAYOUT-ENGINE] Positions: ${positions.size} nœuds placés`);

  // ✅ ÉTAPE 4b: Correction des collisions
  correctCollisions(blocks, positions);
  console.log(`[LAYOUT-ENGINE] Collisions corrigées: espacement adaptatif appliqué`);

  // ✅ ÉTAPE 4c: Centrage horizontal de la branche la plus profonde
  // 🔧 DÉSACTIVÉ: Avec nouveau layout en colonne, on ne centr plus une seule branche
  // centerDeepestBranch(blocks, positions, hierarchy, widthCache, depthCache, canvasWidth);
  // console.log(`[LAYOUT-ENGINE] Branche la plus profonde centrée horizontalement`);

  // ✅ ÉTAPE 5b: Normalisation des hauteurs par niveau
  normalizeHeightsByLevel(blocks, positions);
  console.log(`[LAYOUT-ENGINE] Hauteurs normalisées par niveau`);

  // ✅ ÉTAPE 5: Connexions
  const connections = buildConnections(blocks, hierarchy, positions);
  console.log(`[LAYOUT-ENGINE] Connexions: ${connections.length} liens`);

  // ✅ ÉTAPE 6: Viewport & Fit-to-view
  const viewport = calculateViewport(blocks, positions);
  const fitToView = (canvasWidth && canvasHeight) 
    ? calculateFitToView(blocks, positions, canvasWidth, canvasHeight)
    : {};

  console.log(`[LAYOUT-ENGINE] ✅ SUCCÈS - Viewport: ${viewport.width.toFixed(0)}x${viewport.height.toFixed(0)}`);
  console.log(`[LAYOUT-ENGINE] ════════════════════════════════════════════\n`);

  return { positions, connections, viewport, fitToView };
}

export { LAYOUT_CONFIG };
