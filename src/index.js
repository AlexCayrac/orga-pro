import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './styles/App.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// 🔑 NOTE: Désactiver StrictMode en développement pour éviter les double-rendus
// qui causent des scintillements visuels. StrictMode force React à monter/démonter
// les composants deux fois pour déterminer les bugs, mais cela crée des scintillements
// visibles lors de l'import Excel. En production, StrictMode ne sera pas utilisé.
root.render(
  <App />
);
