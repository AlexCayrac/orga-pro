import React, { useRef, useState, useLayoutEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * VERSION MINIMALE - Aperçu simple et fonctionnel
 */
function ExportPreview({
  exportSnapshot,
  orientation = 'landscape',
  positioning = 'center',
  pageWidth = 210,
  pageHeight = 297,
  zoomMode = 'fit-to-page',
  paperFormat = 'A4'
}) {
  const DPI = 96;
  const MM_TO_PX = DPI / 25.4;

  // Dimension réelle de la feuille en pixels
  const paperWidthPx = pageWidth * MM_TO_PX;
  const paperHeightPx = pageHeight * MM_TO_PX;

  // Conteneur pour adapter à l'écran
  const containerRef = useRef(null);
  const [displayScale, setDisplayScale] = useState(0.5);

  // Mesurer le conteneur et calculer le scale
  useLayoutEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scaleX = (rect.width - 20) / paperWidthPx;
        const scaleY = (rect.height - 20) / paperHeightPx;
        const scale = Math.min(scaleX, scaleY, 1) * 0.9;
        setDisplayScale(Math.max(0.1, scale));
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

  // Simplement afficher la feuille blanche
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
      {/* Feuille blanche */}
      <div
        style={{
          width: displayWidth,
          height: displayHeight,
          backgroundColor: '#ffffff',
          border: '2px solid #333',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Contenu: juste du texte pour l'instant */}
        <div style={{
          textAlign: 'center',
          color: '#ccc',
          fontSize: '14px',
        }}>
          {exportSnapshot ? (
            <div>
              <div>✅ Aperçu</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#999' }}>
                {paperFormat} - {orientation}
              </div>
            </div>
          ) : (
            <div>⏳ Calcul...</div>
          )}
        </div>
      </div>

      {/* Info simple */}
      <div style={{
        fontSize: '11px',
        color: '#666',
        textAlign: 'center'
      }}>
        {pageWidth}×{pageHeight}mm | Échelle: {(displayScale * 100).toFixed(0)}%
      </div>
    </div>
  );
}

ExportPreview.propTypes = {
  exportSnapshot: PropTypes.object,
  orientation: PropTypes.oneOf(['portrait', 'landscape']),
  positioning: PropTypes.oneOf(['left', 'center', 'right']),
  pageWidth: PropTypes.number,
  pageHeight: PropTypes.number,
  zoomMode: PropTypes.oneOf(['fit-to-page', 'actual-size']),
  paperFormat: PropTypes.string
};

export default ExportPreview;
