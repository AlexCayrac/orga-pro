import React, { useRef, useState, useLayoutEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

function ExportPreview({
  exportSnapshot,
  orientation = 'landscape',
  pageWidth = 210,
  pageHeight = 297,
  paperFormat = 'A4',
  allContacts = [],
  displayFields = {},
  blocks = []
}) {
  const DPI = 96;
  const MM_TO_PX = DPI / 25.4;

  const paperWidthPx = pageWidth * MM_TO_PX;
  const paperHeightPx = pageHeight * MM_TO_PX;

  const containerRef = useRef(null);
  const [displayScale, setDisplayScale] = useState(0.5);

  // Mesurer le conteneur
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

  // Mémoriser le rendu SVG pour éviter les recalculs inutiles
  const svgContent = useMemo(() => {
    if (!exportSnapshot?.positions || exportSnapshot.positions.size === 0) {
      return null; // Feuille blanche
    }

    // Calculer la bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    exportSnapshot.positions.forEach(pos => {
      minX = Math.min(minX, pos.x - 70);
      maxX = Math.max(maxX, pos.x + 70);
      minY = Math.min(minY, pos.y - 30);
      maxY = Math.max(maxY, pos.y + 30);
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
    const transformAttr = `translate(${panX} ${panY}) scale(${zoom})`;

    return { transformAttr, zoom };
  }, [exportSnapshot, paperWidthPx, paperHeightPx]);

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
          style={{ backgroundColor: 'white' }}
        >
          {/* Contenu si disponible */}
          {svgContent && exportSnapshot && (
            <g transform={svgContent.transformAttr}>
              {/* Connexions */}
              {exportSnapshot.connections?.length > 0 && (
                <g className="connections">
                  {exportSnapshot.connections.map((conn, idx) => {
                    if (!conn.fromPos || !conn.toPos) return null;
                    
                    const fromX = conn.fromPos.x;
                    const fromY = conn.fromPos.y;
                    const toX = conn.toPos.x;
                    const toY = conn.toPos.y;
                    const turnY = fromY + (toY - fromY) / 2;
                    
                    const pathData = `M ${fromX} ${fromY + 30} L ${fromX} ${turnY} L ${toX} ${turnY} L ${toX} ${toY - 30}`;
                    
                    return (
                      <path
                        key={`conn-${idx}`}
                        d={pathData}
                        stroke="#0A4866"
                        strokeWidth="2"
                        fill="none"
                        opacity="0.6"
                      />
                    );
                  })}
                </g>
              )}
              
              {/* Blocs */}
              {Array.from(exportSnapshot.positions.entries()).map(([contactId, pos]) => {
                const contact = allContacts.find(c => c.id === contactId);
                const block = blocks.find(b => b.contactId === contactId);
                const blockColor = block?.backgroundColor || '#0A4866';
                const blockWidth = 140;
                const blockHeight = 60;
                
                const blockLines = [];
                if (contact) {
                  const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
                  if (name) blockLines.push(name);
                  if (displayFields.position && contact.position) blockLines.push(contact.position);
                  if (displayFields.agency && contact.agency) blockLines.push(contact.agency);
                }
                if (blockLines.length === 0) blockLines.push(contactId.substring(0, 15));

                return (
                  <g key={`block-${contactId}`}>
                    <rect
                      x={pos.x - blockWidth / 2}
                      y={pos.y - blockHeight / 2}
                      width={blockWidth}
                      height={blockHeight}
                      rx="4"
                      fill={blockColor}
                      stroke={blockColor}
                      opacity="0.85"
                    />
                    {blockLines.map((line, idx) => (
                      <text
                        key={`text-${idx}`}
                        x={pos.x}
                        y={pos.y - 15 + idx * 16}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight={idx === 0 ? 'bold' : 'normal'}
                      >
                        {line.length > 14 ? line.substring(0, 11) + '...' : line}
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
  blocks: PropTypes.array
};

export default ExportPreview;
