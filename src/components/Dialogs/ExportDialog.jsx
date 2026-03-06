import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { logger } from '../../utils/logger';
import '../../styles/dialogs/ExportDialog.css';

/**
 * Dialog pour exporter un organigramme dans différents formats
 */
function ExportDialog({ isOpen, onClose = null, onExport = null, selectedOrgChart = null }) {
  const [format, setFormat] = useState('PNG');
  const [orientation, setOrientation] = useState('portrait');
  const [paperSize, setPaperSize] = useState('A4');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  const paperSizes = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 },
    A2: { width: 420, height: 594 },
    Letter: { width: 215.9, height: 279.4 },
    Tabloid: { width: 279.4, height: 431.8 }
  };

  const handleExport = async () => {
    if (!selectedOrgChart) {
      setError('Veuillez sélectionner un organigramme à exporter');
      return;
    }

    try {
      setIsExporting(true);
      setError(null);

      logger.info(`Export démarré: ${format} - ${orientation} - ${paperSize}`);

      // Préparer les options d'export
      const exportOptions = {
        format,
        orientation,
        paperSize,
        paperDimensions: paperSizes[paperSize],
        fileName: `${selectedOrgChart.name || 'organigramme'}_${new Date().toISOString().slice(0, 10)}`
      };

      // Appeler le handler parent
      onExport?.(exportOptions);
      
      logger.info('Export réussi');
      onClose?.();
    } catch (err) {
      logger.error('Erreur lors de l\'export', err);
      setError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>📤 Exporter l'organigramme</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          {error && <div className="error-message">❌ {error}</div>}

          <div className="form-group">
            <label htmlFor="format">Format d'export:</label>
            <select 
              id="format" 
              value={format} 
              onChange={(e) => setFormat(e.target.value)}
              className="form-input"
            >
              <option value="PNG">PNG (Image raster)</option>
              <option value="JPEG">JPEG (Image raster)</option>
              <option value="SVG">SVG (Vecteur)</option>
              <option value="PDF">PDF (Document)</option>
            </select>
            <small className="form-help">
              {format === 'PNG' && 'Format image transparent avec meilleure qualité'}
              {format === 'JPEG' && 'Format image compressé, fichier plus léger'}
              {format === 'SVG' && 'Format vectoriel, peut être modifié dans Illustrator/Inkscape'}
              {format === 'PDF' && 'Format document, idéal pour imprimer'}
            </small>
          </div>

          {(format === 'PDF' || format === 'SVG') && (
            <>
              <div className="form-group">
                <label htmlFor="paperSize">Format de feuille:</label>
                <select 
                  id="paperSize" 
                  value={paperSize} 
                  onChange={(e) => setPaperSize(e.target.value)}
                  className="form-input"
                >
                  {Object.keys(paperSizes).map(size => (
                    <option key={size} value={size}>
                      {size} ({paperSizes[size].width}mm × {paperSizes[size].height}mm)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="orientation">Orientation:</label>
                <select 
                  id="orientation" 
                  value={orientation} 
                  onChange={(e) => setOrientation(e.target.value)}
                  className="form-input"
                >
                  <option value="portrait">Portrait (vertical)</option>
                  <option value="landscape">Paysage (horizontal)</option>
                </select>
              </div>
            </>
          )}

          {(format === 'PNG' || format === 'JPEG') && (
            <div className="form-group">
              <label>Résolution:</label>
              <div className="radio-group">
                <label>
                  <input type="radio" name="resolution" value="1x" defaultChecked />
                  1x (écran)
                </label>
                <label>
                  <input type="radio" name="resolution" value="2x" />
                  2x (haute résolution)
                </label>
                <label>
                  <input type="radio" name="resolution" value="4x" />
                  4x (très haute résolution)
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={isExporting}
          >
            Annuler
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? '⏳ Exportation en cours...' : '📥 Exporter'}
          </button>
        </div>
      </div>
    </div>
  );
}

ExportDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  onExport: PropTypes.func,
  selectedOrgChart: PropTypes.object
};

export default ExportDialog;
