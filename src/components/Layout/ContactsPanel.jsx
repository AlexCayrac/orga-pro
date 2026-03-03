import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import FolderTreeContainer from './FolderTreeContainer';
import '../../styles/layout/ContactsPanel.css';

/**
 * Volet Contacts/Dossiers (gauche)
 * Modes:
 * - isReadOnly=false: Gestion complète (ajout/suppression/renommage/drag-drop)
 * - isReadOnly=true: Lecture seule (affichage des dossiers auto-générés par Agence/Poste)
 * 
 * ⚠️ Composant ITHPURE (React.memo) - Le state du layout est dans SplitLayout
 */
function ContactsPanel({ 
  contacts, 
  folders, 
  orgcharts = [],
  isReadOnly = false,
  onAddFolder,
  onAddSubfolder,
  onAddContactToFolder, 
  onRemoveContactFromFolder,
  onMoveFolderToFolder,
  onRenameFolder,
  onDeleteFolder,
  expandedFolders = {},
  setExpandedFolders = () => {},
  expandedSections = { contacts: true },
  setExpandedSections = () => {}
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [draggedFolder, setDraggedFolder] = useState(null);
  const searchInputRef = useRef(null);

  // DIAGNOSTIC: Log props on mount and when they change (OUTSIDE render)
  useEffect(() => {
    if (contacts?.length > 0) {
      console.log('[ContactsPanel] ✅ RENDER - Received props:', {
        contactsCount: contacts.length,
        foldersCount: Object.keys(folders || {}).length,
        expandedFoldersCount: Object.keys(expandedFolders || {}).length
      });
    }
  }, [contacts, folders, expandedFolders]);

  // DIAGNOSTIC: inspect structure of a sample agence (Thuir) safely
  useEffect(() => {
    try {
      const sample = folders && folders['Thuir'];
      if (sample) {
        // Log shallow keys to avoid huge dumps
        console.log('[ContactsPanel] DEBUG Thuir keys:', Object.keys(sample));
        if (sample.subfolders) {
          console.log('[ContactsPanel] DEBUG Thuir.subfolders keys (first 10):', Object.keys(sample.subfolders).slice(0,10));
          const firstRegroup = Object.values(sample.subfolders)[0];
          if (firstRegroup) {
            console.log('[ContactsPanel] DEBUG sample regroupement shape:', {
              hasContactsArray: Array.isArray(firstRegroup.contacts),
              subfoldersCount: Object.keys(firstRegroup.subfolders || {}).length
            });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, [folders]);

  // DIAGNOSTIC: log specific nested folder objects for deeper inspection
  useEffect(() => {
    try {
      if (folders && folders['Thuir'] && folders['Thuir'].subfolders) {
        const dir = folders['Thuir'].subfolders['Direction'];
        console.log('[ContactsPanel] DEBUG Thuir.Direction exists:', !!dir);
        if (dir) {
          console.log('[ContactsPanel] DEBUG Thuir.Direction keys:', Object.keys(dir));
          console.log('[ContactsPanel] DEBUG Thuir.Direction.contacts length:', Array.isArray(dir.contacts) ? dir.contacts.length : 'no-array');
          const chef = dir.subfolders && dir.subfolders["Chef d'agence"];
          console.log('[ContactsPanel] DEBUG Thuir.Direction[Chef d\'agence] exists:', !!chef);
          if (chef) {
            console.log('[ContactsPanel] DEBUG Chef d\'agence contacts length:', Array.isArray(chef.contacts) ? chef.contacts.length : 'no-array');
            console.log('[ContactsPanel] DEBUG Chef d\'agence sample contacts:', (chef.contacts || []).slice(0,5));
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, [folders]);

  /**
   * Vérifie si un contact est utilisé dans un organigramme (mémoïsé)
   */
  const isContactInOrgchart = useCallback((contactId) => {
    return orgcharts.some(orgchart => {
      if (!orgchart.blocks || !Array.isArray(orgchart.blocks)) return false;
      return orgchart.blocks.some(block => block.contactId === contactId);
    });
  }, [orgcharts]);

  // Toggle section (mémoïsé)
  const toggleSection = useCallback((sectionName) => {
    setExpandedSections({
      ...expandedSections,
      [sectionName]: !expandedSections[sectionName],
    });
  }, [expandedSections, setExpandedSections]);
  const handleDragStart = useCallback((e, contact) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('contact', JSON.stringify(contact));
  }, []);

  // Drag over folder (mémoïsé)
  const handleDragOverFolder = useCallback((e, folderPath) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderPath);
  }, []);

  // Drag leave folder (mémoïsé)
  const handleDragLeaveFolder = useCallback(() => {
    setDragOverFolder(null);
  }, []);

  // Drop on folder (mémoïsé)
  const handleDropOnFolder = useCallback((e, folderPath) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    
    try {
      // Les contacts ne doivent plus être droppés dans les dossiers
      // Ils ne doivent dropper que sur le canvas
      
      // Gestion uniquement pour les dossiers
      const folderData = e.dataTransfer.getData('folder');
      if (folderData) {
        const sourceFolder = JSON.parse(folderData);
        onMoveFolderToFolder(sourceFolder.path, folderPath);
        setDraggedFolder(null);
      }
    } catch (err) {
      console.error('Erreur drop:', err);
    }
  }, [onMoveFolderToFolder]);

  // Drag start pour dossier (mémoïsé)
  const handleDragStartFolder = useCallback((e, folderPath) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('folder', JSON.stringify({ path: folderPath }));
    setDraggedFolder(folderPath);
  }, []);

  // Drag end pour dossier (mémoïsé)
  const handleDragEndFolder = useCallback(() => {
    setDraggedFolder(null);
    setDragOverFolder(null);
  }, []);

  /**
   * Récupère tous les IDs de contacts dans tous les dossiers (récursivement)
   */
  const getAllFolderedContactIds = useCallback((folderObj) => {
    if (!folderObj || typeof folderObj !== 'object') {
      return [];
    }
    
    let ids = Array.isArray(folderObj.contacts) ? [...folderObj.contacts] : [];
    
    if (folderObj.subfolders && typeof folderObj.subfolders === 'object') {
      Object.values(folderObj.subfolders).forEach(subFolder => {
        if (subFolder) {
          ids = [...ids, ...getAllFolderedContactIds(subFolder)];
        }
      });
    }
    return ids;
  }, []);

  /**
   * Compte tous les contacts dans un dossier, incluant les sous-dossiers
   */
  const getTotalContactCountInFolder = useCallback((folderObj) => {
    if (!folderObj || typeof folderObj !== 'object') {
      return 0;
    }
    
    let count = Array.isArray(folderObj.contacts) ? folderObj.contacts.length : 0;
    
    if (folderObj.subfolders && typeof folderObj.subfolders === 'object') {
      Object.values(folderObj.subfolders).forEach(subFolder => {
        if (subFolder) {
          count += getTotalContactCountInFolder(subFolder);
        }
      });
    }
    return count;
  }, []);

  // Obtenir tous les contacts organisés (mémoïsé)
  const allFolderedContactIds = useMemo(() => {
    const ids = new Set();
    if (folders && typeof folders === 'object') {
      Object.values(folders).forEach(folderObj => {
        if (folderObj) {
          getAllFolderedContactIds(folderObj).forEach(id => ids.add(id));
        }
      });
    }
    return ids;
  }, [folders, getAllFolderedContactIds]);

  // Filtrage de recherche (si l'utilisateur tape dans la barre de recherche)
  const filteredContacts = useMemo(() => {
    const q = (searchTerm || '').trim();
    if (!q) return null;
    
    // Fonction pour normaliser les accents
    const normalizeText = (text) => {
      return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Enlève les diacritiques
    };
    
    const normalizedQuery = normalizeText(q);
    
    return (contacts || []).filter(c => {
      const firstName = normalizeText(c.firstName || '');
      const lastName = normalizeText(c.lastName || '');
      const position = normalizeText(c.position || '');
      
      // Cherche UNIQUEMENT au début du prénom ou du nom
      if (firstName.startsWith(normalizedQuery)) return true;
      if (lastName.startsWith(normalizedQuery)) return true;
      
      // Pour position, cherche au début des mots
      if (position) {
        const positionWords = position.split(/[\s\-]/);
        if (positionWords.some(word => word.startsWith(normalizedQuery))) return true;
      }
      
      return false;
    });
  }, [contacts, searchTerm]);

  return (
    <div className="contacts-panel">
      {/* En-tête */}
      <div className="panel-header">
        <h2>👥 Contacts</h2>
        <span className="contact-count">{contacts.length}</span>
      </div>

      {/* Barre de recherche */}
      <div className="search-box">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="🔍 Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Si une recherche est active, afficher une liste plate des résultats */}
      {filteredContacts ? (
        <div className="search-results">
          <div className="section-header">
            <h3>🔎 Résultats de recherche ({filteredContacts.length})</h3>
            <button className="btn btn-small" onClick={() => { setSearchTerm(''); searchInputRef.current && (searchInputRef.current.value = ''); }} style={{marginLeft:8}}>✕ Effacer</button>
          </div>
          {filteredContacts.length === 0 ? (
            <div className="empty-state">Aucun contact trouvé</div>
          ) : (
            filteredContacts.map(contact => (
              <div
                key={contact.id}
                className="contact-item"
                draggable
                onDragStart={(e) => handleDragStart(e, contact)}
                title={[contact.firstName, contact.lastName].filter(Boolean).join(' ')}
              >
                <span className="contact-icon">👤</span>
                <span className="contact-name">{contact.firstName} {contact.lastName}</span>
                <span className="contact-position">{contact.position}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="folders-section">
        <div className="section-header">
          <h3>📁 Dossiers {isReadOnly && <span className="read-only-badge">(lecture seule)</span>}</h3>
        </div>
        <div className="folders-list">
          {Object.keys(folders || {}).length === 0 ? (
            <div className="empty-state">Aucun dossier</div>
          ) : (
            Object.entries(folders).map(([folderName, folderObj]) => (
              <div
                key={folderName}
                className={`folder-item ${dragOverFolder === folderName ? 'drag-over' : ''} ${draggedFolder === folderName ? 'dragging' : ''}`}
                onDragOver={!isReadOnly ? (e) => handleDragOverFolder(e, folderName) : undefined}
                onDragLeave={!isReadOnly ? handleDragLeaveFolder : undefined}
                onDrop={!isReadOnly ? (e) => handleDropOnFolder(e, folderName) : undefined}
              >
                <div 
                  className="folder-header"
                  draggable={!isReadOnly}
                  onMouseDown={(e) => {
                    if (e.target.closest('.folder-toggle-btn')) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.draggable = false;
                      setTimeout(() => {
                        e.currentTarget.draggable = !isReadOnly;
                      }, 10);
                    }
                  }}
                  onDragStart={!isReadOnly ? (e) => handleDragStartFolder(e, folderName) : undefined}
                  onDragEnd={!isReadOnly ? handleDragEndFolder : undefined}
                >
                  <button
                    className="folder-toggle-btn"
                    draggable="false"
                    onDragStart={(e) => e.preventDefault()}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedFolders({
                        ...expandedFolders,
                        [folderName]: !expandedFolders[folderName],
                      });
                    }}
                  >
                    {expandedFolders[folderName] ? '▼' : '▶'}
                  </button>
                  <span className="folder-icon">📁</span>
                  <span className="folder-name">{folderName}</span>
                  <span className="folder-count">
                    ({getTotalContactCountInFolder(folderObj)})
                  </span>
                </div>
                {expandedFolders[folderName] && (
                  <div className="folder-contents">
                    {(folderObj.contacts || []).map(contactId => {
                      const contact = contacts.find(c => c.id === contactId);
                      if (!contact) return null;
                        const tooltipText = [
                          contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : 'Sans nom',
                          contact.position && `Poste: ${contact.position}`,
                          contact.email && `Email: ${contact.email}`,
                          contact.phone && `Tel: ${contact.phone}`
                        ].filter(Boolean).join(' | ');
                        return (
                          <div
                            key={contactId}
                            className="contact-item"
                            draggable
                            onDragStart={(e) => handleDragStart(e, contact)}
                            title={tooltipText}
                          >
                            <span className="contact-icon">👤</span>
                            <span className="contact-name">
                              {contact.firstName} {contact.lastName}
                            </span>
                            <span className="contact-position">{contact.position}</span>
                            <button
                              className="remove-btn"
                              onClick={() =>
                                onRemoveContactFromFolder(contactId, folderName)
                              }
                              title="Retirer du dossier"
                              aria-label="Retirer du dossier"
                            >
                              ✕
                            </button>
                          </div>
                        );
                    })}
                    <FolderTreeContainer
                      folders={folderObj.subfolders || {}}
                      contacts={contacts}
                      isContactInOrgchart={isContactInOrgchart}
                      isReadOnly={isReadOnly}
                      expandedFolders={expandedFolders}
                      setExpandedFolders={setExpandedFolders}
                      basePath={folderName}
                      onAddSubfolder={!isReadOnly ? (path, name) =>
                        onAddSubfolder(`${folderName}/${path}`, name)
                      : undefined}
                      onAddContactToFolder={!isReadOnly ? (contactId, path) =>
                        onAddContactToFolder(contactId, `${folderName}/${path}`)
                      : undefined}
                      onRemoveContactFromFolder={!isReadOnly ? (contactId, path) =>
                        onRemoveContactFromFolder(
                          contactId,
                          `${folderName}/${path}`
                        )
                      : undefined}
                      onRenameFolder={!isReadOnly ? (path, newName) =>
                        onRenameFolder(`${folderName}/${path}`, newName)
                      : undefined}
                      onDeleteFolder={!isReadOnly ? (path) =>
                        onDeleteFolder(`${folderName}/${path}`)
                      : undefined}
                      dragOverFolder={dragOverFolder}
                      setDragOverFolder={setDragOverFolder}
                      handleDragStart={handleDragStart}
                      handleDragOverFolder={handleDragOverFolder}
                      handleDragLeaveFolder={handleDragLeaveFolder}
                      handleDropOnFolder={handleDropOnFolder}
                      path={folderName}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        </div>
      )}
    </div>
  );
}

ContactsPanel.propTypes = {
  contacts: PropTypes.arrayOf(PropTypes.object).isRequired,
  folders: PropTypes.object.isRequired,
  isReadOnly: PropTypes.bool,
  onAddSubfolder: PropTypes.func,
  onAddContactToFolder: PropTypes.func,
  onRemoveContactFromFolder: PropTypes.func,
};

// Mémoïser le composant - ne re-render que si les props changent
// 🔍 TEMPORAIRE: Désactiver React.memo pour DEBUG
//export default React.memo(ContactsPanel);
export default ContactsPanel;
