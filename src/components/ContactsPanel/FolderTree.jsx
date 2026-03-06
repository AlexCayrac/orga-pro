import React, { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import ContactNode from './ContactNode';
import FolderNode from './FolderNode';
import '../../styles/components/FolderTree.css';

/**
 * Composant récursif pour afficher et gérer un arbre de dossiers
 * Supporte la création de sous-dossiers, drag-drop, renommage, suppression
 * Mode lecture seule: affichage uniquement
 * 
 * Optimisations:
 * - Utilise ContactNode et FolderNode memoizés
 * - useCallback pour handlers
 * - useMemo pour getAllContactsInFolder
 */
function FolderTree({
  folders,
  contacts,
  isContactInOrgchart,
  isReadOnly = false,
  expandedFolders,
  setExpandedFolders,
  onAddSubfolder,
  onAddContactToFolder,
  onRemoveContactFromFolder,
  onRenameFolder,
  onDeleteFolder,
  dragOverFolder,
  setDragOverFolder,
  handleDragStart,
  handleDragOverFolder,
  handleDragLeaveFolder,
  handleDropOnFolder,
  path = '' // Chemin du dossier (ex: "Sales/Team A")
}) {
  // DIAGNOSTIC: Log in useEffect to avoid render cycle
  useEffect(() => {
    console.log(`[FolderTree] 🔍 RENDER - path: "${path}", folders count: ${Object.keys(folders || {}).length}, contacts count: ${contacts?.length || 0}`);
  }, [path, folders, contacts]);

  /**
   * Récupère les contacts du dossier courant ET de ses sous-dossiers
   * Memoizé pour éviter recalculs inutiles
   */
  const getAllContactsInFolder = useCallback((folderObj) => {
    let allIds = [...(folderObj.contacts || [])];
    if (folderObj.subfolders) {
      Object.values(folderObj.subfolders).forEach(subfolder => {
        allIds = [...allIds, ...getAllContactsInFolder(subfolder)];
      });
    }
    return allIds;
  }, []);


  /**
   * Toggle le dossier
   */
  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  }, [setExpandedFolders]);


  /**
   * Récursivement affiche un dictionnaire de dossiers
   * folderDict est de la forme: {"Nom": {subfolders: {}, contacts: [...]}}
   */
  const renderFolderContent = useCallback((folderDict, parentPath = '') => {
    // folderDict est un dictionnaire de dossiers, pas un dossier lui-même
    console.log(`[FolderTree.renderFolderContent] parentPath: "${parentPath}", folders in dict: ${Object.keys(folderDict || {}).length}`);
    
    return Object.entries(folderDict || {}).map(([folderName, folderObj]) => {
      const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
      const isExpanded = expandedFolders[folderPath] !== false;
      console.log(`[FolderTree.renderFolder] folderPath: "${folderPath}", isExpanded: ${isExpanded}, key exists: ${folderPath in expandedFolders}`);
      const folderContacts = folderObj.contacts || [];
      const subfolders = folderObj.subfolders || {};

      // Non-intrusive diagnostic: log contacts count for this folder (use setTimeout to avoid setState-in-render issues)
      try {
        setTimeout(() => {
          console.log(`[FolderTree.folderContacts] folderPath: "${folderPath}", contactsInFolder: ${folderContacts.length}, sampleIDs: ${JSON.stringify(folderContacts.slice(0,3))}`);
        }, 0);
      } catch (e) {
        // ignore
      }

      return (
        <div key={folderPath} className="subfolder-wrapper">
          {/* EN-TÊTE du dossier */}
          <div
            className={`folder-header level-${folderPath.split('/').length}`}
            draggable={false}
            style={{
              backgroundColor: dragOverFolder === folderPath ? '#e8f4f8' : 'transparent'
            }}
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
            
            <span className="folder-name">{folderName}</span>
            <span className="folder-count">({getAllContactsInFolder(folderObj).length})</span>
          </div>

          {/* CONTENU du dossier si expandé */}
          {isExpanded && (
            <div className="folder-contents">
              {/* Contacts du dossier */}
              {folderContacts.map(contactId => {
                const contact = contacts.find(c => c.id === contactId);
                if (!contact) return null;

                  const isInOrgchart = isContactInOrgchart && isContactInOrgchart(contactId);

                return (
                  <ContactNode
                    key={contactId}
                    contact={contact}
                    isInOrgchart={isInOrgchart}
                    folderPath={folderPath}
                    onDragStart={handleDragStart}
                    onRemoveFromFolder={onRemoveContactFromFolder}
                  />
                );
              })}

              {/* Sous-dossiers */}
              {Object.entries(subfolders).map(([subfolderName, subfolderObj]) => {
                const subfolderPath = `${folderPath}/${subfolderName}`;
                const isSubExpanded = expandedFolders[subfolderPath] !== false;
                const subcontentsCount = getAllContactsInFolder(subfolderObj).length;

                // Function to render contacts at this folder level
                const renderContactsAtThisLevel = (contactIds, folderPathForContacts, allContacts) => {
                  return (contactIds || []).map(contactId => {
                    const contact = allContacts.find(c => c.id === contactId);
                    if (!contact) return null;
                    const isInOrgchart = isContactInOrgchart && isContactInOrgchart(contactId);
                    return (
                      <ContactNode
                        key={contactId}
                        contact={contact}
                        isInOrgchart={isInOrgchart}
                        folderPath={folderPathForContacts}
                        onDragStart={handleDragStart}
                        onRemoveFromFolder={onRemoveContactFromFolder}
                      />
                    );
                  });
                };

                return (
                  <FolderNode
                    key={subfolderPath}
                    folderName={subfolderName}
                    folderPath={subfolderPath}
                    folderObj={subfolderObj}
                    isExpanded={isSubExpanded}
                    contactCount={subcontentsCount}
                    isReadOnly={isReadOnly}
                    isDraggedOver={dragOverFolder === subfolderPath}
                    onToggle={() => toggleFolder(subfolderPath)}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('folder', JSON.stringify({ path: subfolderPath }));
                    }}
                    onDragOver={(e) => handleDragOverFolder(e, subfolderPath)}
                    onDragLeave={handleDragLeaveFolder}
                    onDrop={(e) => handleDropOnFolder(e, subfolderPath)}
                    contacts={contacts}
                    renderContactsInFolder={renderContactsAtThisLevel}
                  >
                    {renderFolderContent(subfolderObj.subfolders || {}, subfolderPath)}
                  </FolderNode>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  }, [
    expandedFolders,
    dragOverFolder,
    isContactInOrgchart,
    toggleFolder,
    getAllContactsInFolder,
    isReadOnly,
    handleDragStart,
    handleDragOverFolder,
    handleDragLeaveFolder,
    handleDropOnFolder,
    onRemoveContactFromFolder,
    contacts
  ]);

  return (
    <div className="folder-tree-container">
      <div className="folder-tree-contents">
        {renderFolderContent(folders, path)}
      </div>
    </div>
  );
}

FolderTree.propTypes = {
  folders: PropTypes.object.isRequired,
  contacts: PropTypes.array.isRequired,
  expandedFolders: PropTypes.object.isRequired,
  setExpandedFolders: PropTypes.func.isRequired,
  onAddSubfolder: PropTypes.func,  // Optional en mode lecture seule
  onAddContactToFolder: PropTypes.func,  // Optional en mode lecture seule
  onRemoveContactFromFolder: PropTypes.func,  // Optional en mode lecture seule
  onRenameFolder: PropTypes.func,  // Optional en mode lecture seule
  onDeleteFolder: PropTypes.func,  // Optional en mode lecture seule
  isContactInOrgchart: PropTypes.func,
  isReadOnly: PropTypes.bool,
  dragOverFolder: PropTypes.string,
  setDragOverFolder: PropTypes.func.isRequired,
  handleDragStart: PropTypes.func.isRequired,
  handleDragOverFolder: PropTypes.func.isRequired,
  handleDragLeaveFolder: PropTypes.func.isRequired,
  handleDropOnFolder: PropTypes.func.isRequired,
  path: PropTypes.string
};

export default FolderTree;
