import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import '../../styles/common/LoadingOverlay.css';

/**
 * LoadingOverlay - Overlay bloquant avec spinner
 * Utilisé pour indiquer que l'application traite une opération longue
 * 
 * 🔑 IMPORTANT: On retire le DOM après la transition pour éviter les problèmes
 * de focus management et de pointer-events du navigateur
 */
function LoadingOverlay({ isVisible, message = 'Traitement en cours...', onDismissed }) {
  // État local pour contrôler le rendu du DOM
  // On ne retire le DOM qu'APRÈS la fin de l'animation
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      // Afficher immédiatement
      setShouldRender(true);
      console.log('[LoadingOverlay] Rendu activé, isVisible=true');
    } else {
      // Retirer du DOM après que l'opacity transition soit terminée (250ms)
      console.log('[LoadingOverlay] isVisible=false, programmation retrait du DOM pour 250ms');
      const timer = setTimeout(() => {
        console.log('[LoadingOverlay] 🔔 Timeout 250ms atteint - Retrait du DOM');
        setShouldRender(false);
        console.log('[LoadingOverlay] ✓ setState(shouldRender=false) exécuté');
        
        // 🔑 CALLBACK: Informer le parent que l'overlay est complètement retiré
        if (onDismissed) {
          console.log('[LoadingOverlay] 🔔 Exécution du callback onDismissed');
          try {
            onDismissed();
            console.log('[LoadingOverlay] ✅ Callback onDismissed complété');
          } catch (err) {
            console.error('[LoadingOverlay] ❌ Erreur dans callback onDismissed:', err);
          }
        } else {
          console.log('[LoadingOverlay] ⚠️ onDismissed non fourni');
        }
      }, 250);
      return () => {
        console.log('[LoadingOverlay] Cleanup: clearing timeout');
        clearTimeout(timer);
      };
    }
  }, [isVisible, onDismissed]);

  // 🔑 Si pas visible ET pas rendu localement, retourner null COMPLETEMENT
  // Cela retire le DOM et évite TOUS les problèmes de pointer-events/focus
  if (!shouldRender) {
    return null;
  }

  return (
    <div 
      className="loading-overlay" 
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        // 🔑 Transition simple pour la disparition
        transition: 'opacity 0.25s ease-out',
      }}
      role="status" 
      aria-live="polite" 
      aria-busy={isVisible}
    >
      <div className="loading-content">
        <div className="spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
}

LoadingOverlay.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  message: PropTypes.string,
  onDismissed: PropTypes.func,
};

export default LoadingOverlay;

