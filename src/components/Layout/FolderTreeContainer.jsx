import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import FolderTree from '../ContactsPanel/FolderTree';

/**
 * FolderTreeContainer - Enveloppe FolderTree avec React.memo
 * Découplé du layout - reçoit uniquement les données métier
 * Ne re-render que si les props métier changent
 */
function FolderTreeContainer({
  folders,
  contacts,
  isContactInOrgchart,
  isReadOnly,
  expandedFolders,
  setExpandedFolders,
  basePath = '',
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
}) {
  // Mémoriser le rendu pour éviter les recalculs
  const folderTreeContent = useMemo(
    () => (
      <FolderTree
        folders={folders}
        contacts={contacts}
        isContactInOrgchart={isContactInOrgchart}
        isReadOnly={isReadOnly}
        expandedFolders={expandedFolders}
        setExpandedFolders={setExpandedFolders}
        path={basePath}
        onAddSubfolder={onAddSubfolder}
        onAddContactToFolder={onAddContactToFolder}
        onRemoveContactFromFolder={onRemoveContactFromFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        dragOverFolder={dragOverFolder}
        setDragOverFolder={setDragOverFolder}
        handleDragStart={handleDragStart}
        handleDragOverFolder={handleDragOverFolder}
        handleDragLeaveFolder={handleDragLeaveFolder}
        handleDropOnFolder={handleDropOnFolder}
      />
    ),
    [
      folders,
      contacts,
      isContactInOrgchart,
      isReadOnly,
      expandedFolders,
      setExpandedFolders,
      basePath,
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
    ]
  );

  return folderTreeContent;
}

FolderTreeContainer.propTypes = {
  folders: PropTypes.object.isRequired,
  contacts: PropTypes.array.isRequired,
  isContactInOrgchart: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool,
  expandedFolders: PropTypes.object,
  setExpandedFolders: PropTypes.func,
  basePath: PropTypes.string,
  onAddSubfolder: PropTypes.func,
  onAddContactToFolder: PropTypes.func,
  onRemoveContactFromFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  dragOverFolder: PropTypes.string,
  setDragOverFolder: PropTypes.func,
  handleDragStart: PropTypes.func,
  handleDragOverFolder: PropTypes.func,
  handleDragLeaveFolder: PropTypes.func,
  handleDropOnFolder: PropTypes.func,
};

// 🔍 TEMPORAIRE: Désactiver React.memo pour DEBUG
//export default React.memo(FolderTreeContainer);
export default FolderTreeContainer;
