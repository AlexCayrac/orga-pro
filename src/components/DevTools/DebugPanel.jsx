import React, { useState, useEffect } from 'react';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import '../../styles/components/DebugPanel.css';

/**
 * Panneau de débogage - Affiche les erreurs et logs en temps réel
 */
function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('errors');

  useEffect(() => {
    // Mise à jour des erreurs
    const handleError = (errorEntry) => {
      setErrors((prev) => [...prev, errorEntry].slice(-50)); // Garde derniers 50
    };

    errorHandler.onError(handleError);

    return () => {
      errorHandler.offError(handleError);
    };
  }, []);

  useEffect(() => {
    // Mise à jour des logs (toutes les 500ms)
    const interval = setInterval(() => {
      setLogs(logger.exportLogs().slice(-50));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  if (!isOpen) {
    return (
      <button
        className="debug-toggle"
        onClick={() => setIsOpen(true)}
        title="Ouvrir le panneau de débogage (F12)"
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>Panneau de Débogage en Temps Réel</h3>
        <button
          className="debug-close"
          onClick={() => setIsOpen(false)}
        >
          ✕
        </button>
      </div>

      <div className="debug-tabs">
        <button
          className={`tab ${activeTab === 'errors' ? 'active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          Erreurs ({errors.length})
        </button>
        <button
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs ({logs.length})
        </button>
      </div>

      <div className="debug-content">
        {activeTab === 'errors' && (
          <div className="errors-list">
            {errors.length === 0 ? (
              <p className="no-data">✓ Aucune erreur détectée</p>
            ) : (
              errors.map((error) => (
                <div key={error.id} className="error-item">
                  <div className="error-header">
                    <span className={`severity ${error.severity}`}>
                      {error.severity}
                    </span>
                    <span className="timestamp">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="error-message">{error.message}</p>
                  {error.stack && (
                    <details className="error-details">
                      <summary>Stack Trace</summary>
                      <pre>{error.stack}</pre>
                    </details>
                  )}
                  {Object.keys(error.context).length > 0 && (
                    <details className="error-context">
                      <summary>Contexte</summary>
                      <pre>{JSON.stringify(error.context, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="logs-list">
            {logs.length === 0 ? (
              <p className="no-data">Aucun log</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={`log-item log-${log.level.toLowerCase()}`}>
                  <span className="log-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="log-level">[{log.level}]</span>
                  <span className="log-module">{log.module}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="debug-footer">
        <button onClick={() => {
          errorHandler.clearErrors();
          logger.clearLogs();
          setErrors([]);
          setLogs([]);
        }}>
          Effacer les données
        </button>
        <button onClick={() => {
          const data = {
            errors: errorHandler.exportErrors(),
            logs: JSON.stringify(logger.exportLogs(), null, 2),
          };
          logger.info('Export Debug Data', data);
          alert('Données exportées dans la console');
        }}>
          Exporter
        </button>
      </div>
    </div>
  );
}

export default DebugPanel;
