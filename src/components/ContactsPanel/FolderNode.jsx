import React from 'react';
import PropTypes from 'prop-types';

/**
 * FolderNode - Composant memoizé pour un dossier
 * Gère l'affichage et les interactions d'un dossier (expand/drag/drop)
 */
function FolderNode({
  folderName,
  folderPath,
  folderObj,
  isExpanded,
  contactCount,
  isReadOnly,
  isDraggedOver,
  onToggle,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  contacts = [],
  renderContactsInFolder = null
}) {
  const level = folderPath.split('/').length;

  return (
    <div className="subfolder-wrapper">
      <div
        className={`folder-header level-${level}`}
        draggable={!isReadOnly}
        onMouseDown={(e) => {
          if (e.target.closest('.expand-btn')) {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.draggable = false;
            setTimeout(() => {
              e.currentTarget.draggable = !isReadOnly;
            }, 10);
          }
        }}
        onDragStart={!isReadOnly ? onDragStart : undefined}
        onDragEnd={!isReadOnly ? undefined : undefined}
        onDragOver={!isReadOnly ? onDragOver : undefined}
        onDragLeave={!isReadOnly ? onDragLeave : undefined}
        onDrop={!isReadOnly ? onDrop : undefined}
        style={{
          backgroundColor: isDraggedOver ? '#e8f4f8' : 'transparent'
        }}
      >
        <button
          className="expand-btn"
          draggable="false"
          onDragStart={(e) => e.preventDefault()}
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          title={isExpanded ? 'Réduire' : 'Développer'}
          aria-label={isExpanded ? 'Réduire' : 'Développer'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
        <span className="folder-icon">📁</span>
        <span className="folder-name">{folderName}</span>
        <span className="folder-count">({contactCount})</span>
      </div>

      {isExpanded && (
        <div className="folder-contents">
          {/* Render contacts at this folder level if any */}
          {renderContactsInFolder && renderContactsInFolder(folderObj.contacts || [], folderPath, contacts)}
          {/* Render children (subfolders and their nested structures) */}
          {children}
        </div>
      )}
    </div>
  );
}

FolderNode.propTypes = {
  folderName: PropTypes.string.isRequired,
  folderPath: PropTypes.string.isRequired,
  folderObj: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  contactCount: PropTypes.number.isRequired,
  isReadOnly: PropTypes.bool,
  isDraggedOver: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  onDragStart: PropTypes.func,
  onDragOver: PropTypes.func,
  onDragLeave: PropTypes.func,
  onDrop: PropTypes.func,
  children: PropTypes.node,
  contacts: PropTypes.array,
  renderContactsInFolder: PropTypes.func
};

export default React.memo(FolderNode);
