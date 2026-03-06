import React from 'react';
import PropTypes from 'prop-types';

/**
 * ContactNode - Composant memoizé pour un contact
 * Re-render uniquement si ses props directes changent
 */
function ContactNode({
  contact,
  isInOrgchart,
  folderPath,
  onDragStart,
  onRemoveFromFolder
}) {
  const tooltipText = [
    contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : 'Sans nom',
    contact.position && `Poste: ${contact.position}`,
    contact.email && `Email: ${contact.email}`,
    contact.phone && `Tel: ${contact.phone}`
  ].filter(Boolean).join(' | ');

  return (
    <div
      className={`contact-item ${isInOrgchart ? 'in-orgchart' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, contact)}
      title={tooltipText}
    >
      <span className="contact-icon">👤</span>
      <span className="contact-name">
        {contact.firstName} {contact.lastName}
      </span>
      {isInOrgchart && (
        <span className="orgchart-badge" title="Utilisé dans un organigramme">📊</span>
      )}
      <button
        className="remove-btn"
        onClick={() => onRemoveFromFolder(contact.id, folderPath)}
        title="Retirer du dossier"
        aria-label="Retirer du dossier"
      >
        ✕
      </button>
    </div>
  );
}

ContactNode.propTypes = {
  contact: PropTypes.shape({
    id: PropTypes.string.isRequired,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    position: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string
  }).isRequired,
  isInOrgchart: PropTypes.bool,
  folderPath: PropTypes.string.isRequired,
  onDragStart: PropTypes.func.isRequired,
  onRemoveFromFolder: PropTypes.func.isRequired
};

export default React.memo(ContactNode);
