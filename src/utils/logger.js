/**
 * Système de logging centralisé
 * Permet de tracker les erreurs et l'avancement en temps réel
 */

const LogLevels = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

class Logger {
  constructor(module = 'APP') {
    this.module = module;
    this.logs = [];
  }

  /**
   * Formate et enregistre un log
   */
  _log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      module: this.module,
      message,
      data,
    };

    this.logs.push(logEntry);

    // Affichage en console selon le niveau
      const methodMap = {
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error',
      };
      const consoleMethod = methodMap[level] || 'log';
      const prefix = `[${timestamp}] [${level}] [${this.module}]`;

      try {
        // Utiliser des appels statiques pour satisfaire eslint no-console
        switch (consoleMethod) {
          case 'debug':
            console.debug(`%c${prefix}`, 'color: ' + this._getColor(level), message, data || '');
            break;
          case 'info':
            console.info(`%c${prefix}`, 'color: ' + this._getColor(level), message, data || '');
            break;
          case 'warn':
            console.warn(`%c${prefix}`, 'color: ' + this._getColor(level), message, data || '');
            break;
          case 'error':
            console.error(`%c${prefix}`, 'color: ' + this._getColor(level), message, data || '');
            break;
          default:
            console.log(`%c${prefix}`, 'color: ' + this._getColor(level), message, data || '');
        }
      } catch (e) {
        // Fallback sans styles si nécessaire
        try {
          switch (consoleMethod) {
            case 'debug':
              console.debug(`${prefix} ${message}`, data || '');
              break;
            case 'info':
              console.info(`${prefix} ${message}`, data || '');
              break;
            case 'warn':
              console.warn(`${prefix} ${message}`, data || '');
              break;
            case 'error':
              console.error(`${prefix} ${message}`, data || '');
              break;
            default:
              console.log(`${prefix} ${message}`, data || '');
          }
        } catch (err) {
          // dernier recours silencieux
        }
      }

    return logEntry;
  }

  debug(message, data) {
    return this._log(LogLevels.DEBUG, message, data);
  }

  info(message, data) {
    return this._log(LogLevels.INFO, message, data);
  }

  warn(message, data) {
    return this._log(LogLevels.WARN, message, data);
  }

  error(message, data) {
    return this._log(LogLevels.ERROR, message, data);
  }

  /**
   * Retourne la couleur selon le niveau
   */
  _getColor(level) {
    const colors = {
      DEBUG: '#888888',
      INFO: '#0066cc',
      WARN: '#ff9900',
      ERROR: '#cc0000',
    };
    return colors[level] || '#000000';
  }

  /**
   * Exporte tous les logs
   */
  exportLogs() {
    return this.logs;
  }

  /**
   * Réinitialise les logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Retourne les logs filtrés par niveau
   */
  getLogsByLevel(level) {
    return this.logs.filter((log) => log.level === level);
  }
}

// Instance globale
const globalLogger = new Logger('ORGA-PRO');

// Exporter l'instance comme export par défaut (CommonJS require())
// et conserver des propriétés utilitaires pour l'import nommé
module.exports = globalLogger;
// Propriétés utilitaires
module.exports.createLogger = (module) => new Logger(module);
module.exports.LogLevels = LogLevels;
// Garde la compatibilité avec les imports existants qui font require(...)
module.exports.logger = globalLogger;
