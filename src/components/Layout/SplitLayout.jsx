import React from 'react';
import '../../styles/layout/SplitLayout.css';

/**
 * SplitLayout
 * Composant wrapper qui gère UNIQUEMENT le state du resize du diviseur
 * 
 * Le state du layout est isolé ici et n'affecte pas le re-render des enfants
 * Les enfants reçoivent la hauteur via une CSS variable (pas de prop)
 * 
 * ⚠️ IMPORTANT: On utilise des render functions au lieu d'éléments JSX directs
 * pour éviter que React remonte les composants à chaque re-render du parent
 */
function SplitLayout({ leftPanel, rightPanel }) {
  // Si les props sont des fonctions (render functions), les appeler
  // Sinon, les utiliser directement (pour compatibilité rétroactive)
  const renderLeftPanel = typeof leftPanel === 'function' ? leftPanel() : leftPanel;
  const renderRightPanel = typeof rightPanel === 'function' ? rightPanel() : rightPanel;

  return (
    <div className="split-layout">
      {/* Panneau gauche (ContactsPanel) */}
      <div className="split-left">
        {renderLeftPanel}
      </div>

      {/* Panneau droit (OrgChartCanvas + OrgChartsList) */}
      <div className="split-right">
        {renderRightPanel}
      </div>
    </div>
  );
}

export default SplitLayout;

