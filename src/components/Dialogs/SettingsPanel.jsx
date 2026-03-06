import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../../styles/dialogs/SettingsPanel.css';

/**
 * SettingsPanel - Panneau des paramètres
 * Affiche les options de paramètres comme le mode sombre et suppression de données
 */
function SettingsPanel({ isOpen, onClose, onClearAllData }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDeleteData = async () => {
    try {
      console.log('[SettingsPanel] 🔄 DÉBUT: Suppression complète des données');
      
      // 🔑 DÉLÉGUER À App.jsx qui gère le reset correctement avec flushSync
      if (onClearAllData) {
        console.log('[SettingsPanel] ✓ Appel du reset App.jsx (synchrone + flushSync)');
        await onClearAllData();
      }
    } catch (error) {
      console.error('[SettingsPanel] ❌ ERREUR lors de la suppression:', error);
      alert('❌ Erreur lors de la suppression des données: ' + error.message);
    }
  };

  return (
    <div className="settings-overlay" onClick={handleBackgroundClick}>
      <div className="settings-panel">
        <div className="settings-header">
          <h2>⚙️ Paramètres</h2>
          <button className="close-btn" onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>

        <div className="settings-content">
          {/* Data Management */}
          <div className="settings-group">
            <h3 className="settings-group-title">Gestion des données</h3>
            {!showDeleteConfirm ? (
              <button 
                className="btn btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                🗑️ Supprimer toutes les données
              </button>
            ) : (
              <div className="delete-confirmation">
                <p className="warning-text">⚠️ Êtes-vous certain de vouloir supprimer toutes les données ?</p>
                <p className="warning-subtext">Cette action est irréversible.</p>
                <div className="confirmation-buttons">
                  <button 
                    className="btn btn-cancel"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Annuler
                  </button>
                  <button 
                    className="btn btn-delete"
                    onClick={handleDeleteData}
                  >
                    Supprimer définitivement
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="settings-divider"></div>

          {/* Info */}
          <div className="settings-info">
            <p>Les paramètres sont automatiquement sauvegardés.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;

SettingsPanel.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onClearAllData: PropTypes.func,
};
