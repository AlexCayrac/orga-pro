import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * Composante pour afficher un aperçu d'impression avec les limites de la page
 * Montre les zones qui seront exportées et les zones grises (hors limites)
 */
function PrintPreviewRenderer({
  previewImageUrl,
  orientation = 'landscape',
  positioning = 'center',
  pageWidth = 210,
  pageHeight = 297
}) {
  // Calculer les dimensions de la page en pixels
  // Utiliser une échelle de 96 DPI (standard)
  const DPI = 96;
  const pxPerMm = DPI / 25.4;
  
  const pageWidthPx = useMemo(() => pageWidth * pxPerMm, [pageWidth]);
  const pageHeightPx = useMemo(() => pageHeight * pxPerMm, [pageHeight]);
  
  // Déterminer la zone d'export en fonction du positionnement
  const getExportBounds = useMemo(() => {
    const bounds = {
      left: 0,
      top: 0,
      width: pageWidthPx,
      height: pageHeightPx
    };

    if (positioning === 'left') {
      bounds.left = 0;
    } else if (positioning === 'right') {
      bounds.left = pageWidthPx * 0.66;
    } else { // center
      bounds.left = pageWidthPx * 0.2;
      bounds.width = pageWidthPx * 0.6;
    }

    return bounds;
  }, [pageWidthPx, pageHeightPx, positioning]);

  if (!previewImageUrl) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#f5f5f5',
        color: '#999',
        fontSize: '14px'
      }}>
        En attente de l'aperçu...
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      overflow: 'auto'
    }}>
      {/* Conteneur avec aspect ratio de la page */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: `${pageWidthPx * 1.2}px`,
        aspectRatio: `${pageWidthPx} / ${pageHeightPx}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Image d'aperçu */}
        <img
          src={previewImageUrl}
          alt="Aperçu d'impression"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            zIndex: 1
          }}
        />

        {/* Zone grisée - Hors limites (gauche et droite) */}
        {positioning === 'center' && (
          <>
            {/* Gauche */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '20%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              pointerEvents: 'none',
              zIndex: 2,
              borderRight: '1px solid rgba(0, 0, 0, 0.1)'
            }} />
            {/* Droite */}
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '20%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              pointerEvents: 'none',
              zIndex: 2,
              borderLeft: '1px solid rgba(0, 0, 0, 0.1)'
            }} />
          </>
        )}

        {positioning === 'left' && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '66%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            pointerEvents: 'none',
            zIndex: 2,
            borderLeft: '1px solid rgba(0, 0, 0, 0.1)'
          }} />
        )}

        {positioning === 'right' && (
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '66%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            pointerEvents: 'none',
            zIndex: 2,
            borderRight: '1px solid rgba(0, 0, 0, 0.1)'
          }} />
        )}

        {/* Contour pointillé pour les limites de la page */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: '2px dashed #333',
          pointerEvents: 'none',
          zIndex: 3,
          boxSizing: 'border-box'
        }} />

        {/* Contour pointillé pour la zone d'export */}
        <div style={{
          position: 'absolute',
          left: `${(getExportBounds.left / pageWidthPx) * 100}%`,
          top: `${(getExportBounds.top / pageHeightPx) * 100}%`,
          width: `${(getExportBounds.width / pageWidthPx) * 100}%`,
          height: `${(getExportBounds.height / pageHeightPx) * 100}%`,
          border: '2px dashed #0066cc',
          pointerEvents: 'none',
          zIndex: 4,
          boxSizing: 'border-box',
          backgroundColor: 'rgba(0, 102, 204, 0.05)'
        }} />

        {/* Labels de positionnement */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          pointerEvents: 'none',
          zIndex: 5,
          whiteSpace: 'nowrap'
        }}>
          📄 {orientation === 'landscape' ? 'Paysage' : 'Portrait'} · Pos: {
            positioning === 'left' ? '⬅️ Gauche' :
            positioning === 'right' ? '➡️ Droite' :
            '↔️ Centre'
          }
        </div>

        {/* Dimension de la page */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          pointerEvents: 'none',
          zIndex: 5
        }}>
          {pageWidth}×{pageHeight} mm
        </div>
      </div>
    </div>
  );
}

PrintPreviewRenderer.propTypes = {
  previewImageUrl: PropTypes.string,
  orientation: PropTypes.oneOf(['portrait', 'landscape']),
  positioning: PropTypes.oneOf(['left', 'center', 'right']),
  pageWidth: PropTypes.number,
  pageHeight: PropTypes.number
};

export default PrintPreviewRenderer;
