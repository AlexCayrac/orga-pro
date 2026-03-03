/**
 * Gestionnaire d'erreurs centralisé
 * Capture et rapporte les erreurs en temps réel
 */

const { logger } = require('./logger');

class ErrorHandler {
  constructor() {
    this.errors = [];
    this.errorListeners = [];
  }

  /**
   * Enregistre une erreur
   */
  captureError(error, context = {}) {
    const errorEntry = {
      id: this._generateErrorId(),
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack || '',
      context: context,
      severity: this._determineSeverity(error),
    };

    this.errors.push(errorEntry);
    logger.error('Erreur capturée', errorEntry);

    // Notifie tous les listeners
    this._notifyListeners(errorEntry);

    return errorEntry;
  }

  /**
   * Enregistre un listener pour les erreurs
   */
  onError(callback) {
    this.errorListeners.push(callback);
  }

  /**
   * Désenregistre un listener
   */
  offError(callback) {
    this.errorListeners = this.errorListeners.filter((cb) => cb !== callback);
  }

  /**
   * Notifie tous les listeners
   */
  _notifyListeners(errorEntry) {
    this.errorListeners.forEach((callback) => {
      try {
        callback(errorEntry);
      } catch (err) {
        console.error('Erreur dans le listener :', err);
      }
    });
  }

  /**
   * Détermine la sévérité de l'erreur
   */
  _determineSeverity(error) {
    if (error.message.includes('Critical')) return 'CRITICAL';
    if (error.message.includes('Warning')) return 'WARNING';
    return 'ERROR';
  }

  /**
   * Génère un ID unique pour l'erreur
   */
  _generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Retourne toutes les erreurs
   */
  getAllErrors() {
    return this.errors;
  }

  /**
   * Retourne les erreurs récentes
   */
  getRecentErrors(limit = 10) {
    return this.errors.slice(-limit);
  }

  /**
   * Réinitialise les erreurs
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Exporte les erreurs pour débogage
   */
  exportErrors() {
    return JSON.stringify(this.errors, null, 2);
  }
}

// Instance globale
const globalErrorHandler = new ErrorHandler();

// Capture les erreurs non gérées
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    globalErrorHandler.captureError(event.error, {
      type: 'uncaught-error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    globalErrorHandler.captureError(event.reason, {
      type: 'unhandled-promise-rejection',
    });
  });
}

module.exports = {
  createErrorHandler: () => new ErrorHandler(),
  errorHandler: globalErrorHandler,
};
