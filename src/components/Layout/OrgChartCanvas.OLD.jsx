import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import '../../styles/layout/OrgChartCanvas.css';

function OrgChartCanvas({ selectedOrgChart = null, allContacts, onUpdateOrgChart, _onCreateOrgChart, displayFields, setDisplayFields }) {
  const [blocks, setBlocks] = useState(selectedOrgChart?.blocks || []);
  const [showFieldsPanel, setShowFieldsPanel] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = React.useRef(null);

  // 🔑 FONCTION PURE: Nouvel algorithme avec centrage CORRECT du parent
  const calculateOrgChartLayoutPure = (blocksToLayout, contactsData) => {
    if (!blocksToLayout || blocksToLayout.length === 0) {
      return { positions: new Map(), connections: [] };
    }

    console.log(`\n[LAYOUT-V3] ════════════════════════════════════════════`);
    console.log(`[LAYOUT-V3] 🎯 ALGORITHME V3 - ${blocksToLayout.length} blocs, ${contactsData.length} contacts\n`);

    // === SETUP ===
    const contactMap = new Map(contactsData.map(c => [c.id, c]));
    const blockMap = new Map(blocksToLayout.map(b => [b.contactId, b]));
    const positions = new Map();
    const connections = [];

    // 🔴 VALIDATION STRICTE: Tous les blocs doivent avoir un contact valide
    const invalidBlocks = blocksToLayout.filter(b => !contactMap.has(b.contactId));
    if (invalidBlocks.length > 0) {
      console.error(`[LAYOUT-V3] ❌ ${invalidBlocks.length} BLOCS INVALIDES (pas de contact):`);
      invalidBlocks.forEach(b => console.error(`   - Block ${b.id} → contactId "${b.contactId}" introuvable`));
      return { positions: new Map(), connections: [] };
    }

    console.log(`[LAYOUT-V3] ✅ Validation: tous les ${blocksToLayout.length} blocs ont un contact valide\n`);

    const LEVEL_HEIGHT = 200;
    const BLOCK_MIN_WIDTH = 180;
    const MIN_GAP = 15;
    const START_Y = 50;
    const START_X = 100;

    // === ÉTAPE 1: Construire l'arbre hiérarchique AVANT de séparer autonomes ===
    const childrenOf = new Map();
    const parentOf = new Map();

    blocksToLayout.forEach(block => {
      const contact = contactMap.get(block.contactId);
      if (!contact?.managerId || contact.managerId.trim() === '') {
        return; // Pas de parent
      }

      const managerId = contact.managerId;
      if (!childrenOf.has(managerId)) {
        childrenOf.set(managerId, []);
      }
      childrenOf.get(managerId).push(block.contactId);
      parentOf.set(block.contactId, managerId);
    });

    // === ÉTAPE 2: Identifier racines vs autonomes ===
    // Racines = contacts sans parent (managerId=null) ET manager de quelqu'un d'autre
    // Autonomes = contacts sans parent ET pas manager de quelqu'un d'autre (JAMAIS dans l'import Excel)
    const roots = new Set();
    const autonomousContactIds = new Set();

    blocksToLayout.forEach(block => {
      const contact = contactMap.get(block.contactId);
      if (!contact) return;

      const hasManager = contact.managerId && contact.managerId.trim() !== '';
      if (hasManager) {
        return; // N'est ni racine ni autonome
      }

      // Sans manager - vérifier si c'est une racine ou autonome
      const isManagerOfSomeone = childrenOf.has(block.contactId);
      if (isManagerOfSomeone) {
        roots.add(block.contactId); // Racine (gère des enfants)
      } else {
        autonomousContactIds.add(block.contactId); // Autonome (personne isolée)
      }
    });

    console.log(`[LAYOUT-V3] Racines: ${Array.from(roots).map(id => contactMap.get(id)?.firstName).join(', ')}`);
    console.log(`[LAYOUT-V3] Autonomes: ${Array.from(autonomousContactIds).map(id => contactMap.get(id)?.firstName).join(', ')}\n`);

    // === ÉTAPE 3: Calculer largeur de sous-arbre (BOTTOM-UP) ===
    console.log(`[LAYOUT-V3] 📏 ÉTAPE 3: Calcul des largeurs\n`);

    const subtreeWidths = new Map();

    const calcWidth = (contactId, visited = new Set()) => {
      if (visited.has(contactId)) return BLOCK_MIN_WIDTH;
      if (subtreeWidths.has(contactId)) return subtreeWidths.get(contactId);

      visited.add(contactId);

      const block = blockMap.get(contactId);
      const blockWidth = Math.max(block?.width || BLOCK_MIN_WIDTH, BLOCK_MIN_WIDTH);

      // Récursif: enfants
      const childIds = childrenOf.get(contactId) || [];
      let totalChildrenWidth = 0;

      childIds.forEach((childId, index) => {
        if (index > 0) totalChildrenWidth += MIN_GAP;
        const childWidth = calcWidth(childId, new Set(visited));
        totalChildrenWidth += childWidth;
      });

      // Largeur = max(bloc, enfants)
      const width = Math.max(blockWidth, totalChildrenWidth);
      subtreeWidths.set(contactId, width);

      return width;
    };

    roots.forEach(rootId => {
      calcWidth(rootId);
    });

    autonomousContactIds.forEach(contactId => {
      const block = blockMap.get(contactId);
      const width = Math.max(block?.width || BLOCK_MIN_WIDTH, BLOCK_MIN_WIDTH);
      subtreeWidths.set(contactId, width);
    });

    // === ÉTAPE 4: Placer les HIÉRARCHIQUES (TOP-DOWN avec centrage correct) ===
    console.log(`[LAYOUT-V3] 📍 ÉTAPE 4: Placement hiérarchique\n`);

    const placeNode = (contactId, centerX, y) => {
      positions.set(contactId, { x: centerX, y });

      const contact = contactMap.get(contactId);
      console.log(`[LAYOUT-V3]   ✓ "${contact?.firstName}" → (${centerX.toFixed(0)}, ${y})`);

      // Placer enfants
      const childIds = childrenOf.get(contactId) || [];
      if (childIds.length === 0) return;

      // 🔑 CLÉS:
      // 1. Calculer largeur totale des enfants
      // 2. Placer les enfants de gauche à droite
      // 3. Centrer le parent EXACTEMENT au-dessus du centre du groupe

      const childWidths = childIds.map(cid => subtreeWidths.get(cid) || BLOCK_MIN_WIDTH);
      const totalChildWidth = childWidths.reduce((sum, w) => sum + w + MIN_GAP, -MIN_GAP);

      // Placer les enfants centrés sous le parent
      let childStartX = centerX - (totalChildWidth / 2);
      const childY = y + LEVEL_HEIGHT;

      childIds.forEach((childId, index) => {
        const childWidth = childWidths[index];
        const childCenterX = childStartX + (childWidth / 2);
        placeNode(childId, childCenterX, childY);
        childStartX += childWidth + MIN_GAP;
      });
    };

    // Placer tous les arbres
    roots.forEach(rootId => {
      placeNode(rootId, START_X, START_Y);
    });

    // === ÉTAPE 5: Placer les AUTONOMES (séparation stricte) ===
    console.log(`\n[LAYOUT-V3] 🟢 ÉTAPE 5: Placement autonomes\n`);

    const autonomousIds = Array.from(autonomousContactIds).sort();
    if (autonomousIds.length > 0) {
      const autonomousWidths = autonomousIds.map(cid => subtreeWidths.get(cid) || BLOCK_MIN_WIDTH);
      const totalAutoWidth = autonomousWidths.reduce((sum, w) => sum + w + MIN_GAP, -MIN_GAP);

      // Placer en ligne SÉPARÉE au-dessus des hiérarchiques pour éviter chevauchement
      const autoY = START_Y - LEVEL_HEIGHT; // Ligne AVANT les hiérarchiques
      let autoX = START_X - (totalAutoWidth / 2);

      autonomousIds.forEach((contactId, index) => {
        const width = autonomousWidths[index];
        const centerX = autoX + (width / 2);
        positions.set(contactId, { x: centerX, y: autoY });

        const contact = contactMap.get(contactId);
        console.log(`[LAYOUT-V3]   🟢 AUTONOME "${contact?.firstName}" → (${centerX.toFixed(0)}, ${autoY})`);

        autoX += width + MIN_GAP;
      });
    }

    // === ÉTAPE 6: Construire les connexions avec positions calculées ===
    console.log(`\n[LAYOUT-V3] 🔗 ÉTAPE 6: Connexions\n`);

    blocksToLayout.forEach(block => {
      const contact = contactMap.get(block.contactId);
      if (!contact?.managerId || contact.managerId.trim() === '') {
        return;
      }

      const managerBlock = blocksToLayout.find(b => b.contactId === contact.managerId);
      if (!managerBlock) {
        console.warn(`[LAYOUT-V3] ⚠️ Manager block non trouvé pour ${contact.firstName}`);
        return;
      }

      const fromPos = positions.get(contact.managerId);
      const toPos = positions.get(block.contactId);

      if (!fromPos || !toPos) {
        console.warn(`[LAYOUT-V3] ⚠️ Position manquante pour ${contact.firstName}`);
        return;
      }

      connections.push({
        fromPos: fromPos,
        toPos: toPos,
        fromBlockId: managerBlock.id,
        toBlockId: block.id,
        fromBlockWidth: managerBlock.width,
        fromBlockHeight: managerBlock.height,
        toBlockWidth: block.width,
        toBlockHeight: block.height
      });

      const managerContact = contactMap.get(contact.managerId);
      console.log(`[LAYOUT-V3]   ✓ "${contact.firstName}" ← "${managerContact?.firstName}"`);
    });

    console.log(`\n[LAYOUT-V3] ✅ FIN - ${positions.size} positions, ${connections.length} connexions`);
    console.log(`[LAYOUT-V3] ════════════════════════════════════════════\n`);

    return { positions, connections };
  };

  // 🔑 Wrapper useCallback pour appeler la fonction pure
  // La fonction elle-même est pure (pas de dépendances de state)
  const calculateOrgChartLayout = useCallback(
    (blocksToLayout, blockSizeCalculator) => {
      // Recalculer les tailles avant le layout pour éviter les chevauchements!
      const blocksWithFreshSizes = blocksToLayout.map(block => {
        const freshSize = blockSizeCalculator(block.contactId);
        return {
          ...block,
          width: freshSize.width,
          height: freshSize.height
        };
      });
      return calculateOrgChartLayoutPure(blocksWithFreshSizes, allContacts);
    },
    [allContacts]
  );

  /**
   * Génère le contenu du bloc basé sur les champs sélectionnés
   */
  const getBlockContent = useCallback((contactId) => {
    const contact = allContacts.find((c) => c.id === contactId);
    if (!contact) {
      console.warn(`[CONTENT] ❌ Contact "${contactId}" NOT FOUND in allContacts (total: ${allContacts.length})`);
      return [];
    }

    console.log(`[CONTENT] Contact "${contact.firstName}":`, {
      contact_id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      age: contact.age,
      email: contact.email,
      phone: contact.phone,
      position: contact.position,
      agency: contact.agency,
      address: contact.address,
      displayFields
    });

    const content = [];
    content.push(`${contact.firstName} ${contact.lastName}`); // Nom toujours affiché

    if (displayFields.position && contact.position) {
      content.push(`📍 ${contact.position}`);
    }
    if (displayFields.agency && contact.agency) {
      content.push(`🏢 ${contact.agency}`);
    }
    // 🔍 DEBUG: Vérifier pourquoi l'âge ne s'affiche pas
    if (displayFields.age) {
      console.log(`[CONTENT-AGE] ${contact.firstName}: displayFields.age=${displayFields.age}, contact.age=${contact.age}, type=${typeof contact.age}`);
      if (contact.age !== undefined && contact.age !== null) {
        content.push(`🎂 ${contact.age} ans`);
      } else {
        console.log(`[CONTENT-AGE] ❌ Age est undefined/null pour ${contact.firstName}`);
      }
    }
    if (displayFields.email && contact.email) {
      content.push(`📧 ${contact.email}`);
    }
    if (displayFields.phone && contact.phone) {
      content.push(`📞 ${contact.phone}`);
    }
    if (displayFields.address && contact.address) {
      content.push(`🏠 ${contact.address}`);
    }

    console.log(`[CONTENT] Content final pour "${contact.firstName}":`, content);
    return content;
  }, [displayFields, allContacts]);

  /**
   * Calcule la taille adaptative d'un bloc basée sur son contenu
   */
  const calculateBlockSize = useCallback((contactId) => {
    const content = getBlockContent(contactId);
    
    // Dimensions minimum
    const minWidth = 180;
    const minHeight = 70;
    const lineHeight = 20;
    const padding = 16;
    
    // Calculer la largeur d'après le texte le plus long
    let maxLineWidth = 0;
    content.forEach(line => {
      // Estimation de largeur (~7.5px par caractère en moyenne avec police monospace)
      const estimatedWidth = line.length * 7.5;
      maxLineWidth = Math.max(maxLineWidth, estimatedWidth);
    });
    
    // Calculer hauteur d'après le nombre de lignes
    const width = Math.max(minWidth, maxLineWidth + padding);
    const height = Math.max(minHeight, (content.length * lineHeight) + padding);
    
    return { width: Math.ceil(width), height: Math.ceil(height) };
  }, [getBlockContent]);

  // Mettre à jour les blocks quand l'organigramme sélectionné change
  useEffect(() => {
    // 🔴 VALIDATION: Filtrer les blocs pour garder SEULEMENT ceux avec des contacts valides
    const validBlocks = (selectedOrgChart?.blocks || []).filter(block => {
      const isValid = allContacts.some(c => c.id === block.contactId);
      if (!isValid) {
        console.warn(`[LOAD-ORG] ⚠️ Suppression du bloc "${block.id}" → contactId "${block.contactId}" inexistant`);
      }
      return isValid;
    });

    if (validBlocks.length !== (selectedOrgChart?.blocks || []).length) {
      console.log(`[LOAD-ORG] 🧹 Nettoyage: ${(selectedOrgChart?.blocks || []).length} blocs → ${validBlocks.length} valides`);
    }

    setBlocks(validBlocks);
  }, [selectedOrgChart?.id, allContacts]);

  // 🔑 CRUCIAL: Utiliser useMemo au lieu de useEffect pour éviter les recalculs pendant le rendu
  // useMemo garantit qu'une valeur est calculée une SEULE fois par cycle de rendu
  // Pas de recalcul partiel visible = pas de scintillement
  const cachedLayoutMemo = useMemo(() => {
    if (blocks.length === 0 || !selectedOrgChart) {
      return { connections: [], positions: new Map(), needsUpdate: false };
    }

    console.log(`[LAYOUT-MEMO] Calcul du layout (${blocks.length} blocs)`);

    // 🔑 CRITIQUE: Passer calculateBlockSize pour recalculer les largeurs DANS le layout
    const { positions, connections } = calculateOrgChartLayout(blocks, calculateBlockSize);
    
    // Vérifier si layout changerait les positions
    let needsUpdate = false;
    blocks.forEach(block => {
      const newPos = positions.get(block.contactId);
      if (newPos && (block.x !== newPos.x || block.y !== newPos.y)) {
        needsUpdate = true;
      }
    });
    
    console.log(`[LAYOUT-MEMO] ✅ Layout calculé: ${positions.size} positions, ${connections.length} connexions (needs update: ${needsUpdate})`);
    
    return { positions, connections, needsUpdate };
  }, [blocks]);

  // 🎯 FitToView automatique au chargement
  const calculateFitToView = useCallback(() => {
    if (blocks.length === 0 || !canvasRef.current || cachedLayoutMemo.positions.size === 0) return;

    // 🔑 Utiliser les positions CALCULÉES au lieu de block.x/block.y
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    blocks.forEach(block => {
      const calcPos = cachedLayoutMemo.positions.get(block.contactId);
      const x = calcPos ? calcPos.x : block.x;
      const y = calcPos ? calcPos.y : block.y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + block.width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + block.height);
    });

    const width = maxX - minX;
    const height = maxY - minY;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height - 80; // Soustraire la hauteur du header

    if (width <= 0 || height <= 0 || !isFinite(minX)) return;

    // Calculer le zoom pour que tout rentre dans la vue
    const zoomX = (canvasWidth - 40) / width;
    const zoomY = (canvasHeight - 40) / height;
    const calculatedZoom = Math.min(zoomX, zoomY, 1);

    // Centrer et positionner
    const newPanX = -minX * calculatedZoom + (canvasWidth - width * calculatedZoom) / 2;
    const newPanY = -minY * calculatedZoom + (canvasHeight - height * calculatedZoom) / 2;

    setZoom(calculatedZoom);
    setPanX(newPanX);
    setPanY(newPanY);

    console.log(`[FIT-VIEW] Zoom: ${calculatedZoom.toFixed(2)}, Pan: (${newPanX.toFixed(0)}, ${newPanY.toFixed(0)})`);
  }, [blocks, cachedLayoutMemo.positions]);

  // Appliquer fit-to-view au montage ou quand les blocks changent
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateFitToView();
    }, 100);
    return () => clearTimeout(timer);
  }, [blocks, calculateFitToView]);

  // Gestion du zoom à la molette
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
    
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Recalculer le pan pour zoomer vers la souris
      const zoomDiff = newZoom - zoom;
      setPanX(panX - mouseX * zoomDiff);
      setPanY(panY - mouseY * zoomDiff);
    }

    setZoom(newZoom);
    console.log(`[ZOOM] Nouveau zoom: ${newZoom.toFixed(2)}`);
  }, [zoom, panX, panY]);

  // 🔑 NOUVEAU: Gestion du double-clic molette (button === 1) pour fit-to-view
  // Utiliser onMouseDown avec button check au lieu de onAuxClick qui n'est pas supporté partout
  const handleMouseDown = useCallback((e) => {
    // Bouton molette = 1 → fit-to-view
    if (e.button === 1) {
      e.preventDefault();
      console.log('[FIT-TO-VIEW] Molette détectée (button===1) - Ajustement du zoom');
      calculateFitToView();
      return; // Sortir pour ne pas déclencher le pan
    }
    
    // Bouton gauche = 0 → pan
    if (e.button !== 0) return;
    
    // Ne pas activer le pan si clic sur un block ou un élément
    if (e.target.closest('.org-block')) return;
    
    // Démarrer le pan
    setIsPanning(true);
    setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
  }, [calculateFitToView, panX, panY]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!isPanning) return;
    
    setPanX(e.clientX - panStart.x);
    setPanY(e.clientY - panStart.y);
  }, [isPanning, panStart]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Enregistrer les event listeners globaux pour le pan
  React.useEffect(() => {
    if (!isPanning) return;
    
    document.addEventListener('mousemove', handleCanvasMouseMove);
    document.addEventListener('mouseup', handleCanvasMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleCanvasMouseMove);
      document.removeEventListener('mouseup', handleCanvasMouseUp);
    };
  }, [isPanning, handleCanvasMouseMove, handleCanvasMouseUp]);

  // Calculer la position automatique pour un nouveau contact
  // 🔑 CRITIQUE: Créer un layout COMPLET incluant le nouveau contact pour obtenir sa position correcte
  const calculateHierarchicalPosition = useCallback((contactId) => {
    if (blocks.length === 0) {
      return { x: 80, y: 60 };
    }

    // 🔑 ÉTAPE CRITIQUE: Créer un layout temporaire avec le nouveau contact INCLUS
    // Cela garantit que sa position est calculée CORRECTEMENT dans son contexte hiérarchique réel
    const tempBlock = {
      id: `temp_${contactId}`,
      contactId,
      x: 0,
      y: 0,
      width: 200,
      height: 100
    };

    // Les blocs temporaires incluent TOUS les blocs actuels + le nouveau
    const tempBlocks = [...blocks, tempBlock];
    
    console.log(`[CALC-POS] Calcul de position pour nouveau contact: ${contactId}`);
    console.log(`[CALC-POS]   Blocs actuels: ${blocks.length}, Blocs temporaires (avec nouveau): ${tempBlocks.length}`);
    
    // Recalculer le layout COMPLET avec tous les contacts
    const { positions } = calculateOrgChartLayout(tempBlocks, calculateBlockSize);
    const pos = positions.get(contactId) || { x: 80, y: 60 };

    console.log(`[CALC-POS]   Position calculée pour ${contactId}: (${pos.x}, ${pos.y})`);
    return pos;
  }, [blocks, calculateOrgChartLayout]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    console.log('[DragOver] Canvas zone - prêt à recevoir le contact');
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DragEnter] 🔵 Contact ENTRE dans la zone de drop');
    console.log('[DragEnter] Types disponibles:', e.dataTransfer.types);
  };

  const handleDragLeave = (e) => {
    // Ne pas appeler preventDefault/stopPropagation sur dragLeave
    // car cela peut empêcher les dragenter/dragover des enfants
    console.log('[DragLeave] Contact quitte la zone de drop');
  };

  const handleDrop = (e) => {
    console.log('\n[🎯 OrgChartCanvas-DROP] ╔════════════════════════════════════════════╗');
    console.log('[🎯 OrgChartCanvas-DROP] ║ CONTACT DÉPOSÉ SUR LE CANVAS              ║');
    console.log('[🎯 OrgChartCanvas-DROP] ╚════════════════════════════════════════════╝');
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[🎯 OrgChartCanvas-DROP] Zone cible: CANVAS VISUALISATION');
    
    const contactJson = e.dataTransfer.getData('contact');
    console.log('[🎯 OrgChartCanvas-DROP] Données reçues:', contactJson ? '✅ Oui' : '❌ Non');
    
    if (!contactJson) {
      console.warn('[🎯 OrgChartCanvas-DROP] ⚠️ Aucune donnée contact');
      return;
    }
    
    try {
      const contact = JSON.parse(contactJson);
      console.log('[🎯 OrgChartCanvas-DROP] Contact parsé:', contact.firstName, contact.lastName, 'ID:', contact.id);
      
      // 🔴 VALIDATION STRICTE: Le contact DOIT être dans allContacts
      const existsInAllContacts = allContacts.some(c => c.id === contact.id);
      if (!existsInAllContacts) {
        console.error('[🎯 OrgChartCanvas-DROP] ❌ ERREUR: Contact non trouvé dans allContacts (pas d\'import Excel)');
        alert('❌ Ce contact ne provient pas d\'un import Excel.\n\nSeuls les contacts importés peuvent être utilisés.');
        return;
      }
      console.log('[🎯 OrgChartCanvas-DROP] ✅ Contact validé: existe dans allContacts');
      
      if (!selectedOrgChart) {
        console.error('[🎯 OrgChartCanvas-DROP] ❌ ERREUR: Aucun organigramme sélectionné');
        return;
      }
      
      console.log('[🎯 OrgChartCanvas-DROP] Organigramme cible:', selectedOrgChart.name, 'ID:', selectedOrgChart.id);
      
      if (blocks.some(b => b.contactId === contact.id)) {
        console.warn('[🎯 OrgChartCanvas-DROP] ⚠️ Contact déjà présent dans l\'organigramme');
        return;
      }
      
      // 🔑 CRITIQUE: Calculer la position du nouveau contact dans le contexte COMPLET
      const { x, y } = calculateHierarchicalPosition(contact.id);
      console.log('[🎯 OrgChartCanvas-DROP] Position calculée:', { x, y });

      // Calculer la taille adaptée au contenu
      const size = calculateBlockSize(contact.id);

      const newBlock = {
        id: `block_${Date.now()}`,
        contactId: contact.id,
        x,
        y,
        width: size.width,
        height: size.height,
      };
      
      console.log('[🎯 OrgChartCanvas-DROP] Nouveau bloc créé:', newBlock.id);

      const newBlocks = [...blocks, newBlock];
      console.log('[🎯 OrgChartCanvas-DROP] Blocs total après ajout:', newBlocks.length);
      console.log('[🎯 OrgChartCanvas-DROP] ✅ Ajout au state BLOCS');
      
      // 🔑 CRITIQUE: Trigger un useEffect qui recalculera l'ARBRE COMPLET avec toutes les relations
      setBlocks(newBlocks);

      onUpdateOrgChart({
        ...selectedOrgChart,
        blocks: newBlocks,
      });
      
      console.log('[🎯 OrgChartCanvas-DROP] ✅ SUCCÈS: Contact ajouté au canvas');
      console.log('[🎯 OrgChartCanvas-DROP] 🔄 useEffect vas recalculer l\'arbre complet');
      console.log('[🎯 OrgChartCanvas-DROP] ╚════════════════════════════════════════════╝\n');
    } catch (err) {
      console.error('[🎯 OrgChartCanvas-DROP] ❌ ERREUR:', err);
    }
  };

  const handleBlockDragStart = () => {
    // 🔴 BLOQUÉ: Plus de drag manuel - tout est auto-organisé par l'algorithme
  };

  const handleBlockDrop = () => {
    // 🔴 BLOQUÉ: Plus de drop manuel - tout est auto-organisé par l'algorithme
  };

  const getContactName = (contactId) => {
    const contact = allContacts.find((c) => c.id === contactId);
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';
  };

  /**
   * Bascule l'affichage d'un champ
   */
  const toggleField = (fieldName) => {
    setDisplayFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  // Mettre à jour la taille des blocs quand les champs affichés changent
  useEffect(() => {
    if (blocks.length === 0) return;
    
    const updatedBlocks = blocks.map(block => {
      const newSize = calculateBlockSize(block.contactId);
      return {
        ...block,
        width: newSize.width,
        height: newSize.height
      };
    });
    
    // Ne mettre à jour que si au moins une taille a changé
    if (updatedBlocks.some((b, i) => b.width !== blocks[i].width || b.height !== blocks[i].height)) {
      console.log(`[FIELDS-TOGGLE] Mise à jour de la taille de ${blocks.length} blocs`);
      setBlocks(updatedBlocks);
      onUpdateOrgChart({
        ...selectedOrgChart,
        blocks: updatedBlocks,
      });
    }
  }, [displayFields, calculateBlockSize, selectedOrgChart, onUpdateOrgChart]);

  if (!selectedOrgChart) {
    return (
      <div className="orgchart-canvas">
        <div className="canvas-empty">
          <h2>📋 Sélectionnez un organigramme</h2>
          <p>ou créez-en un nouveau</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="orgchart-canvas"
      tabIndex={-1}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="canvas-header" onDragLeave={(e) => e.stopPropagation()} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div className="header-title">
          <h2>{selectedOrgChart.name}</h2>
          <p className="canvas-info">{blocks.length} bloc(s) | Zoom: {(zoom * 100).toFixed(0)}%</p>
        </div>

        {/* Bouton pour afficher/masquer le panneau de sélection des champs */}
        <button 
          className="btn-fields-panel"
          onClick={() => setShowFieldsPanel(!showFieldsPanel)}
          title="Sélectionner les champs à afficher"
        >
          ⚙️ Champs
        </button>
      </div>

      {/* Panneau de sélection des champs */}
      {showFieldsPanel && (
        <div className="fields-panel">
          <h3>📋 Champs à Afficher</h3>
          <div className="fields-list">
            <label className="field-checkbox">
              <input 
                type="checkbox" 
                checked={displayFields.position} 
                onChange={() => toggleField('position')}
              />
              <span>📍 Poste</span>
            </label>
            <label className="field-checkbox">
              <input 
                type="checkbox" 
                checked={displayFields.agency} 
                onChange={() => toggleField('agency')}
              />
              <span>🏢 Agence</span>
            </label>
            <label className="field-checkbox">
              <input 
                type="checkbox" 
                checked={displayFields.age} 
                onChange={() => toggleField('age')}
              />
              <span>🎂 Âge</span>
            </label>
            <label className="field-checkbox">
              <input 
                type="checkbox" 
                checked={displayFields.email} 
                onChange={() => toggleField('email')}
              />
              <span>📧 Email</span>
            </label>
            <label className="field-checkbox">
              <input 
                type="checkbox" 
                checked={displayFields.phone} 
                onChange={() => toggleField('phone')}
              />
              <span>📞 Téléphone</span>
            </label>
            <label className="field-checkbox">
              <input 
                type="checkbox" 
                checked={displayFields.address} 
                onChange={() => toggleField('address')}
              />
              <span>🏠 Adresse</span>
            </label>
          </div>
        </div>
      )}

      <div
        className="canvas-area"
        tabIndex={-1}
        onDragLeave={(e) => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        ref={canvasRef}
        style={{
          overflow: 'auto',
          position: 'relative',
          width: '100%',
          flex: 1,
          cursor: isPanning ? 'grabbing' : 'grab'
        }}
      >
        {/* Wrapper pour zoom et pan - contient SVG ET blocs */}
        <div
          className="canvas-wrapper"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transformOrigin: 'top left',
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transition: 'none',
            width: '100%',
            minHeight: '100%'
          }}
        >
          {/* SVG pour les lignes parent-enfant - À L'INTÉRIEUR du wrapper */}
          {blocks.length > 0 && cachedLayoutMemo.connections.length > 0 && (
            <svg 
              className="org-connections" 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
                overflow: 'visible'
              }}
            >
              {cachedLayoutMemo.connections.map((conn, idx) => {
                // 🔑 CRUCIAL: Utiliser les positions CALCULÉES, pas les coordonnées de bloc!
                const fromPos = conn.fromPos;
                const toPos = conn.toPos;
                
                if (!fromPos || !toPos) return null;

                // Coordonnées sans zoom (le transform l'appliquera)
                const fromX = fromPos.x + conn.fromBlockWidth / 2;
                const fromY = fromPos.y + conn.fromBlockHeight;
                const toX = toPos.x + conn.toBlockWidth / 2;
                const toY = toPos.y;

                const midY = (fromY + toY) / 2;

                console.log(`[SVG] ${conn.fromBlockId} → ${conn.toBlockId}: (${fromX.toFixed(0)},${fromY}) → (${toX.toFixed(0)},${toY})`);

                return (
                  <g key={`conn-${idx}`}>
                    <line x1={fromX} y1={fromY} x2={fromX} y2={midY} stroke="#0A4866" strokeWidth="2" opacity="0.6" />
                    <line x1={fromX} y1={midY} x2={toX} y2={midY} stroke="#0A4866" strokeWidth="2" opacity="0.6" />
                    <line x1={toX} y1={midY} x2={toX} y2={toY} stroke="#0A4866" strokeWidth="2" opacity="0.6" />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Blocs de contacts */}
          {blocks.length === 0 ? (
            <div className="canvas-hint">
              Glissez les contacts depuis le volet gauche pour créer les blocs
            </div>
          ) : (
            blocks.map((block) => {
              // 🔑 CRUCIAL: Utiliser la position calculée, pas block.x/block.y
              const calculatedPos = cachedLayoutMemo.positions.get(block.contactId);
              const displayX = calculatedPos ? calculatedPos.x : block.x;
              const displayY = calculatedPos ? calculatedPos.y : block.y;
              
              return (
              <div
                key={block.id}
                className="org-block"
                style={{
                  left: `${displayX}px`,
                  top: `${displayY}px`,
                  width: `${block.width}px`,
                  height: `${block.height}px`,
                  zIndex: 2
                }}
                draggable={false}
                onDragStart={(e) => handleBlockDragStart(e, block.id)}
                onDragOver={handleDragOver}
                onDrop={handleBlockDrop}
              >
                <div className="block-content">
                  {getBlockContent(block.contactId).map((line, idx) => (
                    <div 
                      key={idx} 
                      className={idx === 0 ? 'block-name' : 'block-info'}
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <button
                  className="block-delete"
                  onClick={() => {
                    const updatedBlocks = blocks.filter((b) => b.id !== block.id);
                    setBlocks(updatedBlocks);
                    if (selectedOrgChart) {
                      onUpdateOrgChart({
                        ...selectedOrgChart,
                        blocks: updatedBlocks,
                      });
                    }
                  }}
                >
                  ✕
                </button>
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default OrgChartCanvas;

OrgChartCanvas.propTypes = {
  selectedOrgChart: PropTypes.object,
  allContacts: PropTypes.arrayOf(PropTypes.object).isRequired,
  onUpdateOrgChart: PropTypes.func.isRequired,
  _onCreateOrgChart: PropTypes.func,
  displayFields: PropTypes.object.isRequired,
  setDisplayFields: PropTypes.func.isRequired,
};
