import React, { useState, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import '../../styles/dialogs/DifferencesDialog.css';

/**
 * Dialog pour afficher et gérer les différences entre l'organigramme et Excel
 */
function DifferencesDialog({ isOpen, changes, onApply, onCancel, isLoading = false }) {
  const [selectedChanges, setSelectedChanges] = useState(new Set());
  const [filterType, setFilterType] = useState('all'); // 'all', 'added', 'removed', 'modified'
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);

  // Gestion du drag start (sur le header)
  const handleMouseDown = (e) => {
    if (e.target.closest('.btn-close')) return; // Ne pas drag si on clique sur le bouton fermer
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Gestion du drag move
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  // Gestion du drag end
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Ajouter les listeners au document quand on drag
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, position]);

  // Filtrer les changements selon le type sélectionné
  const filteredChanges = useMemo(() => {
    const allChanges = [
      ...changes.added.map((c, idx) => ({ ...c, _id: `added_${idx}` })),
      ...changes.removed.map((c, idx) => ({ ...c, _id: `removed_${idx}` })),
      ...changes.modified.map((c, idx) => ({ ...c, _id: `modified_${idx}` })),
    ];

    if (filterType === 'all') return allChanges;
    return allChanges.filter(c => c.type === filterType);
  }, [changes, filterType]);

  // Compter les sélections par type
  const selectedByType = useMemo(() => {
    const count = { added: 0, removed: 0, modified: 0 };
    selectedChanges.forEach(id => {
      const change = filteredChanges.find(c => c._id === id);
      if (change) {
        count[change.type]++;
      }
    });
    return count;
  }, [selectedChanges, filteredChanges]);

  // Basculer la sélection d'une ligne
  const toggleSelection = (id) => {
    const newSet = new Set(selectedChanges);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedChanges(newSet);
  };

  // Sélectionner tous les changements visibles
  const selectAll = () => {
    const allIds = filteredChanges.map(c => c._id);
    setSelectedChanges(new Set(allIds));
  };

  // Désélectionner tous les changements
  const deselectAll = () => {
    setSelectedChanges(new Set());
  };

  // Construire la liste des changements acceptés
  const buildAcceptedChanges = () => {
    const acceptedChanges = [];

    filteredChanges.forEach(change => {
      if (selectedChanges.has(change._id)) {
        acceptedChanges.push(change);
      }
    });

    // Réintégrer les changements non filtrés mais sélectionnés
    if (filterType !== 'all') {
      const allChanges = [
        ...changes.added.map((c, idx) => ({ ...c, _id: `added_${idx}` })),
        ...changes.removed.map((c, idx) => ({ ...c, _id: `removed_${idx}` })),
        ...changes.modified.map((c, idx) => ({ ...c, _id: `modified_${idx}` })),
      ];

      allChanges.forEach(change => {
        if (selectedChanges.has(change._id) && !acceptedChanges.find(c => c._id === change._id)) {
          acceptedChanges.push(change);
        }
      });
    }

    return acceptedChanges;
  };

  // Appliquer les changements sélectionnés
  const handleApply = () => {
    const acceptedChanges = buildAcceptedChanges();
    console.log('[DifferencesDialog] 🔥 APPLY - acceptedChanges:', JSON.stringify(acceptedChanges, null, 2));
    console.log('[DifferencesDialog] 🔥 APPLY - count:', acceptedChanges.length);
    onApply(acceptedChanges);
  };

  if (!isOpen) return null;

  return (
    <div className="floating-window-container">
      <div 
        ref={windowRef}
        className="floating-window differences-dialog" 
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'auto'
        }}
      >
        <div 
          className="dialog-header" 
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <h2>Différences détectées</h2>
          <button className="btn-close" onClick={onCancel} title="Fermer">×</button>
        </div>

        <div className="dialog-content">
          {isLoading ? (
            <div className="loading">Chargement des différences...</div>
          ) : changes.summary.total === 0 ? (
            <div className="no-changes">
              <p>✅ Aucune différence détectée. L'organigramme est à jour.</p>
            </div>
          ) : (
            <>
              {/* Résumé des changements */}
              <div className="changes-summary">
                <div className="summary-item">
                  <span className="label">Ajoutés:</span>
                  <span className="count added">{changes.summary.totalAdded}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Supprimés:</span>
                  <span className="count removed">{changes.summary.totalRemoved}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Modifiés:</span>
                  <span className="count modified">{changes.summary.totalModified}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Total:</span>
                  <span className="count total">{changes.summary.total}</span>
                </div>
              </div>

              {/* Filtres */}
              <div className="filter-bar">
                <label>Filtrer par:</label>
                <div className="filter-buttons">
                  <button
                    className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterType('all')}
                  >
                    Tous ({changes.summary.total})
                  </button>
                  <button
                    className={`filter-btn ${filterType === 'added' ? 'active' : ''}`}
                    onClick={() => setFilterType('added')}
                  >
                    ➕ Ajoutés ({changes.summary.totalAdded})
                  </button>
                  <button
                    className={`filter-btn ${filterType === 'removed' ? 'active' : ''}`}
                    onClick={() => setFilterType('removed')}
                  >
                    ➖ Supprimés ({changes.summary.totalRemoved})
                  </button>
                  <button
                    className={`filter-btn ${filterType === 'modified' ? 'active' : ''}`}
                    onClick={() => setFilterType('modified')}
                  >
                    ✏️ Modifiés ({changes.summary.totalModified})
                  </button>
                </div>
              </div>

              {/* Barre de sélection */}
              <div className="selection-bar">
                <button className="btn btn-action" onClick={selectAll}>
                  ✓ Tout accepter
                </button>
                <button className="btn btn-action" onClick={deselectAll}>
                  ✗ Rien accepter
                </button>
                <span className="selection-count">
                  {selectedChanges.size} changement(s) sélectionné(s)
                </span>
              </div>

              {/* Liste des changements */}
              <div className="changes-list">
                {filteredChanges.length === 0 ? (
                  <div className="no-changes-filtered">Aucun changement de ce type</div>
                ) : (
                  filteredChanges.map((change, idx) => (
                    <ChangeRow
                      key={change._id}
                      change={change}
                      isSelected={selectedChanges.has(change._id)}
                      onToggle={() => toggleSelection(change._id)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={isLoading || selectedChanges.size === 0}
          >
            Appliquer ({selectedChanges.size})
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Composant pour une ligne de changement
 */
function ChangeRow({ change, isSelected, onToggle }) {
  const getChangeTitle = () => {
    if (change.type === 'added') {
      const contact = change.excelContact;
      return `➕ ${contact.firstName} ${contact.lastName}`;
    } else if (change.type === 'removed') {
      const contact = change.contact;
      return `➖ ${contact.firstName} ${contact.lastName}`;
    } else if (change.type === 'modified') {
      const contact = change.currentContact;
      return `✏️ ${contact.firstName} ${contact.lastName}`;
    }
  };

  const getChangeDetails = () => {
    if (change.type === 'added') {
      const contact = change.excelContact;
      const details = [];
      if (contact.position) details.push(`Poste: ${contact.position}`);
      if (contact.department) details.push(`Département: ${contact.department}`);
      if (contact.email) details.push(`Email: ${contact.email}`);
      return details.join(' | ');
    } else if (change.type === 'removed') {
      const contact = change.contact;
      const details = [];
      if (contact.position) details.push(`Poste: ${contact.position}`);
      if (contact.department) details.push(`Département: ${contact.department}`);
      return details.join(' | ');
    } else if (change.type === 'modified') {
      // Filtrer les modifications techniques (ex: __rowHash)
      const visibleModifications = change.modifications.filter(mod => !mod.field.startsWith('__'));
      return visibleModifications
        .map(mod => `${mod.field}: "${mod.oldValue}" → "${mod.newValue}"`)
        .join(' | ');
    }
  };

  return (
    <div className={`change-row ${change.type} ${isSelected ? 'selected' : ''}`}>
      <input
        type="checkbox"
        className="change-checkbox"
        checked={isSelected}
        onChange={onToggle}
        title="Sélectionner ce changement"
      />
      <div className="change-content" onClick={onToggle}>
        <div className="change-title">{getChangeTitle()}</div>
        {change.type !== 'modified' && (
          <div className="change-details">{getChangeDetails()}</div>
        )}
        {change.type === 'modified' && change.modifications && (
          <div className="change-modifications">
            {change.modifications
              .filter(mod => !mod.field.startsWith('__')) // Filtrer les champs techniques
              .map((mod, idx) => (
              <div key={idx} className="modification-item">
                <span className="field-name">{mod.field}</span>
                <span className="old-value">"{mod.oldValue}"</span>
                <span className="arrow">→</span>
                <span className="new-value">"{mod.newValue}"</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

DifferencesDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  changes: PropTypes.shape({
    added: PropTypes.array,
    removed: PropTypes.array,
    modified: PropTypes.array,
    summary: PropTypes.object,
  }).isRequired,
  onApply: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

ChangeRow.propTypes = {
  change: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default DifferencesDialog;
