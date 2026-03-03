// Petit exemple côté renderer: appeler l'IPC puis dessiner en console
// Utilise window.electronAPI.placerOrganigramme(nodes)

async function demoDrawOrganigram() {
  const sampleNodes = [
    { id: '1', name: 'CEO', role: 'CEO' },
    { id: '2', name: 'CTO', role: 'CTO', parentId: '1' },
    { id: '3', name: 'CFO', role: 'CFO', parentId: '1' },
    { id: '4', name: 'Dev A', role: 'Dev', parentId: '2' },
    { id: '5', name: 'Dev B', role: 'Dev', parentId: '2' },
    { id: '6', name: 'Acct', role: 'Accounting', parentId: '3' }
  ];

  // Appel IPC
  let positioned = [];
  try {
    if (window && window.electronAPI && typeof window.electronAPI.placerOrganigramme === 'function') {
      positioned = await window.electronAPI.placerOrganigramme(sampleNodes);
    } else if (window && window.ipcRenderer) {
      positioned = await window.ipcRenderer.invoke('placer-organigramme', sampleNodes);
    } else {
      // Fallback local require (dev-mode when running in browserless tests)
      try {
        const placer = require('../modules/iaPlacementOrganigramme.js');
        positioned = placer.placerOrganigramme(sampleNodes);
      } catch (e) {
        console.warn('No ipc available and require failed', e);
        positioned = sampleNodes;
      }
    }
  } catch (err) {
    console.error('Erreur placerOrganigramme:', err);
    positioned = sampleNodes;
  }

  // Simple dessin: console + création d'éléments DOM
  const container = document.getElementById('organigram-demo') || document.body;
  const wrapper = document.createElement('div');
  wrapper.style.padding = '12px';
  wrapper.style.fontFamily = 'Arial, sans-serif';

  positioned.forEach(n => {
    const el = document.createElement('div');
    el.textContent = `${n.name} (${n.role}) — x:${Math.round(n.x)}, y:${Math.round(n.y)}`;
    el.style.margin = '4px 0';
    wrapper.appendChild(el);
  });

  container.appendChild(wrapper);
}

// Exposer pour usage manuel depuis la console
window.__demoDrawOrganigram = demoDrawOrganigram;

export default demoDrawOrganigram;
