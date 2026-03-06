import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../../styles/layout/TopBar.css';
import SettingsPanel from '../Dialogs/SettingsPanel';
import packageJson from '../../../package.json';

function TopBar({ onImportExcel, hasExcelLoaded = false, onClearAllData, onRefresh, onExport, onCheckUpdates, differencesCount = 0, selectedOrgChart }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1 className="app-title">📊 Orga PRO <span className="app-version">v{packageJson.version}</span></h1>
          <p className="app-subtitle">Gestion d'organigrammes</p>
        </div>

        <div className="topbar-actions">
          <button className="btn btn-action" onClick={onImportExcel} title="Importer un fichier Excel">
            📥 Importer Excel
          </button>

          <button className="btn btn-action" onClick={onRefresh} title="Actualiser l'affichage">
            🔄 Actualiser
          </button>

          <button
            className="btn btn-action"
            onClick={() => onCheckUpdates(false)}
            title="Vérifier les mises à jour du fichier Excel"
          >
            📊 Mise à jour
            <span className={`difference-badge ${differencesCount > 0 ? 'has-differences' : ''}`} title={`${differencesCount} différence(s)`}>
              {differencesCount}
            </span>
          </button>

          <button className="btn btn-action" onClick={onExport} title="Exporter l'organigramme">
            📤 Exporter
          </button>

          <button 
            className="btn btn-action" 
            title="Paramètres généraux"
            onClick={() => setShowSettings(true)}
          >
            ⚙️ Paramètres
          </button>
        </div>
      </div>

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onClearAllData={onClearAllData}
      />
    </>
  );
}

export default TopBar;

TopBar.propTypes = {
  onImportExcel: PropTypes.func.isRequired,
  onClearAllData: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onCheckUpdates: PropTypes.func.isRequired,
  onExport: PropTypes.func,
  hasExcelLoaded: PropTypes.bool,
  differencesCount: PropTypes.number,
  selectedOrgChart: PropTypes.object,
};
