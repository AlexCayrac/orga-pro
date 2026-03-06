import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { logger } from '../../utils/logger';
import '../../styles/dialogs/ImportDialog.css';

/**
 * Dialog pour importer des fichiers Excel et créer un organigramme
 */
function ImportDialog({ isOpen, onClose = null, onImportSuccess = null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let filePath = null;

      // Vérifier si on est dans Electron ou dans un navigateur web
      if (window.electronAPI?.openFileDialog) {
        // Mode Electron: utiliser le dialog natif
        filePath = await window.electronAPI.openFileDialog();
      } else {
        // Mode navigateur web: utiliser l'input file standard
        // Créer un input file et le cliquer
        const inputElement = document.createElement('input');
        inputElement.type = 'file';
        inputElement.accept = '.xlsx,.xls,.csv';
        inputElement.onchange = (e) => {
          const file = e.target.files?.[0];
          if (file) {
            filePath = file.name;
          }
        };
        inputElement.click();

        // Attendre le chargement du fichier
        await new Promise((resolve) => {
          inputElement.onchange = (e) => {
            filePath = e.target.files?.[0];
            resolve();
          };
          // Timeout si l'utilisateur n'a rien sélectionné
          setTimeout(resolve, 1000);
        });
      }

      if (!filePath) {
        setIsLoading(false);
        return; // L'utilisateur a annulé
      }

      logger.info(`Fichier sélectionné : ${filePath}`);
      const displayName = typeof filePath === 'string' 
        ? filePath.split('\\').pop().split('/').pop()
        : filePath.name;
      setFileName(displayName);

      // Appel à electronAPI pour importer (Electron uniquement)
      if (window.electronAPI?.importExcel) {
        const result = await window.electronAPI.importExcel(filePath);
        
        if (result.error) {
          setError(result.error);
          setIsLoading(false);
          return;
        }

        logger.info('Import réussi', result);
        onImportSuccess?.(result);
        onClose?.();
      } else {
        // Mode navigateur web: afficher un message informatif
        setError('🌐 Import Excel nécessite Electron. La version web du Simple Browser n\'a pas accès aux fichiers système.');
        setIsLoading(false);
      }
    } catch (err) {
      logger.error('Erreur lors de l\'import', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="import-dialog-overlay">
      <div className="import-dialog">
        <div className="dialog-header">
          <h2>📥 Importer un Organigramme</h2>
          <button className="dialog-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dialog-content">
          <p className="dialog-description">
            Sélectionnez un fichier Excel (.xlsx, .xls) contenant les données de l'organigramme
          </p>

          <div className="file-input-wrapper">
            <button
              className="file-label"
              onClick={handleFileSelect}
              disabled={isLoading}
              type="button"
            >
              {fileName ? (
                <>
                  <span className="file-name">✓ {fileName}</span>
                </>
              ) : (
                <>
                  <span className="file-icon">📂</span>
                  <span>Cliquez pour sélectionner un fichier</span>
                </>
              )}
            </button>
          </div>

          {isLoading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Import en cours...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="format-info">
            <h4>📋 Format attendu</h4>
            <p>Votre fichier Excel doit contenir les colonnes suivantes :</p>
            <ul>
              <li><strong>Prénom</strong> ou <strong>firstName</strong></li>
              <li><strong>Nom</strong> ou <strong>lastName</strong></li>
              <li><strong>Poste</strong> ou <strong>position</strong></li>
              <li><strong>Département</strong> ou <strong>department</strong></li>
              <li><strong>Email</strong> (optionnel)</li>
              <li><strong>Téléphone</strong> ou <strong>phone</strong> (optionnel)</li>
              <li><strong>ManagerId</strong> ou <strong>managerId</strong> (optionnel)</li>
            </ul>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportDialog;

ImportDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  onImportSuccess: PropTypes.func,
};
