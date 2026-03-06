/**
 * Générateur SVG pour export d'organigramme
 * 
 * Crée un SVG qui reproduit FIDÈLEMENT le rendu visible du canvas
 * en utilisant les positions/tailles VISUELLES (mesurées via getBoundingClientRect)
 */

/**
 * Génère un SVG fidèle du canvas visible
 * @param {Array} realBlocksData - Blocs avec positions et tailles VISUELLES (après zoom/pan)
 * @param {Object} bbox - Bounding box { minX, minY, maxX, maxY }
 * @param {Array} allContacts - Tous les contacts
 * @param {Object} displayFields - Champs à afficher
 * @param {Object} linkColorSource - Objet mappant contactId -> 'parent' ou 'child' pour couleur liens
 * @param {Array} connections - Connexions du layout
 * @returns {string} SVG content
 */
export function generateExportSVG(
  realBlocksData,
  bbox,
  allContacts,
  displayFields,
  linkColorSource = 'parent',
  connections = []
) {
  const { minX, minY, maxX, maxY } = bbox;
  
  const PADDING = 40;
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  
  const svgWidth = contentWidth + PADDING * 2;
  const svgHeight = contentHeight + PADDING * 2;
  
  console.log('[SVG] 🎬 Génération export:', {
    contentSize: { w: contentWidth, h: contentHeight },
    svgSize: { w: svgWidth, h: svgHeight },
    blocksCount: realBlocksData.length,
    connectionsCount: connections.length
  });
  
  // Créer un Map pour accès rapide aux blocs
  const blocksMap = new Map(realBlocksData.map(b => [b.contactId, b]));
  
  // Démarrer le SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <style>
      .org-block-rect { stroke-width: 2; }
      .org-block-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 600; fill: #fff; }
      .org-block-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; fill: #fff; }
      .org-connection { stroke-width: 4; fill: none; }
    </style>
  </defs>
  
  <!-- Fond blanc -->
  <rect width="${svgWidth}" height="${svgHeight}" fill="white"/>
  
  <!-- Groupe contenu: offset par rapport au bounding box -->
  <g transform="translate(${PADDING - minX}, ${PADDING - minY})">`;
  
  // ============================================================================
  // 1. DESSINER LES CONNEXIONS (arrière-plan)
  // ============================================================================
  svg += '\n    <!-- Connexions -->\n';
  
  if (connections && connections.length > 0) {
    // Créer un index des connexions par parent pour le turnY commun
    const connectionsByParent = {};
    connections.forEach(conn => {
      if (!connectionsByParent[conn.fromBlockId]) {
        connectionsByParent[conn.fromBlockId] = [];
      }
      connectionsByParent[conn.fromBlockId].push(conn);
    });
    
    connections.forEach(conn => {
      const fromBlock = blocksMap.get(conn.fromBlockId);
      const toBlock = blocksMap.get(conn.toBlockId);
      
      if (!fromBlock || !toBlock) return;
      
      // Coordonnées des centres des blocs et bas/haut
      const fromX = fromBlock.x + fromBlock.width / 2;
      const fromY = fromBlock.y + fromBlock.height;
      const toX = toBlock.x + toBlock.width / 2;
      const toY = toBlock.y;
      
      // Couleur du lien - basée sur les préférences du parent ET de l'enfant
      // Si L'UN OU L'AUTRE veut 'child', utiliser la couleur de l'enfant
      const parentColorPref = linkColorSource?.[conn.fromBlockId];
      const childColorPref = linkColorSource?.[conn.toBlockId];
      
      const usesChildColor = parentColorPref === 'child' || childColorPref === 'child';
      const linkColor = usesChildColor
        ? (toBlock.backgroundColor || '#0A4866')
        : (fromBlock.backgroundColor || '#0A4866');
      
      // Calculer turnY commun pour les frères
      const siblings = connectionsByParent[conn.fromBlockId] || [];
      let minVerticalGap = Infinity;
      siblings.forEach(sibConn => {
        const sibToBlock = blocksMap.get(sibConn.toBlockId);
        const sibFromBlock = blocksMap.get(sibConn.fromBlockId);
        if (sibToBlock && sibFromBlock) {
          const gap = sibToBlock.y - (sibFromBlock.y + sibFromBlock.height);
          minVerticalGap = Math.min(minVerticalGap, gap);
        }
      });
      
      const turnY = fromY + (minVerticalGap > 0 ? minVerticalGap / 2 : 40);
      
      // Tracer la connexion
      const pathData = `M ${fromX} ${fromY} L ${fromX} ${turnY} L ${toX} ${turnY} L ${toX} ${toY}`;
      svg += `    <path class="org-connection" d="${pathData}" stroke="${linkColor}"/>\n`;
    });
  }
  
  // ============================================================================
  // 2. DESSINER LES BLOCS (avant-plan)
  // ============================================================================
  svg += '\n    <!-- Blocs -->\n';
  
  realBlocksData.forEach(block => {
    const x = block.x;
    const y = block.y;
    const w = block.width;
    const h = block.height;
    
    const bgColor = block.backgroundColor || '#0A4866';
    const borderColor = block.borderColor || bgColor;
    
    // Rectangle du bloc
    svg += `    <rect class="org-block-rect" x="${x}" y="${y}" width="${w}" height="${h}" fill="${bgColor}" stroke="${borderColor}" rx="8"/>\n`;
    
    // Contenu du bloc
    const contact = allContacts.find(c => c.id === block.contactId);
    if (!contact) {
      console.warn(`[SVG] Contact ${block.contactId} non trouvé`);
      return;
    }
    
    let yOffset = y + 10;
    const lineHeight = 14;
    const textX = x + 8;
    
    // Afficher les champs configurés
    const lines = [];
    
    if (displayFields?.position && contact.position) {
      lines.push({ text: contact.position, bold: true });
    }
    
    const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
    if (fullName) {
      lines.push({ text: fullName, bold: !displayFields?.position });
    }
    
    if (displayFields?.agency && contact.agency) {
      lines.push({ text: contact.agency, bold: false });
    }
    
    if (displayFields?.email && contact.email) {
      lines.push({ text: contact.email, bold: false, fontSize: 10 });
    }
    
    if (displayFields?.phone && contact.phone) {
      lines.push({ text: contact.phone, bold: false, fontSize: 10 });
    }
    
    // Tracer les lignes de texte
    lines.forEach((line) => {
      const className = line.bold ? 'org-block-title' : 'org-block-text';
      const fontSize = line.fontSize ? ` font-size="${line.fontSize}"` : '';
      const safeText = escapeXML(line.text);
      svg += `    <text class="${className}" x="${textX}" y="${yOffset}"${fontSize}>${safeText}</text>\n`;
      yOffset += lineHeight;
    });
  });
  
  svg += '\n  </g>\n</svg>';
  
  return svg;
}

/**
 * Ancienne fonction - garder pour compatibilité
 */
export function generateCleanSVG(realBlocksData, blocksWithSizes, layoutResult, allContacts, selectedOrgChart, displayFields, linkColorSource) {
  // Calculer le bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  realBlocksData.forEach(block => {
    minX = Math.min(minX, block.x);
    minY = Math.min(minY, block.y);
    maxX = Math.max(maxX, block.x + block.width);
    maxY = Math.max(maxY, block.y + block.height);
  });
  
  // Convertir layoutResult.connections en format attendu si nécessaire
  const connections = layoutResult?.connections || [];
  
  return generateExportSVG(
    realBlocksData,
    { minX, minY, maxX, maxY },
    allContacts,
    displayFields,
    linkColorSource,
    connections
  );
}

/**
 * Échappe les caractères XML
 */
function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

