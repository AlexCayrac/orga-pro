import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
// ELK removed: using simple local layout instead
import { LayoutSnapshot } from '../../services/LayoutSnapshotService';
import { LAYOUT_CONFIG } from '../../modules/layout/layoutEngine';
import '../../styles/layout/OrgChartCanvas.css';

/**
              
// Additional comments or code can be added here if necessary.
 * 
 * Responsabilités:
 * 1. Gérer l'état local (zoom, pan)
 * 2. Calculer les tailles de blocs (via getBlockContent)
 * 3. Appeler ELK pour le positionnement hiérarchique
 * 4. Utiliser DIRECTEMENT les coordonnées ELK (pas de recalcul)
 * 5. Renderer les edges via routing orthogonal ELK
 * 6. Appliquer le fit-to-view automatique
 */

const OrgChartCanvasComponent = ({ 
  selectedOrgChart = null, 
  allContacts, 
  onUpdateOrgChart, 
  displayFields, 
  setDisplayFields 
}, ref) => {
  // ============================================================================
  // STATE
  // ============================================================================
  const [blocks, setBlocks] = useState(selectedOrgChart?.blocks || []);
  const [showFieldsPanel, setShowFieldsPanel] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [colorMenuContactId, setColorMenuContactId] = useState(null);
  const [colorMenuPos, setColorMenuPos] = useState({ x: 0, y: 0 });
  const [currentColor, setCurrentColor] = useState('#0A4866');
  const [pendingBackgroundColor, setPendingBackgroundColor] = useState(null); // Couleur en attente d'application
  const [customColors, setCustomColors] = useState([
    { name: 'Custom 1', hex: '#0A4866' },
    { name: 'Custom 2', hex: '#ec4899' },
    { name: 'Custom 3', hex: '#f97316' },
    { name: 'Custom 4', hex: '#22c55e' }
  ]);
  const [photoCache, setPhotoCache] = useState({}); // Cache: contactId -> photoUrl
  const photoCacheRef = useRef(photoCache);
  // Fallback local display fields in case parent setter is unavailable
  const defaultDisplayFields = {
    position: true,
    agency: false,
    age: false,
    email: false,
    phone: false,
    photo: false,
    localisation: false,
    anciennete: false,
  };
  const [localDisplayFields, setLocalDisplayFields] = useState(displayFields || defaultDisplayFields);
  useEffect(() => { if (displayFields) setLocalDisplayFields(displayFields); }, [displayFields]);

  const safeSetDisplayFields = (newFields) => {
    try {
      if (typeof setDisplayFields === 'function') {
        setDisplayFields(newFields);
      } else {
        setLocalDisplayFields(newFields);
      }
    } catch (e) {
      setLocalDisplayFields(newFields);
    }
  };
  
  const canvasRef = useRef(null);
  const blockRefsMap = useRef(new Map()); // Pour enregistrer les références aux éléments DOM
  const connectionsSvgRef = useRef(null);
  const [domLines, setDomLines] = useState([]);
  const [elkLayout, setElkLayout] = useState(null);
  const [elkError, setElkError] = useState(null);
  const shouldFitToViewRef = useRef(false); // Flag pour déclencher fitToView après un drop
  // (plus besoin de stemBranchLengthRef ni lastBlockHeightRef ; calcul par groupe maintenant)
  // (no snapshot fallback — ELK is authoritative)
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 700 });
  const [layoutSnapshot, setLayoutSnapshot] = useState(null); // Source unique de vérité pour le layout

  // Note: automatic recentering removed — ELK coordinates are authoritative


  // Palette de couleurs nuancier
  const COLOR_PALETTE = [
    { name: 'Défaut', hex: '#0A4866' },
    { name: 'Rose', hex: '#ec4899' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Ambre', hex: '#eab308' },
    { name: 'Vert', hex: '#22c55e' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Indigo', hex: '#4f46e5' },
    { name: 'Violet', hex: '#a855f7' },
    { name: 'Rose foncé', hex: '#be185d' },
    { name: 'Rouge', hex: '#ef4444' },
    { name: 'Lime', hex: '#84cc16' },
    { name: 'Teal', hex: '#14b8a6' },
    { name: 'Bleu', hex: '#3b82f6' },
    { name: 'Pourpre', hex: '#8b5cf6' },
    { name: 'Gris', hex: '#64748b' },
    { name: 'Marron', hex: '#92400e' },
  ];

  // ============================================================================
  // RÉACTIF: Charger les blocs quand l'organigramme change
  // ============================================================================
  useEffect(() => {
    // Si la liste des contacts est vide, NE PAS supprimer les blocs automatiquement.
    // Cela évite la perte visuelle lorsque les contacts n'ont pas encore été chargés
    // (ex: import partiel, démarrage, ou application de diffs conservative).
    if (!allContacts || allContacts.length === 0) {
      console.log('[CANVAS] ⚠️ allContacts vide — conservation des blocs existants (pas de suppression automatique)');
      setBlocks(selectedOrgChart?.blocks || []);
      return;
    }

    const validBlocks = (selectedOrgChart?.blocks || []).filter(block => {
      const isValid = allContacts.some(c => c.id === block.contactId);
      if (!isValid) {
        console.warn(`[CANVAS] Suppression du bloc "${block.id}" → contactId "${block.contactId}" invalide`);
      }
      return isValid;
    });

    setBlocks(validBlocks);
  }, [selectedOrgChart, allContacts]);

  // Load photos for all contacts via IPC
  useEffect(() => {
    console.log('[CANVAS-PHOTO] 🚀 useEffect déclenché');
    console.log('[CANVAS-PHOTO] displayFields.photo:', displayFields.photo);
    console.log('[CANVAS-PHOTO] allContacts.length:', allContacts.length);
    console.log('[CANVAS-PHOTO] window.electronAPI exists:', !!window.electronAPI);

    if (!displayFields.photo || !allContacts.length || !window.electronAPI) {
      console.log('[CANVAS-PHOTO] ❌ Condition non remplie, sortie précoce');
      return;
    }

    const loadPhotos = async () => {
      console.log('[CANVAS-PHOTO] 📸 Démarrage loadPhotos pour', allContacts.length, 'contacts');
      const newCache = { ...photoCacheRef.current };

      for (const contact of allContacts) {
        console.log(`[CANVAS-PHOTO] Traitement: ${contact.firstName} ${contact.lastName} (ID: ${contact.id})`);

        if (!newCache[contact.id]) {
          try {
            console.log(`[CANVAS-PHOTO] ➡️  Appel IPC pour: ${contact.firstName} ${contact.lastName} (matricule: ${contact.matricule || 'N/A'})`);
            const photoUrl = await window.electronAPI.findPhotoForContact(
              contact.firstName,
              contact.lastName,
              contact.matricule || ''
            );
            console.log(`[CANVAS-PHOTO] ✅ Réponse IPC: ${photoUrl || 'null'}`);
            if (photoUrl) {
              // update state incrementally to avoid re-scanning the entire list on each change
              setPhotoCache(prev => {
                const merged = { ...prev, [contact.id]: photoUrl };
                photoCacheRef.current = merged;
                return merged;
              });
              console.log(`[CANVAS-PHOTO] 💾 Photo ajoutée au cache pour ${contact.firstName}`);
            }
          } catch (err) {
            console.error('[CANVAS-PHOTO] ❌ Erreur IPC photo:', err);
          }
        } else {
          console.log(`[CANVAS-PHOTO] ℹ️  ${contact.firstName} déjà en cache`);
        }
      }

      console.log('[CANVAS-PHOTO] ✅ loadPhotos terminé');
    };

    loadPhotos();
  }, [allContacts, displayFields.photo]);

  // keep ref in sync to allow reading cache without creating hook dependency loops
  useEffect(() => { photoCacheRef.current = photoCache; }, [photoCache]);

  // NOTE: recenterChart removed - no automatic or implicit recentring

  // ============================================================================
  // MÉTHODES IMPERATIVES EXPOSÉES AU PARENT
  // ============================================================================
  // (Déplacé au top du composant)

  // ============================================================================
  // CALCUL DES TAILLES DE BLOCS
  // ============================================================================
  const getBlockContent = useCallback((contactId) => {
    const contact = allContacts.find(c => c.id === contactId);
    if (!contact) {
      return [];
    }

    const content = [];
    content.push(`${contact.firstName} ${contact.lastName}`);

    if (displayFields.position && contact.position) {
      content.push(`📍 ${contact.position}`);
    }
    if (displayFields.agency && contact.agency) {
      content.push(`🏢 Agence de ${contact.agency}`);
    }
    if (displayFields.age && contact.age !== undefined && contact.age !== null) {
      content.push(`🎂 ${contact.age} ans`);
    }
    if (displayFields.email && contact.email) {
      content.push(`📧 ${contact.email}`);
    }
    if (displayFields.phone && contact.phone) {
      content.push(`📞 ${contact.phone}`);
    }
    // Note: we no longer push photoPath as a text line here because
    // the photo is rendered as an image on the left. Size calculation
    // will account for reserved image width when necessary.
    if (displayFields.localisation && contact.localisation) {
      content.push(`🏙️ Habite à ${contact.localisation}`);
    }
    if (displayFields.anciennete && contact.anciennete) {
      const uniteAnciennete = contact.anciennete <= 1 ? 'an' : 'ans';
      content.push(`⏳ Ancienneté : ${contact.anciennete} ${uniteAnciennete}`);
    }

    return content;
  }, [displayFields, allContacts]);

  // Mesurer la largeur du texte avec Canvas pour plus de précision
  const measureTextWidth = useCallback((text, fontSize = 12) => {
    if (typeof document === 'undefined') return text.length * 7; // Fallback
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return text.length * 7;
    
    ctx.font = `normal ${fontSize}px system-ui, -apple-system, sans-serif`;
    return ctx.measureText(text).width;
  }, []);

  const calculateBlockSize = useCallback((contactId) => {
    const contact = allContacts.find(c => c.id === contactId);
    const content = getBlockContent(contactId);
    const lineHeight = 18; // Hauteur de ligne standard
    const padding = 8; // Padding interne standard
    const fontSize = 12;

    // Calculer la largeur en fonction du contenu (ligne la plus longue)
    let maxLineWidth = 0;
    content.forEach(line => {
      const lineWidth = measureTextWidth(line, fontSize);
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
    });

    // Si l'affichage photo est activé, réserver une largeur adaptive pour l'image
    // L'idée: hauteur du bloc = padding + contenu textuel + padding
    // La photo prendra la hauteur complète du contenu (première à dernière ligne)
    const contentHeight = padding + (content.length * lineHeight) + padding;
    let reserveImage = 0;
    if (displayFields.photo) {
      // image width will be roughly the content height (minus some padding), clamped
      const desired = Math.floor(contentHeight * 0.9);
      reserveImage = Math.max(48, Math.min(desired, 140));
    }
    const imageGap = reserveImage > 0 ? 8 : 0;

    // Ajouter le padding horizontal et la réserve pour l'image
    const calculatedWidth = maxLineWidth + padding + padding + reserveImage + imageGap;
    
    // Largeur minimale adaptée: basée sur le contenu réel + padding
    // Pas de forçage à 180px arbitraire - on utilise juste le contenu
    const adaptiveMinWidth = Math.max(calculatedWidth, 130); // minimum de 130px pour les blocs très courts
    const width = adaptiveMinWidth;

    // Height: nombre de lignes * lineHeight + padding
    const height = padding + (content.length * lineHeight) + padding;

    // Si une image est plus haute, on s'assure que la hauteur est au moins image height + padding
    const minImageHeight = reserveImage > 0 ? (reserveImage + padding) : 0;
    const finalHeight = Math.max(height, minImageHeight);

    return { width, height: finalHeight };
  }, [getBlockContent, measureTextWidth, allContacts, displayFields]);

  // ============================================================================
  // CALCUL PRINCIPAL DU LAYOUT (avec engine professionnel)
  // ============================================================================
  // LAYOUT: constantes ELK fixes (dimensions exactes demandées)
  // NOTE: déclarées AVANT `blocksWithSizes` pour éviter les ReferenceError
  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 70;

  // Calculer les blocs avec leurs tailles finales basées sur le contenu et les champs d'affichage
  const blocksWithSizes = useMemo(() => {
    if (blocks.length === 0 || !selectedOrgChart) {
      return [];
    }

    // Calculer les tailles réelles basées sur les champs d'affichage choisis
    return blocks.map(block => {
      const size = calculateBlockSize(block.contactId);
      return {
        ...block,
        width: size.width,
        height: size.height
      };
    });
  }, [blocks, calculateBlockSize, selectedOrgChart]);

  // Compute DOM-based SVG connection paths using element positions or ELK routing points.
  useEffect(() => {
    const compute = () => {
      if (!connectionsSvgRef.current || !elkLayout) {
        setDomLines([]);
        return;
      }

      const svgRect = connectionsSvgRef.current.getBoundingClientRect();
      const scale = (zoom && zoom > 0) ? zoom : 1;
      const paths = [];

      // Prefer ELK-provided edge routing if available
      const elkEdges = Array.isArray(elkLayout.edges) ? elkLayout.edges : [];

      elkEdges.forEach(edge => {
        const parentId = edge.sources && edge.sources[0];
        const childId = edge.targets && edge.targets[0];
        if (!parentId || !childId) return;

        const parentEl = blockRefsMap.current.get(parentId);
        const childEl = blockRefsMap.current.get(childId);
        if (!parentEl || !childEl) return;

        // If ELK provided route points, use them (convert from layout user units to SVG coords)
        if (edge.points && edge.points.length > 0) {
          const pts = edge.points.map(pt => ({ x: Math.round(pt.x), y: Math.round(pt.y) }));
          const d = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
          paths.push({ d, stroke: '#0A4866', strokeWidth: Math.max(1, 2.5 / scale), opacity: 0.95, markerEnd: 'org-arrow' });
          return;
        }

        // Fallback: compute elbow path between bottom-center of parent and top-center of child
        const pRect = parentEl.getBoundingClientRect();
        const cRect = childEl.getBoundingClientRect();
        const x1 = (pRect.left + (pRect.width / 2) - svgRect.left) / scale;
        const y1 = (pRect.bottom - svgRect.top) / scale;
        const x2 = (cRect.left + (cRect.width / 2) - svgRect.left) / scale;
        const y2 = (cRect.top - svgRect.top) / scale;

        const midY = y1 + (y2 - y1) * 0.5;
        const d = `M ${Math.round(x1)} ${Math.round(y1)} L ${Math.round(x1)} ${Math.round(midY)} L ${Math.round(x2)} ${Math.round(midY)} L ${Math.round(x2)} ${Math.round(y2)}`;
        paths.push({ d, stroke: '#0A4866', strokeWidth: Math.max(1, 2.5 / scale), opacity: 0.95, markerEnd: 'org-arrow' });
      });

      setDomLines(paths);
    };

    compute();
    const onResize = () => { window.requestAnimationFrame(compute); };
    window.addEventListener('resize', onResize);
    window.addEventListener('load', onResize);

    let mo;
    try {
      mo = new MutationObserver(() => window.requestAnimationFrame(compute));
      if (connectionsSvgRef.current && connectionsSvgRef.current.parentElement) {
        mo.observe(connectionsSvgRef.current.parentElement, { childList: true, subtree: true, attributes: true });
      }
    } catch (e) {
      // ignore observer errors on some platforms
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', onResize);
      if (mo) mo.disconnect();
    };
  }, [elkLayout, blocksWithSizes, zoom, panX, panY]);

  // ============================================================================
  // ELK STATE - Stocker le layout renvoyé par ELK
  // (moved above effects that reference `elkLayout` to avoid TDZ)
  // ============================================================================
  

  // ============================================================================
  // ELK STATE - Stocker le layout renvoyé par ELK
  // ============================================================================
  

  // ============================================================================
  // FONCTION PRINCIPALE: CALCUL DES POSITIONS VIA ELK (100% LOCAL, PROFESSIONNEL)
  // ============================================================================
  const computeElkLayout = useCallback(async (contacts, blockSizesMap = {}) => {
    // Simple deterministic layout: assign levels by manager relationships, then arrange in rows.
    if (!contacts || contacts.length === 0) return null;

    const NODE_SPACING_X = 60;
    const NODE_SPACING_Y = 120;

    // Build node map
    const nodes = contacts.map(c => ({ id: String(c.id), data: c, width: (blockSizesMap[String(c.id)]?.width) || NODE_WIDTH, height: (blockSizesMap[String(c.id)]?.height) || NODE_HEIGHT }));
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    // Build edges from managerId/managerIds
    const edges = [];
    nodes.forEach(n => {
      let managerIds = n.data.managerIds;
      if (!Array.isArray(managerIds)) {
        if (n.data.managerId) {
          if (typeof n.data.managerId === 'string' && (n.data.managerId.includes('/') || n.data.managerId.includes(';') || n.data.managerId.includes(','))) {
            managerIds = n.data.managerId.split(/[\/;,]+/).map(m => m.trim()).filter(Boolean);
          } else {
            managerIds = [n.data.managerId];
          }
        } else managerIds = [];
      }
      managerIds.forEach(mgr => {
        if (!mgr) return;
        const mid = String(mgr);
        if (nodeById.has(mid)) {
          edges.push({ id: `${mid}->${n.id}`, sources: [mid], targets: [n.id] });
        }
      });
    });

    // Determine levels (BFS from roots)
    const inDegree = new Map(nodes.map(n => [n.id, 0]));
    edges.forEach(e => { const t = e.targets[0]; inDegree.set(t, (inDegree.get(t) || 0) + 1); });
    const queue = [];
    inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });
    // If no roots (cycle), treat all as roots
    if (queue.length === 0) nodes.forEach(n => queue.push(n.id));

    const level = {};
    queue.forEach(id => { level[id] = 0; });
    // adjacency list for forward edges
    const adj = new Map();
    nodes.forEach(n => adj.set(n.id, []));
    edges.forEach(e => { const s = e.sources[0]; const t = e.targets[0]; if (adj.has(s)) adj.get(s).push(t); });

    // simple BFS/topological propagation
    const q = [...queue];
    while (q.length) {
      const cur = q.shift();
      const curLevel = level[cur] || 0;
      (adj.get(cur) || []).forEach(nb => {
        const proposed = curLevel + 1;
        if (level[nb] === undefined || level[nb] < proposed) {
          level[nb] = proposed;
        }
        q.push(nb);
      });
    }

    // Group by level
    const levels = new Map();
    nodes.forEach(n => {
      const lv = level[n.id] || 0;
      if (!levels.has(lv)) levels.set(lv, []);
      levels.get(lv).push(n);
    });

    // Assign positions
    const children = [];
    const sortedLevels = Array.from(levels.keys()).sort((a,b)=>a-b);
    sortedLevels.forEach((lv, i) => {
      const row = levels.get(lv);
      let x = 0;
      row.forEach((n, idx) => {
        const px = x;
        const py = lv * (NODE_SPACING_Y + (n.height || NODE_HEIGHT));
        children.push({ id: n.id, x: px, y: py, width: n.width, height: n.height });
        x += n.width + NODE_SPACING_X;
      });
    });

    return { children, edges };
  }, []);

  // ============================================================================
  // USEEFFECT: APPELER ELK QUAND contacts/orgchart CHANGENT
  // ============================================================================
  useEffect(() => {
    console.log('[ELK-EFFECT] Trigger: selectedOrgChart=', !!selectedOrgChart, 'contacts=', allContacts?.length || 0);

    if (!selectedOrgChart || !allContacts || allContacts.length === 0) {
      console.log('[ELK-EFFECT] Pas de données valides');
      setElkLayout(null);
      setElkError(null);
      return;
    }

    // Fonction async IIFE pour appeler ELK
    (async () => {
      try {
        console.log('[ELK-EFFECT] Appel computeElkLayout...');
        // Ne layout que les contacts présents dans les blocs de l'organigramme
        // IMPORTANT: Trier les contacts par ID pour garantir un layout déterministe
        // peu importe l'ordre dans lequel ils ont été droppés
        const contactsToLayout = blocks
          .map(b => allContacts.find(c => String(c.id) === String(b.contactId)))
          .filter(Boolean)
          .sort((a, b) => {
            // Extraire la partie numérique de l'ID pour un tri numérique
            const aNum = parseInt(String(a.id).match(/\d+$/)?.[0] || 0, 10);
            const bNum = parseInt(String(b.id).match(/\d+$/)?.[0] || 0, 10);
            return aNum - bNum;
          });
        
        // Si pas de contacts à layout, c'est normal (organigramme vide ou chargement)
        if (contactsToLayout.length === 0) {
          console.log('[ELK-EFFECT] ⚠️ Aucun contact à layout (organigramme vide ou chargement)');
          setElkLayout(null);
          setElkError(null);
          return;
        }
        
        console.log('[ELK-EFFECT] Contacts triés par ID:', contactsToLayout.map(c => c.id));
        
        // Debug: vérifier quels contacts ont été filtrés
        const blocksWithMissingContacts = blocks.filter(b => !allContacts.find(c => String(c.id) === String(b.contactId)));
        if (blocksWithMissingContacts.length > 0) {
          console.warn('[ELK-EFFECT] ⚠️ Blocks sans contacts dans allContacts:', blocksWithMissingContacts.map(b => b.contactId));
          console.log('[ELK-EFFECT] allContacts IDs:', allContacts.map(c => c.id).slice(0, 10));
          console.log('[ELK-EFFECT] blocks IDs:', blocks.map(b => b.contactId));
        }
        
        console.log('[ELK-EFFECT] contactsToLayout:', contactsToLayout.length, 'blocks:', blocks.length);
        
        // Calculer les tailles réelles de chaque bloc basé sur les champs d'affichage
        const blockSizesMap = {};
        contactsToLayout.forEach(contact => {
          if (contact) {
            blockSizesMap[String(contact.id)] = calculateBlockSize(contact.id);
          }
        });
        console.log('[ELK-EFFECT] blockSizesMap:', blockSizesMap);
        
        const result = await computeElkLayout(contactsToLayout, blockSizesMap);
        if (result) {
          setElkLayout(result);
          setElkError(null);
          console.log('[ELK-EFFECT] ✅ Layout mis à jour');
          console.log('[ELK-EFFECT] elkLayout sample:', (result.children || []).slice(0,5).map(c => ({ id: c.id, x: c.x, y: c.y })));
        } else {
          console.warn('[ELK-EFFECT] Layout retourné null');
          setElkLayout(null);
          setElkError('Layout computation failed');
        }
      } catch (err) {
        console.error('[ELK-EFFECT] Erreur:', err);
        setElkLayout(null);
        setElkError('Layout computation failed');
      }
    })();
  }, [selectedOrgChart, allContacts, computeElkLayout, blocks, calculateBlockSize, displayFields]);

  // Pour compatibilité avec d'autres parties du code, créer un layoutResult adapté
  // NOTE: nous exposons les positions EXACTES fournies par ELK (pas de recentrage)
  const layoutResult = useMemo(() => {
    if (!elkLayout || !elkLayout.children) {
      return {
        positions: new Map(),
        connections: [],
        viewport: {},
        fitToView: {}
      };
    }

    const positions = new Map();
    elkLayout.children.forEach(child => {
      positions.set(String(child.id), {
        x: child.x || 0,
        y: child.y || 0,
        width: child.width || NODE_WIDTH,
        height: child.height || NODE_HEIGHT
      });
    });

    return {
      positions,
      connections: [],
      viewport: { x: 0, y: 0, width: elkLayout.width || 0, height: elkLayout.height || 0 },
      fitToView: {}
    };
  }, [elkLayout]);

  

  // Subscribers pour snapshot - pour permettre aux composants (ExportWindow) de s'abonner
  const snapshotSubscribersRef = useRef(new Set());

  // ============================================================================
  // CRÉER SNAPSHOT QUAND LE LAYOUT ELK CHANGE - Source unique de vérité
  // ============================================================================
  useEffect(() => {
    console.log('[CANVAS] 🔍 useEffect snapshot checker - elkLayout exists:', !!elkLayout, 'canvasDimensions:', canvasDimensions);

    // Utiliser directement elkLayout.children pour le snapshot
    const positionCount = elkLayout?.children?.length || 0;

    if (positionCount > 0 && canvasDimensions.width > 0) {
      console.log('[CANVAS] ✅ Snapshot VALIDE avec', positionCount, 'positions (ELK)');

      // Utiliser le bbox fourni par ELK si disponible, sinon calculer
      let viewport = { x: 0, y: 0, width: elkLayout.width || 0, height: elkLayout.height || 0 };
      if (!viewport.width || !viewport.height) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        elkLayout.children.forEach((child) => {
          const left = (child.x || 0);
          const top = (child.y || 0);
          const right = left + (child.width || NODE_WIDTH);
          const bottom = top + (child.height || NODE_HEIGHT);
          if (left < minX) minX = left;
          if (top < minY) minY = top;
          if (right > maxX) maxX = right;
          if (bottom > maxY) maxY = bottom;
        });
        if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
        viewport = {
          x: Math.floor(minX),
          y: Math.floor(minY),
          width: Math.ceil(Math.max(0, maxX - minX)),
          height: Math.ceil(Math.max(0, maxY - minY))
        };
      }

      const snapshotLayoutResult = {
        positions: layoutResult.positions,
        connections: [],
        viewport,
        fitToView: {}
      };

      const snapshot = new LayoutSnapshot(snapshotLayoutResult, canvasDimensions);
      setLayoutSnapshot(snapshot);
      console.log('[CANVAS] 📸 Snapshot créé et sauvegardé');

      // Notifier les abonnés
      try {
        if (snapshotSubscribersRef.current && snapshotSubscribersRef.current.size > 0) {
          snapshotSubscribersRef.current.forEach(cb => {
            try { cb(snapshot); } catch (err) { console.error('[CANVAS] Erreur callback subscriber', err); }
          });
          console.log('[CANVAS] 🔔 Notified', snapshotSubscribersRef.current.size, 'subscribers');
        }
      } catch (err) {
        console.error('[CANVAS] ❌ Erreur notifying subscribers', err);
      }
    } else {
      console.log('[CANVAS] ⚠️ ELK layout non disponible ou positions vides');
      // Ne pas utiliser de fallback automatique — afficher l'erreur si ELK a échoué
      setLayoutSnapshot(null);
      if (elkError) {
        console.error('[CANVAS] ELK error:', elkError);
      }
    }
  }, [elkLayout, canvasDimensions, elkError, layoutResult]);

  // ============================================================================
  // DÉCLENCHER FITTOVIEW AUTOMATIQUEMENT APRÈS UN DROP
  // ============================================================================
  // (déplacé plus bas, après la déclaration de `fitToView`)

  // Automatic recentring removed — the canvas preserves user pan/zoom and relies on ELK coordinates.

  // SUPPRIMÉ: Le useEffect qui mesure après snapshot changement créait une boucle infinie
  // (avait canvasDimensions dans les dépendances mais appelait setCanvasDimensions)
  // La mesure est maintenant gérée exclusivement par le useEffect() dessous avec ResizeObserver et polling

  // Ref pour tracker les dernières dimensions mesurées pour éviter les appels redondants à setState
  const lastKnownDimensionsRef = useRef({ width: 0, height: 0 });

  // ============================================================================
  // MESURE DES DIMENSIONS - Source unique de vérité
  // ============================================================================
  useEffect(() => {
    // 1. Mesurer IMMÉDIATEMENT si l'élément existe
    const measureCanvas = () => {
      if (!canvasRef.current) {
        console.log('[CANVAS] ⚠️ canvasRef.current n\'existe pas encore');
        return;
      }
      
      const rect = canvasRef.current.getBoundingClientRect();
      const width = rect.width > 0 ? rect.width : null;
      const height = rect.height > 0 ? rect.height : null;
      
      console.log('[CANVAS] 📏 Mesure canvas - rect:', { width: rect.width, height: rect.height }, 'valide:', width && height ? 'OUI' : 'NON');
      
      if (width && height) {
        // IMPORTANT: Vérifier si c'est vraiment différent avant d'appeler setState
        // Cela évite une boucle infinie de rendus
        const lastDimensions = lastKnownDimensionsRef.current;
        const hasChanged = lastDimensions.width !== width || lastDimensions.height !== height;
        
        if (hasChanged) {
          console.log('[CANVAS] ✅ Dimensions CHANGÉES:', { 
            from: lastDimensions, 
            to: { width, height } 
          });
          lastKnownDimensionsRef.current = { width, height };
          setCanvasDimensions({ width, height });
        } else {
          console.log('[CANVAS] 🔄 Dimensions INCHANGÉES - pas de setState');
        }
      } else {
        console.log('[CANVAS] ⚠️ Dimensions INVALIDES - rect.width:', rect.width, 'rect.height:', rect.height);
      }
    };

    // Mesurer immédiatement
    measureCanvas();

    // Mesurer avec délai (au cas où le DOM n'est pas prêt)
    const timer = setTimeout(measureCanvas, 100);
    const timer2 = setTimeout(measureCanvas, 300);

    // ResizeObserver : se déclenche à CHAQUE redimensionnement de l'élément canvas
    const resizeObserver = new ResizeObserver(() => {
      console.log('[CANVAS] 👁️ ResizeObserver déclenché! Appel measureCanvas()');
      measureCanvas();
    });
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
      console.log('[CANVAS] 👁️ ResizeObserver activé sur canvas');
    }

    // POLLING ACTIF: Aussi vérifier toutes les 500ms si les dimensions ont changé
    // Cela garantit qu'on détecte les changements même si window.resize ne se déclenche pas
    // (par exemple en Electron lors d'un changement d'écran)
    let lastPolledWidth = 0;
    let lastPolledHeight = 0;
    const pollingInterval = setInterval(() => {
      if (!canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const currentWidth = rect.width;
      const currentHeight = rect.height;
      
      // Si les dimensions ont RÉELLEMENT changé depuis le dernier polling, mesurer
      if (currentWidth !== lastPolledWidth || currentHeight !== lastPolledHeight) {
        console.log('[CANVAS] 🔔 POLLING DÉTECTE CHANGEMENT:', { 
          before: { w: lastPolledWidth, h: lastPolledHeight },
          now: { w: currentWidth, h: currentHeight }
        });
        lastPolledWidth = currentWidth;
        lastPolledHeight = currentHeight;
        measureCanvas();
      }
    }, 500);
    console.log('[CANVAS] ⏱️ Polling actif (tous les 500ms)');

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      clearInterval(pollingInterval);
      console.log('[CANVAS] 🧹 Nettoyage listeners dimension');
    };
  }, []);

  // ============================================================================
  // GESTION DE L'INTERACTION - ZOOM/PAN
  // ============================================================================
  // FIT-TO-VIEW: Centrer et zoomer sur l'ensemble de l'organigramme
  // ============================================================================
  const fitToView = useCallback(() => {
    if (!elkLayout || !elkLayout.children || elkLayout.children.length === 0) {
      console.log('[CANVAS] Pas de layout ELK pour fit-to-view');
      return;
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;

    // Calculer le bbox de tous les nœuds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elkLayout.children.forEach(child => {
      const left = child.x || 0;
      const top = child.y || 0;
      const right = left + (child.width || 180);
      const bottom = top + (child.height || 70);
      
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      console.log('[CANVAS] ⚠️ Bbox invalide');
      return;
    }

    // Dimensions du contenu
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Padding autour du contenu
    const padding = 30;
    const availableWidth = canvasWidth - (padding * 2);
    const availableHeight = canvasHeight - (padding * 2);

    // Calculer le zoom pour que tout rentre dans la vue
    const zoomX = availableWidth / contentWidth;
    const zoomY = availableHeight / contentHeight;
    const newZoom = Math.min(zoomX, zoomY, 1); // Ne pas zoomer plus que 100%

    // Centrer le contenu
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    const newPanX = canvasCenterX - contentCenterX * newZoom;
    const newPanY = canvasCenterY - contentCenterY * newZoom;

    console.log('[CANVAS] 🎯 Fit-to-view:', { zoom: newZoom, panX: newPanX, panY: newPanY, bbox: { minX, minY, maxX, maxY } });

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [elkLayout]);

  // ============================================================================
  const handleWheel = useCallback((e) => {
    e.preventDefault();

    // Zoom centré sur la position de la souris
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    // Position du monde avant zoom
    const worldX = (mouseX - panX) / zoom;
    const worldY = (mouseY - panY) / zoom;

    // Nouveau zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoom * delta));

    // Ajuster le pan pour que le point sous la souris reste au même endroit
    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY]);

  const handleMouseDown = useCallback((e) => {
    // Clic molette (button === 1): fit-to-view
    if (e.button === 1) {
      e.preventDefault();
      fitToView();
      return;
    }

    // Clic gauche ou clic droit: pan
    if (e.button !== 0 && e.button !== 2) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
  }, [panX, panY, fitToView]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return;
    setPanX(e.clientX - panStart.x);
    setPanY(e.clientY - panStart.y);
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // ============================================================================
  // DÉCLENCHER FITTOVIEW AUTOMATIQUEMENT APRÈS UN DROP
  // ============================================================================
  useEffect(() => {
    if (shouldFitToViewRef.current && elkLayout && elkLayout.children && elkLayout.children.length > 0) {
      console.log('[FITTOVIEW] 🎯 Déclenchement automatique après drop (effect)');
      setTimeout(() => {
        try {
          fitToView();
          console.log('[FITTOVIEW] ✅ FitToView appliqué (effect)');
        } catch (err) {
          console.error('[FITTOVIEW] Erreur lors du fitToView automatique (effect)', err);
        }
        shouldFitToViewRef.current = false;
      }, 100);
    }
  }, [elkLayout, fitToView]);

  // ============================================================================
  // GESTION DES BLOCS
  // ============================================================================
  
  // Ajouter un contact depuis le drag/drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const contactJson = e.dataTransfer.getData('contact');
    if (!contactJson) return;

    try {
      const contact = JSON.parse(contactJson);

      // Vérification stricte
      const existsInAllContacts = allContacts.some(c => c.id === contact.id);
      if (!existsInAllContacts) {
        console.warn('❌ Contact ne provient pas d\'un import Excel');
        return;
      }

      if (!selectedOrgChart) {
        console.warn('❌ Aucun organigramme sélectionné');
        return;
      }

      if (blocks.some(b => b.contactId === contact.id)) {
        console.warn('⚠️ Ce contact est déjà dans l\'organigramme');
        return;
      }

      // Créer un nouveau bloc avec position temporaire
      // (le layout va le repositionner correctement)
      const newBlock = {
        id: `block_${Date.now()}`,
        contactId: contact.id,
        x: 0,
        y: 0,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        backgroundColor: '#0A4866'  // Couleur par défaut
      };

      const newBlocks = [...blocks, newBlock];
      setBlocks(newBlocks);

      onUpdateOrgChart({
        ...selectedOrgChart,
        blocks: newBlocks,
      });
      
      // Marquer pour faire un fitToView après le layout ELK
      shouldFitToViewRef.current = true;
      console.log('[DROP] ✅ Contact dropé, fitToView sera activé après layout');
    } catch (err) {
      console.error('Erreur drop:', err);
    }
  }, [blocks, allContacts, selectedOrgChart, onUpdateOrgChart]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDeleteBlock = useCallback((blockId) => {
    const updatedBlocks = blocks.filter(b => b.id !== blockId);
    setBlocks(updatedBlocks);
    setBlocks(updatedBlocks);

    if (selectedOrgChart) {
      onUpdateOrgChart({
        ...selectedOrgChart,
        blocks: updatedBlocks,
      });
    }
  }, [blocks, selectedOrgChart, onUpdateOrgChart]);

  // Handlers pour le menu de couleur
  const handleBlockColorClick = useCallback((e, contactId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Initialiser les états temporaires avec les valeurs actuelles du contact
    const block = blocks.find(b => b.contactId === contactId);
    if (block) setCurrentColor(block.backgroundColor);
    
    setPendingBackgroundColor(null);
    
    setColorMenuContactId(contactId);
    setColorMenuPos({ x: e.clientX, y: e.clientY });
  }, [blocks]);

  const handleApplyColor = useCallback((hexColor) => {
    if (!colorMenuContactId) return;

    const updatedBlocks = blocks.map(b => 
      b.contactId === colorMenuContactId 
        ? { ...b, backgroundColor: hexColor }
        : b
    );
    
    setBlocks(updatedBlocks);
    onUpdateOrgChart({
      ...selectedOrgChart,
      blocks: updatedBlocks,
    });
    
    // Réinitialiser les états temporaires et fermer le menu
    setPendingBackgroundColor(null);
    setColorMenuContactId(null);
  }, [blocks, colorMenuContactId, selectedOrgChart, onUpdateOrgChart]);

  const handleCancelColorMenu = useCallback(() => {
    setPendingBackgroundColor(null);
    setColorMenuContactId(null);
  }, []);

  // ============================================================================
  // EXPOSE METHODS VIA IMPERATIVE HANDLE
  // ============================================================================
  useImperativeHandle(ref, () => ({
    getLayoutSnapshot: () => layoutSnapshot,
    getCanvasRef: () => canvasRef.current,
    getViewState: () => ({ zoom, panX, panY }),
    // Subscribe to snapshot updates. Returns an unsubscribe function.
    subscribeSnapshot: (cb) => {
      if (typeof cb !== 'function') return () => {};
      snapshotSubscribersRef.current.add(cb);
      // Return unsubscribe
      return () => snapshotSubscribersRef.current.delete(cb);
    }
  }), [layoutSnapshot, zoom, panX, panY]);

  // ============================================================================
  // RENDU
  // ============================================================================

  return (
    <div
      className="org-canvas-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%'
      }}
    >
      {/* En-tête du canvas */}
      {selectedOrgChart && (
        <div 
          className="canvas-header"
          style={{
            padding: '12px 16px',
            backgroundColor: '#f9f9f9',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div className="header-title" style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#333' }}>
              {selectedOrgChart.name}
            </h2>
            <p 
              className="canvas-info"
              style={{ margin: 0, fontSize: '12px', color: '#999' }}
            >
              {blocks.length} bloc(s) | Zoom: {(zoom * 100).toFixed(0)}%
            </p>
          </div>

          {/* Bouton Champs */}
          <button 
            className="btn-fields-panel"
            onClick={() => setShowFieldsPanel(!showFieldsPanel)}
            title="Personnaliser les informations affichées"
            style={{
              padding: '10px 16px',
              backgroundColor: showFieldsPanel ? '#4CAF50' : '#fff',
              color: showFieldsPanel ? '#fff' : '#333',
              border: showFieldsPanel ? '1px solid #45a049' : '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              boxShadow: showFieldsPanel ? '0 2px 8px rgba(76, 175, 80, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!showFieldsPanel) {
                e.target.style.backgroundColor = '#f5f5f5';
                e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showFieldsPanel) {
                e.target.style.backgroundColor = '#fff';
                e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              }
            }}
          >
            <span>👁️</span>
            <span>Affichage</span>
          </button>
          {/* Layout engine: Hierarchical local layout (hidden from UI) */}
        </div>
      )}

      {/* Panneau de sélection des champs (dropdown) */}
      {showFieldsPanel && selectedOrgChart && (
        <div
          className="fields-panel"
          style={{
            padding: '12px',
            backgroundColor: '#f0f0f0',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#333' }}>📋 Afficher :</h3>
            
            {/* Boutons Tout cocher / Tout décocher */}
            <button
              onClick={() => safeSetDisplayFields({
                position: true,
                agency: true,
                age: true,
                email: true,
                phone: true,
                photo: true,
                localisation: true,
                anciennete: true
              })}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '3px',
                cursor: 'pointer',
                color: '#333',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#4CAF50';
                e.target.style.color = '#fff';
                e.target.style.borderColor = '#45a049';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#fff';
                e.target.style.color = '#333';
                e.target.style.borderColor = '#ddd';
              }}
              title="Cocher tous les champs"
            >
              ✓ Tout
            </button>

            <button
              onClick={() => safeSetDisplayFields({
                position: false,
                agency: false,
                age: false,
                email: false,
                phone: false,
                photo: false,
                localisation: false,
                anciennete: false
              })}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '3px',
                cursor: 'pointer',
                color: '#333',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f44336';
                e.target.style.color = '#fff';
                e.target.style.borderColor = '#da190b';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#fff';
                e.target.style.color = '#333';
                e.target.style.borderColor = '#ddd';
              }}
              title="Décocher tous les champs"
            >
              ✕ Rien
            </button>
          </div>
          
          <div
            className="fields-list"
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <label
              className="field-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <input 
                  type="checkbox" 
                  checked={(displayFields || localDisplayFields).position} 
                  onChange={(e) => safeSetDisplayFields({...(displayFields || localDisplayFields), position: e.target.checked})}
                  style={{ cursor: 'pointer' }}
                />
              📍 Poste
            </label>

            <label
              className="field-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <input 
                type="checkbox" 
                checked={(displayFields || localDisplayFields).agency} 
                onChange={(e) => safeSetDisplayFields({...(displayFields || localDisplayFields), agency: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              🏢 Agence
            </label>

            <label
              className="field-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <input 
                type="checkbox" 
                checked={(displayFields || localDisplayFields).age} 
                onChange={(e) => safeSetDisplayFields({...(displayFields || localDisplayFields), age: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              🎂 Âge
            </label>

            <label
              className="field-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <input 
                type="checkbox" 
                checked={(displayFields || localDisplayFields).email} 
                onChange={(e) => safeSetDisplayFields({...(displayFields || localDisplayFields), email: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              ✉️ Email
            </label>

            <label
              className="field-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <input 
                type="checkbox" 
                checked={(displayFields || localDisplayFields).phone} 
                onChange={(e) => safeSetDisplayFields({...(displayFields || localDisplayFields), phone: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              📞 Téléphone
            </label>

            <label
              className="field-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <input 
                type="checkbox" 
                checked={(displayFields || localDisplayFields).photo} 
                onChange={(e) => safeSetDisplayFields({...(displayFields || localDisplayFields), photo: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              📷 Photo
            </label>

            <label
              className="field-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <input 
                type="checkbox" 
                checked={(displayFields || localDisplayFields).localisation} 
                onChange={(e) => safeSetDisplayFields({...(displayFields || localDisplayFields), localisation: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              📍 Localisation
            </label>

            <label
              className="field-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <input 
                type="checkbox" 
                checked={(displayFields || localDisplayFields).anciennete} 
                onChange={(e) => safeSetDisplayFields({...(displayFields || localDisplayFields), anciennete: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              ⏳ Ancienneté
            </label>
          </div>
        </div>
      )}

      {/* Canvas principal */}
      <div
        className="org-canvas"
        ref={(el) => {
          // Garder la référence DOM en interne uniquement.
          // Ne pas assigner le forwarded `ref` ici car cela écraserait
          // l'objet exposé par `useImperativeHandle` côté parent.
          canvasRef.current = el;
        }}
        tabIndex={-1}
        onDragLeave={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      style={{
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        flex: 1,
        cursor: isPanning ? 'grabbing' : 'grab',
        backgroundColor: '#f5f5f5',
        userSelect: 'none'
      }}
    >
      {/* Message vide si pas d'organigramme */}
      {!selectedOrgChart || blocks.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: '#999',
            fontSize: '18px',
            fontWeight: '400',
            textAlign: 'center',
            padding: '40px'
          }}
        >
          <div style={{ maxWidth: '400px', lineHeight: '1.6' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#666', marginBottom: '8px' }}>
              Aucun organigramme
            </div>
            <div style={{ fontSize: '14px', color: '#999' }}>
              Créez un nouvel organigramme pour commencer
            </div>
          </div>
        </div>
      ) : (
        // Wrapper pour zoom et pan
        <div
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
          {/* familyLayout debug toggle removed */}
          {/* ELK gère tout le routing - plus besoin de logique manuelle */}

          {/* SVG pour les connexions orthogonales (moteur ELK) */}
        {blocksWithSizes.length > 0 && (
          <svg
            ref={connectionsSvgRef}
            className="org-connections-elk"
            data-orgchart-canvas="true"
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
            {/* Arrows removed as requested */}
            {/* Render connections based on DOM positions (getBoundingClientRect) */}
            {domLines.map((L, idx) => (
              <path key={idx} d={L.d} stroke={L.stroke || '#0A4866'} strokeWidth={L.strokeWidth || 2.5} opacity={L.opacity || 1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {/* ELK diagnostics/rendering disabled in favor of DOM-based SVG lines */}
          </svg>
        )}

        {/* Blocs de contacts (positions strictement issues d'ELK) */}
        {blocksWithSizes.length === 0 && !elkLayout?.children?.length ? (
          <div style={{
            padding: '40px',
            color: '#999',
            textAlign: 'center',
            fontSize: '14px'
          }}>
            Glissez les contacts depuis le volet gauche pour créer un organigramme
          </div>
        ) : (
          (() => {
            // Créer une liste COMPLÈTE de nodes à rendre (blocks + nodes ELK manquants)
            const nodesToRender = [];
            const blockContactIds = new Set(blocksWithSizes.map(b => String(b.contactId)));
            
            // Ajouter tous les blocks explicites de l'organigramme
            blocksWithSizes.forEach(block => {
              nodesToRender.push({ ...block, isExplicit: true });
            });

            // Ajouter les nodes d'ELK qui ne sont pas dans les blocks (co-parents, etc)
            if (elkLayout?.children) {
              elkLayout.children.forEach(elkChild => {
                if (!blockContactIds.has(String(elkChild.id))) {
                  // Créer un block temporaire pour ce node ELK
                  nodesToRender.push({
                    id: `dyn_${elkChild.id}`,
                    contactId: elkChild.id,
                    x: elkChild.x || 0,
                    y: elkChild.y || 0,
                    width: elkChild.width || NODE_WIDTH,
                    height: elkChild.height || NODE_HEIGHT,
                    backgroundColor: '#666666', // Couleur différente pour les nodes auto-générés
                    isAuto: true // Marqueur pour les nodes auto-générés
                  });
                  console.log('[ELK-RENDER] 🔧 Création bloc auto pour:', elkChild.id);
                }
              });
            }

            if (nodesToRender.length === 0) {
              return (
                <div style={{
                  padding: '40px',
                  color: '#999',
                  textAlign: 'center',
                  fontSize: '14px'
                }}>
                  Glissez les contacts depuis le volet gauche pour créer un organigramme
                </div>
              );
            }

            // Debug: vérifier quels nodes sont dans ELK vs blocks
            if (elkLayout?.children) {
              const elkNodeIds = new Set(elkLayout.children.map(c => String(c.id)));
              const explicitBlockIds = new Set(blocksWithSizes.map(b => String(b.contactId)));
              const nodesMissingFromBlocks = Array.from(elkNodeIds).filter(id => !explicitBlockIds.has(id));
              
              if (nodesMissingFromBlocks.length > 0) {
                console.log('[ELK-RENDER] ✅ Nodes auto-générés:', nodesMissingFromBlocks);
                console.log('[ELK-RENDER] ELK nodes:', elkNodeIds.size, 'Explicit blocks:', explicitBlockIds.size, 'Total to render:', nodesToRender.length);
              }
            }
            
            return nodesToRender.map((block, blockIdx) => {
            // Récupérer le child ELK correspondant (utiliser strictement child.x / child.y)
            const child = elkLayout?.children?.find(c => String(c.id) === String(block.contactId));

            if (!child) {
              console.warn('[ELK-RENDER] Position manquante pour block:', block.contactId);
              return null;
            }

            const displayX = child.x || 0; // ELK fournit top-left x
            const displayY = child.y || 0; // ELK fournit top-left y
            const renderedWidth = child.width || NODE_WIDTH;
            const renderedBlockHeight = child.height || NODE_HEIGHT;

            // 🔍 DIAGNOSTIC: Log each block's rendering coordinates (first 5 blocks only to avoid spam)
            if (blockIdx < 5) {
              console.log('[BLOCK-RENDER-ELK]', {
                blockIdx,
                contactId: block.contactId.substring(0, 8),
                elkPosition: { x: Math.round(displayX * 10) / 10, y: Math.round(displayY * 10) / 10 },
                blockDimensions: { width: renderedWidth, height: renderedBlockHeight },
                calcDisplayPos: { x: Math.round(displayX * 10) / 10, y: Math.round(displayY * 10) / 10 }
              });
            }

            // Préparer contact et photo
            const contact = allContacts.find(c => c.id === block.contactId);

            // Placeholder SVG data URI (simple avatar)
            const placeholderDataUri = `data:image/svg+xml;utf8,` + encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>` +
              `<rect fill='%23e2e8f0' width='120' height='120' rx='12'/>` +
              `<circle cx='60' cy='40' r='22' fill='%23cbd5e1'/>` +
              `<rect x='20' y='74' width='80' height='18' rx='6' fill='%23cbd5e1'/>` +
              `</svg>`
            );

            const getPhotoSrc = (photoPath) => {
              // We no longer use the Excel `photoPath` column. Only accept data: URLs.
              if (!photoPath) return null;
              if (photoPath.startsWith('data:')) return photoPath;
              return null;
            };

            // Photo are now loaded via useEffect and cached


            // Prioritize cache lookup over Excel photoPath
            const cachedPhoto = photoCache[contact?.id];
            const rawPhotoSrc = (!cachedPhoto && contact && contact.photoPath) ? getPhotoSrc(contact.photoPath) : null;
            const photoSrc = (displayFields.photo) ? (cachedPhoto || rawPhotoSrc || placeholderDataUri) : null;
            
            // DEBUG: Log for Alice
            if (contact?.firstName === 'Alice') {
              console.log(`[CANVAS-RENDER] Alice Martin:`);
              console.log(`  - contact.id: ${contact?.id}`);
              console.log(`  - cachedPhoto: ${cachedPhoto}`);
              console.log(`  - contact.photoPath: ${contact?.photoPath}`);
              console.log(`  - rawPhotoSrc: ${rawPhotoSrc}`);
              console.log(`  - photoSrc (final): ${photoSrc}`);
            }

            // Use the block height/width provided by ELK as single source of truth
            const paddingVertical = 8; // Harmonisé: match calculateBlockSize padding (8px)
            const adjustedBlockHeight = renderedBlockHeight;
            // Inner height available for content (excluding vertical padding on both sides)
            const innerContentHeight = Math.max(0, adjustedBlockHeight - (paddingVertical * 2));
            // Photo width = fraction of renderedWidth
            const maxPhotoWidth = Math.floor(renderedWidth * 0.35);
            const content = getBlockContent(block.contactId);
            const photoHeight = Math.max(32, innerContentHeight); // Photo prend la hauteur complète du texte
            const imageWidth = Math.max(32, Math.min(photoHeight, maxPhotoWidth)); // Largeur adaptée

            return (
              <div
                key={block.id}
                className="org-block"
                ref={(el) => {
                  if (el) {
                    blockRefsMap.current.set(block.contactId, el);
                  } else {
                    blockRefsMap.current.delete(block.contactId);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: `${displayX}px`,
                  top: `${displayY}px`,
                  width: `${renderedWidth}px`,
                  height: `${adjustedBlockHeight}px`,
                  backgroundColor: block.backgroundColor || '#0A4866',
                  color: '#fff',
                  border: `2px solid ${block.backgroundColor || '#0A4866'}`,
                  borderRadius: '8px',
                  padding: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  zIndex: 2,
                  cursor: 'default',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', gap: '8px', height: '100%', alignItems: 'flex-start' }}>
                  {photoSrc && (
                    <img
                      src={photoSrc}
                      alt={`${contact?.firstName || ''} ${contact?.lastName || ''}`}
                      style={{ height: `${photoHeight}px`, width: `${imageWidth}px`, objectFit: 'cover', borderRadius: '4px', flex: '0 0 auto' }}
                      onError={(e) => { e.target.onerror = null; e.target.src = placeholderDataUri; }}
                    />
                  )}
                  <div style={{ fontSize: '12px', lineHeight: '1.4', flex: 1 }}>
                    {getBlockContent(block.contactId).map((line, idx, arr) => (
                      <div key={idx} style={{
                        fontWeight: idx === 0 ? 'bold' : 'normal',
                        marginBottom: (idx === 0 || idx === arr.length - 1) ? '4px' : '0'
                      }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '24px',
                    background: 'rgba(255, 255, 255, 0.3)',
                    border: 'none',
                    color: '#fff',
                    width: '20px',
                    height: '20px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: 0,
                    display: block.isAuto ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.6)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
                  onClick={(e) => handleBlockColorClick(e, block.contactId)}
                  title="Changer la couleur"
                >
                  🎨
                </button>

                <button
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: 'rgba(255, 255, 255, 0.3)',
                    border: 'none',
                    color: '#fff',
                    width: '20px',
                    height: '20px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: 0,
                    display: block.isAuto ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={() => handleDeleteBlock(block.id)}
                >
                  ✕
                </button>
              </div>
            );
            });
          })()
        )}
      </div>
      )}

      {/* Afficher une erreur visible si ELK échoue */}
      {elkError && (
        <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'rgba(255,255,255,0.95)', padding: '20px 28px', border: '1px solid #ccc', borderRadius: '8px', color: '#b91c1c', fontWeight: '700' }}>
            Layout computation failed
          </div>
        </div>
      )}

      {/* Menu de sélection de couleur - Version simple */}
      {colorMenuContactId && (() => {
        // Calculer position ajustée pour ne pas sortir de l'écran
        const menuWidth = 280;
        const menuHeight = 480;
        let left = colorMenuPos.x;
        let top = colorMenuPos.y;
        
        if (left + menuWidth > window.innerWidth - 10) {
          left = window.innerWidth - menuWidth - 10;
        }
        if (top + menuHeight > window.innerHeight - 10) {
          top = window.innerHeight - menuHeight - 10;
        }
        
        return (
          <div
            style={{
              position: 'fixed',
              left: `${left}px`,
              top: `${top}px`,
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            padding: '16px',
            zIndex: 1000,
            minWidth: '300px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Titre */}
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#333' }}>
            Choisir une couleur
          </div>

          {/* Sélecteur de couleur */}
          <div style={{ marginBottom: '12px' }}>
            <input
              id="colorPickerInput"
              type="color"
              value={pendingBackgroundColor || currentColor}
              onChange={(e) => {
                setCurrentColor(e.target.value);
                setPendingBackgroundColor(e.target.value);
              }}
              style={{ cursor: 'pointer', width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          {/* Séparateur */}
          <div style={{ height: '1px', backgroundColor: '#eee', marginBottom: '12px' }}></div>

          {/* Nuancier de couleurs */}
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
            Nuancier
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px', marginBottom: '12px' }}>
            {COLOR_PALETTE.map((color) => (
              <button
                key={color.hex}
                style={{
                  width: '28px',
                  height: '28px',
                  backgroundColor: color.hex,
                  border: '2px solid #ddd',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  padding: 0
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.1)';
                  e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = 'none';
                }}
                onClick={() => {
                  setCurrentColor(color.hex);
                  setPendingBackgroundColor(color.hex);
                }}
                title={color.name}
              />
            ))}
          </div>

          {/* Séparateur */}
          <div style={{ height: '1px', backgroundColor: '#eee', marginBottom: '12px' }}></div>

          {/* Bouton Sauvegarder */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => {
                setCustomColors([...customColors, { name: `Couleur ${currentColor}`, hex: currentColor }]);
              }}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              Sauvegarder
            </button>
          </div>

          {/* Mes couleurs */}
          {customColors.length > 0 && (
            <>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                Mes couleurs
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px', marginBottom: '12px' }}>
                {customColors.map((color, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <button
                      style={{
                        width: '28px',
                        height: '28px',
                        backgroundColor: color.hex,
                        border: '2px solid #ddd',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        padding: 0
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'scale(1.1)';
                        e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.boxShadow = 'none';
                      }}
                      onClick={() => {
                        setCurrentColor(color.hex);
                        setPendingBackgroundColor(color.hex);
                      }}
                      title={color.name}
                    />
                    <button
                      onClick={() => setCustomColors(customColors.filter((_, i) => i !== idx))}
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        width: '14px',
                        height: '14px',
                        backgroundColor: '#ff6b6b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Séparateur */}
          <div style={{ height: '1px', backgroundColor: '#eee', marginBottom: '12px' }}></div>

          {/* Boutons Appliquer et Annuler */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleApplyColor(pendingBackgroundColor || currentColor)}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#0A4866',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              Appliquer
            </button>
            <button
              onClick={handleCancelColorMenu}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Annuler
            </button>
          </div>
        </div>
        );
      })()}

      {/* Fermer le menu au clic ailleurs */}
      {colorMenuContactId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setColorMenuContactId(null)}
        />
      )}
      </div>
    </div>
  );
};

OrgChartCanvasComponent.propTypes = {
  selectedOrgChart: PropTypes.object,
  allContacts: PropTypes.array.isRequired,
  onUpdateOrgChart: PropTypes.func.isRequired,
  displayFields: PropTypes.object.isRequired,
  setDisplayFields: PropTypes.func.isRequired,
};

const OrgChartCanvas = forwardRef(OrgChartCanvasComponent);
OrgChartCanvas.displayName = 'OrgChartCanvas';

export default OrgChartCanvas;
