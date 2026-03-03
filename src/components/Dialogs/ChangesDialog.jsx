import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../../styles/dialogs/ChangesDialog.css';

function ChangesDialog({ isOpen, changes = null, onClose, onValidate }) {
  const [selectedChanges, setSelectedChanges] = useState({
    added: [],
    removed: [],
    modified: [],
  });

  const handleToggleChange = (type, index) => {
    const updated = { ...selectedChanges };
    const key = `${type}_${index}`;
    
    if (updated[type].includes(key)) {
      updated[type] = updated[type].filter((k) => k !== key);
    } else {
      updated[type] = [...updated[type], key];
    }
    
    setSelectedChanges(updated);
  };

  const handleSelectAll = (type) => {
    const updated = { ...selectedChanges };
    // Vérifier que changes et le type existent
    if (!changes || !Array.isArray(changes[type])) {
      return;
    }
    if (updated[type].length === changes[type].length) {
      updated[type] = [];
    } else {
      updated[type] = changes[type].map((_, i) => `${type}_${i}`);
    }
    setSelectedChanges(updated);
  };

  const handleValidate = () => {
    // Validation
    if (!changes) {
      return;
    }

    const approved = {
      added: (changes.added || []).filter((_, i) => selectedChanges.added.includes(`added_${i}`)),
      removed: (changes.removed || []).filter((_, i) => selectedChanges.removed.includes(`removed_${i}`)),
      modified: (changes.modified || []).filter((_, i) => selectedChanges.modified.includes(`modified_${i}`)),
    };

    onValidate(approved);
  };

  if (!isOpen || !changes) return null;

  const totalChanges = changes.added.length + changes.removed.length + changes.modified.length;

  return (
    <div className="changes-dialog-overlay">
      <div className="changes-dialog">
        <div className="dialog-header">
          <h2>📊 Changements détectés</h2>
          <button className="dialog-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dialog-content">
          <p className="summary">
            {totalChanges} changement(s) détecté(s) dans le fichier Excel
          </p>

          {/* Nouveaux contacts */}
          {changes.added.length > 0 && (
            <div className="changes-section">
              <div className="section-header">
                <h3>✅ Nouveaux contacts ({changes.added.length})</h3>
                <button
                  className="select-all-btn"
                  onClick={() => handleSelectAll('added')}
                >
                  {selectedChanges.added.length === changes.added.length
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </button>
              </div>
              <div className="changes-list">
                {changes.added.map((contact, idx) => (
                  <div key={idx} className="change-item">
                    <input
                      type="checkbox"
                      checked={selectedChanges.added.includes(`added_${idx}`)}
                      onChange={() => handleToggleChange('added', idx)}
                      className="checkbox"
                    />
                    <div className="change-info">
                      <div className="contact-name">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="contact-details">
                        {contact.position} • {contact.department}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contacts supprimés */}
          {changes.removed.length > 0 && (
            <div className="changes-section">
              <div className="section-header">
                <h3>❌ Contacts supprimés ({changes.removed.length})</h3>
                <button
                  className="select-all-btn"
                  onClick={() => handleSelectAll('removed')}
                >
                  {selectedChanges.removed.length === changes.removed.length
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </button>
              </div>
              <div className="changes-list">
                {changes.removed.map((contact, idx) => (
                  <div key={idx} className="change-item removed">
                    <input
                      type="checkbox"
                      checked={selectedChanges.removed.includes(`removed_${idx}`)}
                      onChange={() => handleToggleChange('removed', idx)}
                      className="checkbox"
                    />
                    <div className="change-info">
                      <div className="contact-name">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="contact-details">
                        {contact.position} • {contact.department}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contacts modifiés */}
          {changes.modified.length > 0 && (
            <div className="changes-section">
              <div className="section-header">
                <h3>🔄 Contacts modifiés ({changes.modified.length})</h3>
                <button
                  className="select-all-btn"
                  onClick={() => handleSelectAll('modified')}
                >
                  {selectedChanges.modified.length === changes.modified.length
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </button>
              </div>
              <div className="changes-list">
                {changes.modified.map(({ old: oldC, new: newC }, idx) => (
                  <div key={idx} className="change-item modified">
                    <input
                      type="checkbox"
                      checked={selectedChanges.modified.includes(`modified_${idx}`)}
                      onChange={() => handleToggleChange('modified', idx)}
                      className="checkbox"
                    />
                    <div className="change-info">
                      <div className="contact-name">
                        {oldC.firstName} {oldC.lastName}
                      </div>
                      <div className="changes-diff">
                        {oldC.position !== newC.position && (
                          <span className="diff-item">
                            Poste: <strong>{oldC.position}</strong> → <strong>{newC.position}</strong>
                          </span>
                        )}
                        {oldC.department !== newC.department && (
                          <span className="diff-item">
                            Département: <strong>{oldC.department}</strong> → <strong>{newC.department}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={handleValidate}>
            Valider les changements ({selectedChanges.added.length + selectedChanges.removed.length + selectedChanges.modified.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangesDialog;

ChangesDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  changes: PropTypes.shape({
    added: PropTypes.array,
    removed: PropTypes.array,
    modified: PropTypes.array,
  }),
  onClose: PropTypes.func.isRequired,
  onValidate: PropTypes.func.isRequired,
};
