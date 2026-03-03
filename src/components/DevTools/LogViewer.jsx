import React, { useState, useEffect, useRef } from 'react';

/**
 * LogViewer - Affiche les logs en bas à droite
 * Capture les console.log pour le débogage
 */
function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [filterText, setFilterText] = useState('');
  const logsRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [isExpandedLarge, setIsExpandedLarge] = useState(false);

  // Compute visible logs according to filter
  const visibleLogs = (filterText || '').toString()
    ? logs.filter(l => l.message && l.message.includes(filterText))
    : logs;

  const handleCopyFiltered = async () => {
    try {
      const text = visibleLogs.map(l => `[${l.timestamp}] ${l.message}`).join('\n');
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
      console.error('Copy failed', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  useEffect(() => {
    // Intercepter console.log
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (message, level = 'info') => {
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => {
        const newLogs = [...prev, { message, level, timestamp }];
        // Garder seulement les 500 derniers logs
        return newLogs.slice(-500);
      });
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '), 'info');
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '), 'warn');
    };

    console.error = (...args) => {
      originalError(...args);
      addLog(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '), 'error');
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // Auto-scroll vers le bas
  useEffect(() => {
    if (logsRef.current && isOpen) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const getLogColor = (level) => {
    switch (level) {
      case 'error': return '#ff4444';
      case 'warn': return '#ffaa00';
      default: return '#ffffff';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9999,
      fontFamily: 'monospace',
      fontSize: '11px'
    }}>
      {/* Bouton toggle */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            padding: '8px 12px',
            backgroundColor: '#222',
            border: '1px solid #666',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold'
          }}
        >
          📋 Logs
        </button>
      )}

      {/* Fenêtre logs */}
      {isOpen && (
        <div style={{
          width: isExpandedLarge ? '800px' : '600px',
          height: isMinimized ? '30px' : (isExpandedLarge ? '500px' : '400px'),
          backgroundColor: '#1e1e1e',
          border: '1px solid #444',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            backgroundColor: '#2d2d2d',
            borderBottom: '1px solid #444',
            cursor: 'move',
            flexWrap: 'wrap'
          }}>
            <span style={{ color: '#aaa', fontWeight: 'bold' }}>📋 Logs ({logs.length})</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                aria-label="Filtre logs"
                placeholder="Filtre rapide (ex: [App] 📊)"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                style={{
                  padding: '4px 6px',
                  fontSize: '11px',
                  borderRadius: 3,
                  border: '1px solid #555',
                  backgroundColor: '#222',
                  color: '#fff'
                }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => setFilterText('')} style={{ fontSize: 10 }}>All</button>
                  <button onClick={() => setFilterText('[App] 📊 Premier contact importé:')} style={{ fontSize: 10 }}>Import</button>
                  <button onClick={() => setFilterText('[App][DIAG] importedContacts IDs:')} style={{ fontSize: 10 }}>Imported IDs</button>
                  <button onClick={() => setFilterText('[App][DIAG] Folder IDs -')} style={{ fontSize: 10 }}>Folder IDs</button>
                </div>
              </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                onClick={() => setLogs([])}
                style={{
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #666',
                  borderRadius: '2px',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                Clear
              </button>
              <button
                onClick={handleCopyFiltered}
                title="Copier les logs filtrés"
                style={{
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #666',
                  borderRadius: '2px',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '10px',
                  marginLeft: 6
                }}
              >
                {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Error' : 'Copy'}
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #666',
                  borderRadius: '2px',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                {isMinimized ? '▲' : '▼'}
              </button>
              <button
                onClick={() => setIsExpandedLarge(!isExpandedLarge)}
                title="Agrandir/Restaurer"
                style={{
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #666',
                  borderRadius: '2px',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '10px',
                  marginLeft: 6
                }}
              >
                {isExpandedLarge ? 'Restore' : 'Expand'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #666',
                  borderRadius: '2px',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div
              ref={logsRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px',
                backgroundColor: '#1e1e1e',
                color: '#00ff00',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}
            >
              {logs.length === 0 ? (
                <div style={{ color: '#666' }}>Aucun log pour le moment...</div>
              ) : (
                (() => {
                  const q = (filterText || '').toString();
                  const visible = q ? logs.filter(l => l.message && l.message.includes(q)) : logs;
                  return visible.map((log, idx) => (
                    <div
                      key={idx}
                      style={{
                        color: getLogColor(log.level),
                        marginBottom: '4px'
                      }}
                    >
                      <span style={{ color: '#666' }}>[{log.timestamp}]</span> {log.message}
                    </div>
                  ));
                })()
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LogViewer;
