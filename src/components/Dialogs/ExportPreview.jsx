import React, { useRef, useState, useLayoutEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

function ExportPreview({
  exportSnapshot,
  orientation = 'landscape',
  pageWidth = 210,
  pageHeight = 297,
  paperFormat = 'A4',
  allContacts = [],
  displayFields = {},
  blocks = [],
  linkColorSource = {},
  logoImageUrl = null,
  logoPosition = 'top-right'
}) {
  const DPI = 96;
  const MM_TO_PX = DPI / 25.4;
  console.log('[ExportPreview] 🎬 Rendering:', { hasSnapshot: !!exportSnapshot, connCount: exportSnapshot?.connections?.length });

  const paperWidthPx = pageWidth * MM_TO_PX;
  const paperHeightPx = pageHeight * MM_TO_PX;

  const containerRef = useRef(null);
  const [displayScale, setDisplayScale] = useState(0.5);

  // Mesurer la largeur du texte avec Canvas pour plus de précision
  const measureTextWidth = useCallback((text, fontSize = 12) => {
    if (typeof document === 'undefined') return text.length * 7;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return text.length * 7;
    ctx.font = `normal ${fontSize}px system-ui, -apple-system, sans-serif`;
    return ctx.measureText(text).width;
  }, []);

  // Calculer dynamiquement la taille d'un bloc basée sur son contenu et displayFields
  const calculateBlockSize = useCallback((contactId) => {
    const contact = allContacts.find(c => c.id === contactId);
    if (!contact) return { width: 140, height: 60 };

    const lines = [];
    lines.push(`${contact.firstName || ''} ${contact.lastName || ''}`.trim());
    if (displayFields.position && contact.position) lines.push(`📍 ${contact.position}`);
    if (displayFields.agency && contact.agency) lines.push(`🏢 ${contact.agency}`);
    if (displayFields.age && contact.age !== undefined && contact.age !== null) lines.push(`🎂 ${contact.age} ans`);
    if (displayFields.email && contact.email) lines.push(`📧 ${contact.email}`);
    if (displayFields.phone && contact.phone) lines.push(`📞 ${contact.phone}`);
    if (displayFields.address && contact.address) lines.push(`🏠 ${contact.address}`);

    const lineHeight = 18;
    const padding = 16;
    const fontSize = 12;
    
    let maxLineWidth = 0;
    lines.forEach(line => {
      const lineWidth = measureTextWidth(line, fontSize);
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
    });
    
    const width = Math.max(maxLineWidth + padding * 2, 140); // Min width 140
    const height = padding + (lines.length * lineHeight) + padding;
    
    return { width, height };
  }, [allContacts, displayFields, measureTextWidth]);

  // FALLBACK: Si snapshot est vide, créer un snapshot de base avec positions calculées
  const effectiveSnapshot = useMemo(() => {
    // Utiliser le snapshot fourni s'il a du contenu
    if (exportSnapshot?.positions?.size > 0) {
      return exportSnapshot;
    }

    // FALLBACK: Construire positions depuis les blocs
    if (blocks.length === 0) {
      return null;
    }
    const positions = new Map();
    // blockWidth/blockHeight removed (unused)
    const spacingX = 250;
    const spacingY = 150;

    blocks.forEach((block, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const x = col * spacingX + 150;
      const y = row * spacingY + 100;
      positions.set(block.contactId, { x, y });
    });

    return {
      positions: positions,
      connections: exportSnapshot?.connections || [],
      viewport: {}
    };
  }, [exportSnapshot, blocks]);

  useLayoutEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scaleX = (rect.width - 20) / paperWidthPx;
        const scaleY = (rect.height - 20) / paperHeightPx;
        const scale = Math.min(scaleX, scaleY) * 0.9;
        setDisplayScale(Math.max(0.05, scale));
      }
    };

    const timer = setTimeout(measureContainer, 50);
    const observer = new ResizeObserver(measureContainer);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [paperWidthPx, paperHeightPx]);

  const displayWidth = paperWidthPx * displayScale;
  const displayHeight = paperHeightPx * displayScale;

  const svgContent = useMemo(() => {
    if (!effectiveSnapshot?.positions || effectiveSnapshot.positions.size === 0) {
      console.log('[ExportPreview] ⚠️ Pas de positions à afficher');
      return null;
    }

    // DEBUG TRÈS DÉTAILLÉ
    console.log('[ExportPreview] 🔍 DEBUG svgContent calc:', {
      snapshotType: Object.prototype.toString.call(effectiveSnapshot),
      positionsSize: effectiveSnapshot.positions.size,
      connectionsArray: effectiveSnapshot.connections,
      connectionsLength: effectiveSnapshot.connections?.length,
      connectionsIsArray: Array.isArray(effectiveSnapshot.connections),
      firstConn: effectiveSnapshot.connections?.[0]
    });

    // NOTE: centeringValues dans exportSnapshot sont calculées pour 300 DPI (export)
    // Mais la preview doit utiliser 96 DPI, donc on recalcule le centrage pour la preview

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Utiliser les dimensions calculées dynamiquement pour chaque bloc
    effectiveSnapshot.positions.forEach((pos, contactId) => {
      const { width: bw, height: bh } = calculateBlockSize(contactId);
      minX = Math.min(minX, pos.x - (bw / 2));
      maxX = Math.max(maxX, pos.x + (bw / 2));
      minY = Math.min(minY, pos.y - (bh / 2));
      maxY = Math.max(maxY, pos.y + (bh / 2));
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const margin = 0.05;
    const availableWidth = paperWidthPx * (1 - 2 * margin);
    const availableHeight = paperHeightPx * (1 - 2 * margin);

    const zoomX = contentWidth > 0 ? availableWidth / contentWidth : 1;
    const zoomY = contentHeight > 0 ? availableHeight / contentHeight : 1;
    const zoom = Math.min(zoomX, zoomY);

    const scaledWidth = contentWidth * zoom;
    const scaledHeight = contentHeight * zoom;
    const panX = (paperWidthPx - scaledWidth) / 2 - minX * zoom;
    const panY = (paperHeightPx - scaledHeight) / 2 - minY * zoom;

    return `translate(${panX} ${panY}) scale(${zoom})`;
  }, [exportSnapshot, effectiveSnapshot, paperWidthPx, paperHeightPx, blocks, displayFields, calculateBlockSize]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#d4d4d4',
        gap: '12px',
        padding: '12px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          width: displayWidth,
          height: displayHeight,
          backgroundColor: '#ffffff',
          border: '2px solid #333',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${paperWidthPx} ${paperHeightPx}`}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          style={{ 
            backgroundColor: 'white', 
            shapeRendering: 'auto',
            textRendering: 'optimizeLegibility'
          }}
        >
          {/* Logo (si fourni) - positionné en dehors du group transform pour rester fixé à la page */}
          {logoImageUrl && (() => {
            try {
              const logoMaxWidthMm = 40; // largeur max du logo en mm
              const logoMaxHeightMm = 40; // hauteur max du logo en mm
              const marginMm = 3; // marge depuis les bords en mm (3mm comme demandé)
              const logoW = logoMaxWidthMm * MM_TO_PX;
              const logoH = logoMaxHeightMm * MM_TO_PX;
              const marginPx = marginMm * MM_TO_PX;

              let x = marginPx;
              let y = marginPx;
              if (logoPosition === 'top-right') {
                x = paperWidthPx - marginPx - logoW;
                y = marginPx;
              } else if (logoPosition === 'bottom-left') {
                x = marginPx;
                y = paperHeightPx - marginPx - logoH;
              } else if (logoPosition === 'bottom-right') {
                x = paperWidthPx - marginPx - logoW;
                y = paperHeightPx - marginPx - logoH;
              } else {
                // top-left par défaut
                x = marginPx;
                y = marginPx;
              }

              return (
                <g>
                  <image
                    href={logoImageUrl}
                    xlinkHref={logoImageUrl}
                    x={x}
                    y={y}
                    width={logoW}
                    height={logoH}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            } catch (err) {
              console.error('[ExportPreview] Erreur rendu logo:', err);
              return null;
            }
          })()}
          {/* Définitions SVG pour les effets (ombres) et transparence logo */}
          <defs>
            <filter id="blockShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="2" dy="3" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* logoTransparency filter removed to avoid altering alpha channel of PNG logos */}
          </defs>
          {svgContent && effectiveSnapshot && (
            <g transform={svgContent}>
              {/* Connexions */}
              {(() => {
                if (effectiveSnapshot.connections?.length > 0) {
                  return (
                    <g>
                      {effectiveSnapshot.connections.map((conn, idx) => {
                        if (!conn.fromPos || !conn.toPos) {
                          return null;
                        }
                        const fromX = conn.fromPos.x;
                        const fromY = conn.fromPos.y;
                        const toX = conn.toPos.x;
                        const toY = conn.toPos.y;

                        // Determine blocks for color decision
                        const fromBlock = blocks.find(b => b.contactId === conn.fromBlockId) || {};
                        const toBlock = blocks.find(b => b.contactId === conn.toBlockId) || {};
                        
                        // Get color preference from BOTH parent and child
                        // If EITHER wants 'child' color, use child color; otherwise use parent color
                        const parentColorPref = linkColorSource?.[conn.fromBlockId];
                        const childColorPref = linkColorSource?.[conn.toBlockId];
                        
                        const usesChildColor = parentColorPref === 'child' || childColorPref === 'child';
                        const linkColor = usesChildColor
                          ? (toBlock.backgroundColor || '#0A4866')
                          : (fromBlock.backgroundColor || '#0A4866');

                        // Calculer le point de tournant (y) au milieu
                        const turnY = fromY + (toY - fromY) / 2;
                        // Chemin avec virages droite (comme dans OrgChartCanvas)
                        const pathData = `M ${fromX} ${fromY + 30} L ${fromX} ${turnY} L ${toX} ${turnY} L ${toX} ${toY - 30}`;

                        return (
                          <path
                            key={`conn-${idx}`}
                            d={pathData}
                            stroke={linkColor}
                            strokeWidth="4"
                            fill="none"
                            opacity="0.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      })}
                    </g>
                  );
                } else {
                  console.log('[ExportPreview] ⚠️ Pas de connexions à afficher');
                  return (
                    <text
                      x={paperWidthPx / 2}
                      y={20}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#999"
                      opacity="0.5"
                    >
                      (Pas de connexions)
                    </text>
                  );
                }
              })()}
              {/* Blocs */}
              {Array.from(effectiveSnapshot.positions.entries()).map(([contactId, pos]) => {
                const contact = allContacts.find(c => c.id === contactId);
                const block = blocks.find(b => b.contactId === contactId);
                const blockColor = block?.backgroundColor || '#0A4866';
                
                // Calculer dynamiquement la taille du bloc basée sur displayFields
                const { width: blockWidth, height: blockHeight } = calculateBlockSize(contactId);
                
                // Construire les lignes de texte
                const rawLines = [];
                if (contact) {
                  const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
                  if (name) rawLines.push({ text: name, bold: true });
                  if (displayFields.position && contact.position) rawLines.push({ text: `📍 ${contact.position}`, bold: false });
                  if (displayFields.agency && contact.agency) rawLines.push({ text: `🏢 ${contact.agency}`, bold: false });
                  if (displayFields.age && contact.age !== undefined && contact.age !== null) rawLines.push({ text: `🎂 ${contact.age} ans`, bold: false });
                  if (displayFields.email && contact.email) rawLines.push({ text: `📧 ${contact.email}`, bold: false });
                  if (displayFields.phone && contact.phone) rawLines.push({ text: `📞 ${contact.phone}`, bold: false });
                  if (displayFields.address && contact.address) rawLines.push({ text: `🏠 ${contact.address}`, bold: false });
                }

                if (rawLines.length === 0) rawLines.push({ text: contactId, bold: true });

                const lineHeight = 18;
                const padding = 16;
                const fontSize = 12;

                return (
                  <g key={`block-${contactId}`}>
                    {/* Fond du bloc avec ombre */}
                    <rect
                      x={pos.x - blockWidth / 2}
                      y={pos.y - blockHeight / 2}
                      width={blockWidth}
                      height={blockHeight}
                      rx="4"
                      fill={blockColor}
                      stroke={blockColor}
                      opacity="1"
                      filter="url(#blockShadow)"
                    />

                    {/* Texte du bloc (une ligne par champ, pas de wrapping) */}
                    {rawLines.map((line, idx) => (
                      <text
                        key={`text-${idx}`}
                        x={pos.x}
                        y={pos.y - (blockHeight / 2) + padding + 6 + idx * lineHeight}
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        fill="white"
                        fontSize={fontSize}
                        fontWeight={line.bold ? 'bold' : 'normal'}
                        fontFamily="system-ui, -apple-system, sans-serif"
                        style={{ pointerEvents: 'none' }}
                      >
                        {line.text}
                      </text>
                    ))}
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>

      <div style={{ fontSize: '11px', color: '#666', textAlign: 'center' }}>
        {pageWidth}×{pageHeight}mm | {(displayScale * 100).toFixed(0)}%
      </div>
    </div>
  );
}

ExportPreview.propTypes = {
  exportSnapshot: PropTypes.object,
  orientation: PropTypes.oneOf(['portrait', 'landscape']),
  pageWidth: PropTypes.number,
  pageHeight: PropTypes.number,
  paperFormat: PropTypes.string,
  allContacts: PropTypes.array,
  displayFields: PropTypes.object,
  blocks: PropTypes.array,
  linkColorSource: PropTypes.object,
  logoImageUrl: PropTypes.string,
  logoPosition: PropTypes.oneOf(['top-left','top-right','bottom-left','bottom-right'])
};

export default ExportPreview;
