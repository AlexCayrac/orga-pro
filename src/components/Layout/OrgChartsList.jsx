import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import PropTypes from 'prop-types';
import '../../styles/layout/OrgChartsList.css';

/**
 * OrgChartsList - Gère les organigrammes avec support des dossiers
 * Structure: { folderName: { subfolders: {}, orgcharts: [] } }
 */
function OrgChartsList({
  orgcharts,
  orgchartFolders = {},
  selectedOrgChart,
  onSelectOrgChart,
  onCreateOrgChart,
  onUpdateOrgChart,
  onDeleteOrgChart,
  onDuplicateOrgChart = () => {},
  onAddFolder = () => {},
  onAddSubfolder = () => {},
  onMoveOrgchartToFolder = () => {},
  onMoveOrgchartFolderToFolder,
  onRenameFolder,
  onDeleteFolder,
  darkMode = false,
  onToggleDarkMode
}) {
  const [newOrgChartName, setNewOrgChartName] = useState('');
  const [newOrgChartType, setNewOrgChartType] = useState('agency'); // Nouveau state pour le type
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [draggedFolder, setDraggedFolder] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingOrgChartId, setRenamingOrgChartId] = useState(null);
  const [renamingOrgChartValue, setRenamingOrgChartValue] = useState('');
  const [editingOrgChart, setEditingOrgChart] = useState(null); // Organigramme en édition
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('agency');
  const [forceRenderKey, setForceRenderKey] = useState(0); // Force re-render des inputs
  
  // Refs pour les inputs
  const newOrgChartInputRef = useRef(null);
  const newFolderInputRef = useRef(null);

  // Nettoyer les états de drag/renommage quand les dossiers changent
  useEffect(() => {
    setDragOverFolder(null);
    setDraggedFolder(null);
    setRenamingFolder(null);
    setRenameValue('');
  }, [orgchartFolders]);

  // Focus l'input quand forceRenderKey change
  useEffect(() => {
    if (forceRenderKey > 0) {
      setTimeout(() => {
        if (newOrgChartInputRef.current) {
          newOrgChartInputRef.current.focus();
        } else if (newFolderInputRef.current) {
          newFolderInputRef.current.focus();
        }
      }, 50);
    }
  }, [forceRenderKey]);

  const handleCreateNew = () => {
    if (newOrgChartName.trim()) {
      const newOrgChart = {
        id: `org_${Date.now()}`,
        name: newOrgChartName.trim(),
        type: newOrgChartType, // Utiliser le type sélectionné
        blocks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      onCreateOrgChart(newOrgChart);
      setNewOrgChartName('');
      setNewOrgChartType('agency'); // Réinitialiser le type par défaut
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onAddFolder(newFolderName.trim());
      setNewFolderName('');
    }
  };

  // Renommer un dossier
  const handleRenameStart = (folderPath, currentName) => {
    setRenamingFolder(folderPath);
    setRenameValue(currentName);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== renamingFolder.split('/').pop()) {
      onRenameFolder(renamingFolder, renameValue.trim());
    }
    setRenamingFolder(null);
    setRenameValue('');
  };

  // Supprimer un dossier
  const handleDelete = (folderPath) => {
    // Blur active element immediately
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      activeElement.blur();
      activeElement.value = '';
    }
    
    // Clear all interfering states immediately with flushSync
    flushSync(() => {
      setRenamingFolder(null);
      setRenameValue('');
      setDragOverFolder(null);
      setDraggedFolder(null);
      setRenamingOrgChartId(null);
      setRenamingOrgChartValue('');
      setEditingOrgChart(null);
      setEditName('');
      setEditType('agency');
    });
    
    // Delete folder and force re-render
    flushSync(() => {
      onDeleteFolder(folderPath);
      setForceRenderKey(prev => prev + 1);
    });
    
    // Force the input to become interactive again
    setTimeout(() => {
      const input = newOrgChartInputRef.current || newFolderInputRef.current;
      if (input) {
        input.disabled = false;
        input.focus();
      }
    }, 100);
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Drag & drop handlers
  const handleDragOverFolder = (e, folderPath) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderPath);
  };

  const handleDragLeaveFolder = () => {
    setDragOverFolder(null);
  };

  const handleDropOrgchartOnFolder = (e, folderPath) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    
    try {
      // Essayer de récupérer un organigramme dragué
      const orgchartData = e.dataTransfer.getData('orgchart');
      if (orgchartData) {
        const { orgchartId } = JSON.parse(orgchartData);
        onMoveOrgchartToFolder(orgchartId, folderPath);
        return;
      }
      
      // Essayer de récupérer un dossier dragué
      const folderData = e.dataTransfer.getData('orgchartFolder');
      if (folderData) {
        const { path: sourcePath } = JSON.parse(folderData);
        
        // Vérifications pour éviter les opérations invalides
        // 1. Ne pas dropper sur soi-même
        if (sourcePath === folderPath) {
          return;
        }
        
        // 2. Ne pas dropper dans un sous-dossier de soi-même
        if (folderPath.startsWith(sourcePath + '/')) {
          return;
        }
        
        // 3. Ne pas dropper sur son propre parent (le dossier ne changerait pas)
        const parentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
        if (parentPath === folderPath) {
          return; // Aucune action - le dossier est déjà dans ce parent
        }
        
        // Si on arrive ici, le déplacement est valide
        onMoveOrgchartFolderToFolder(sourcePath, folderPath);
        return;
      }
    } catch (err) {
      console.error('Erreur drop:', err);
    }
  };

  const handleDragStartOrgchart = (e, orgchartId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('orgchart', JSON.stringify({ orgchartId }));
  };

  const handleDragStartFolder = (e, folderPath) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('orgchartFolder', JSON.stringify({ path: folderPath }));
    setDraggedFolder(folderPath);
  };

  const handleDragEndFolder = () => {
    setDraggedFolder(null);
    setDragOverFolder(null);
  };

  // Édition complète de l'organigramme (nom + type)
  const handleEditOrgChartOpen = (orgChart) => {
    setEditingOrgChart(orgChart);
    setEditName(orgChart.name);
    setEditType(orgChart.type || 'agency');
  };

  const handleEditOrgChartSave = () => {
    if (editName.trim() && editingOrgChart) {
      const updatedOrgChart = {
        ...editingOrgChart,
        name: editName.trim(),
        type: editType,
        updatedAt: new Date()
      };
      if (typeof onUpdateOrgChart === 'function') {
        onUpdateOrgChart(updatedOrgChart);
      }
      setEditingOrgChart(null);
      setEditName('');
      setEditType('agency');
    }
  };

  const handleEditOrgChartCancel = () => {
    setEditingOrgChart(null);
    setEditName('');
    setEditType('agency');
  };

  // Renommer un organigramme
  const handleRenameOrgChartStart = (orgChart) => {
    setRenamingOrgChartId(orgChart.id);
    setRenamingOrgChartValue(orgChart.name);
  };

  const handleRenameOrgChartSubmit = (orgChart) => {
    if (renamingOrgChartValue.trim() && renamingOrgChartValue !== orgChart.name) {
      const updatedOrgChart = {
        ...orgChart,
        name: renamingOrgChartValue.trim(),
        updatedAt: new Date()
      };
      if (typeof onUpdateOrgChart === 'function') {
        onUpdateOrgChart(updatedOrgChart);
      }
      setRenamingOrgChartId(null);
      setRenamingOrgChartValue('');
    }
  };

  const handleRenameOrgChartCancel = () => {
    setRenamingOrgChartId(null);
    setRenamingOrgChartValue('');
  };

  /**
   * Rend un organigramme
   */
  const renderOrgChartItem = (orgChart) => (
    <div
      key={orgChart.id}
      className={`orgchart-item ${
        selectedOrgChart?.id === orgChart.id ? 'active' : ''
      }`}
      onClick={() => renamingOrgChartId !== orgChart.id && onSelectOrgChart(orgChart)}
      draggable={renamingOrgChartId !== orgChart.id}
      onDragStart={(e) => handleDragStartOrgchart(e, orgChart.id)}
    >
      <div className="orgchart-info">
        {renamingOrgChartId === orgChart.id ? (
          <input
            type="text"
            className="orgchart-rename-input"
            value={renamingOrgChartValue}
            onChange={(e) => setRenamingOrgChartValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameOrgChartSubmit(orgChart);
              } else if (e.key === 'Escape') {
                handleRenameOrgChartCancel();
              }
            }}
            onBlur={() => handleRenameOrgChartSubmit(orgChart)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="orgchart-name">
              {orgChart.name}
              {orgChart.reviewAlerts && Object.keys(orgChart.reviewAlerts || {}).length > 0 && (
                <span className="review-badge" title="Contacts à revoir">🔴 {Object.keys(orgChart.reviewAlerts).length}</span>
              )}
            </div>
            <div className="orgchart-meta">
                      {orgChart.type === 'agency' ? '🏢 Agence' : orgChart.type === 'site' ? '🏗️ Chantier' : '📋 Autres'} • {orgChart.blocks?.length || 0} blocs
            </div>
            {orgChart.updatedAt && (
              <div className="orgchart-date">
                {new Date(orgChart.updatedAt).toLocaleDateString('fr-FR')}
              </div>
            )}
          </>
        )}
      </div>

      <div className="orgchart-actions">
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleEditOrgChartOpen(orgChart);
          }}
          title="Modifier (nom et type)"
          aria-label="Modifier"
        >
          ✏️
        </button>
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onDuplicateOrgChart === 'function') {
              onDuplicateOrgChart(orgChart);
            }
          }}
          title="Dupliquer"
          aria-label="Dupliquer"
        >
          📋
        </button>
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteOrgChart(orgChart.id);
          }}
          title="Supprimer"
          aria-label="Supprimer"
        >
          🗑️
        </button>
      </div>
    </div>
  );

  /**
   * Rend récursivement les dossiers et organigrammes
   */
  const renderFolder = (folderName, folderObj, folderPath = '') => {
    const isExpanded = expandedFolders[folderPath] !== false;
    const orgchartCount = folderObj.orgcharts?.length || 0;
    const subfoldersCount = Object.keys(folderObj.subfolders || {}).length;

    return (
      <div 
        key={folderPath} 
        className={`folder-section ${dragOverFolder === folderPath ? 'drag-over' : ''}`}
        onDragOver={(e) => handleDragOverFolder(e, folderPath)}
        onDragLeave={handleDragLeaveFolder}
        onDrop={(e) => handleDropOrgchartOnFolder(e, folderPath)}
      >
        <div 
          className="folder-header"
          draggable
          onMouseDown={(e) => {
            if (e.target.closest('.expand-btn')) {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.draggable = false;
              setTimeout(() => {
                e.currentTarget.draggable = true;
              }, 10);
            }
          }}
          onDragStart={(e) => handleDragStartFolder(e, folderPath)}
          onDragEnd={handleDragEndFolder}
        >
          <button
            className="expand-btn"
            draggable="false"
            onDragStart={(e) => e.preventDefault()}
            onMouseDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folderPath);
            }}
            title={isExpanded ? 'Réduire' : 'Développer'}
            aria-label={isExpanded ? 'Réduire' : 'Développer'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="folder-icon">📁</span>
          
          {renamingFolder === folderPath ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyPress={(e) => e.key === 'Enter' && handleRenameSubmit()}
              className="rename-input"
              autoFocus
            />
          ) : (
            <>
              <span className="folder-name">{folderName}</span>
              <span className="folder-count">
                ({orgchartCount}{subfoldersCount > 0 ? `+${subfoldersCount}` : ''})
              </span>
              <button
                className="folder-action-btn rename-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameStart(folderPath, folderName);
                }}
                title="Renommer"
              >
                ✏️
              </button>
              <button
                className="folder-action-btn delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(folderPath);
                }}
                title="Supprimer"
              >
                🗑️
              </button>
            </>
          )}
        </div>

        {isExpanded && (
          <div className="folder-contents">
            {/* Sous-dossiers EN PREMIER (au-dessus) */}
            {Object.entries(folderObj.subfolders || {}).map(([subName, subObj]) => {
              const subPath = folderPath ? `${folderPath}/${subName}` : subName;
              return renderFolder(subName, subObj, subPath);
            })}

            {/* Organigrammes du dossier courant (EN DESSOUS) */}
            {(folderObj.orgcharts || []).map(orgchartId => {
              const orgChart = orgcharts.find(o => o.id === orgchartId);
              return orgChart ? renderOrgChartItem(orgChart) : null;
            })}
          </div>
        )}
      </div>
    );
  };

  // Organiser les organigrammes non rangés
  const rangedOrgchartIds = new Set();
  const getAllRangedIds = (folderObj) => {
    (folderObj.orgcharts || []).forEach(id => rangedOrgchartIds.add(id));
    Object.values(folderObj.subfolders || {}).forEach(sub => {
      getAllRangedIds(sub);
    });
  };
  Object.values(orgchartFolders).forEach(folderObj => getAllRangedIds(folderObj));

  const unrangedOrgcharts = orgcharts.filter(o => !rangedOrgchartIds.has(o.id));

  return (
    <div 
      className="orgcharts-list-panel"
      onMouseUp={() => {
        setDragOverFolder(null);
        setDraggedFolder(null);
      }}
      onMouseLeave={() => {
        setDragOverFolder(null);
        setDraggedFolder(null);
      }}
      onDragEnd={() => {
        setDragOverFolder(null);
        setDraggedFolder(null);
      }}
    >
      <div className="panel-header">
        <h2>📋 Organigrammes</h2>
        <span className="count-badge">{orgcharts.length}</span>
      </div>

      {/* Création d'un nouvel organigramme */}
      <div className="new-orgchart-box">
        <input
          key={`orgchart-${forceRenderKey}`}
          ref={newOrgChartInputRef}
          type="text"
          placeholder="Nom du nouvel organigramme..."
          value={newOrgChartName}
          onChange={(e) => setNewOrgChartName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCreateNew()}
          className="input-text"
        />
        <select
          value={newOrgChartType}
          onChange={(e) => setNewOrgChartType(e.target.value)}
          className="input-select"
          title="Type d'organigramme"
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            minWidth: '120px'
          }}
        >
          <option value="agency">🏢 Agence</option>
          <option value="site">🏗️ Chantier</option>
          <option value="other">📋 Autres</option>
        </select>
        <button onClick={handleCreateNew} className="btn btn-create">
          ➕
        </button>
      </div>

      {/* Création d'un nouveau dossier */}
      <div className="new-folder-box">
        <input
          key={`folder-${forceRenderKey}`}
          ref={newFolderInputRef}
          type="text"
          placeholder="Nouveau dossier..."
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          className="input-text small"
        />
        <button onClick={handleCreateFolder} className="btn btn-small">
          📁
        </button>
      </div>

      {/* Liste des dossiers */}
      <div className="orgcharts-list">
        {Object.keys(orgchartFolders).length === 0 && unrangedOrgcharts.length === 0 ? (
          <div className="empty-state">Aucun organigramme créé</div>
        ) : (
          <>
            {/* Dossiers */}
            {Object.entries(orgchartFolders).map(([folderName, folderObj]) =>
              renderFolder(folderName, folderObj, folderName)
            )}

            {/* Organigrammes non rangés */}
            {unrangedOrgcharts.length > 0 && (
              <div className="unranged-section">
                <div className="section-label">Non rangés ({unrangedOrgcharts.length})</div>
                {unrangedOrgcharts.map(orgChart =>
                  renderOrgChartItem(orgChart)
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: Édition de l'organigramme */}
      {editingOrgChart && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={handleEditOrgChartCancel}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              maxWidth: '400px',
              width: '90%',
              animation: 'slideIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
              ✏️ Modifier l'organigramme
            </h3>

            {/* Nom */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#333' }}>
                Nom
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#333' }}>
                Type
              </label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <option value="agency">🏢 Agence</option>
                <option value="site">🏗️ Chantier</option>
                <option value="other">📋 Autres</option>
              </select>
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleEditOrgChartSave}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                ✓ Enregistrer
              </button>
              <button
                onClick={handleEditOrgChartCancel}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                ✕ Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

OrgChartsList.propTypes = {
  orgcharts: PropTypes.arrayOf(PropTypes.object).isRequired,
  orgchartFolders: PropTypes.object,
  selectedOrgChart: PropTypes.object,
  onSelectOrgChart: PropTypes.func.isRequired,
  onCreateOrgChart: PropTypes.func.isRequired,
  onUpdateOrgChart: PropTypes.func,
  onDeleteOrgChart: PropTypes.func.isRequired,
  onAddFolder: PropTypes.func,
  onAddSubfolder: PropTypes.func,
  onMoveOrgchartToFolder: PropTypes.func,
};

export default OrgChartsList;
