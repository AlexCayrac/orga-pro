/**
 * Configuration Globale de l'Application
 */

export const config = {
  // Application
  APP_NAME: 'Orga PRO',
  APP_VERSION: '1.0.0',
  
  // Persistance
  AUTO_SAVE_INTERVAL: 5000,  // 5 secondes
  STORAGE_VERSION: 1,

  // Import/Export
  SUPPORTED_EXCEL_FORMATS: ['xlsx', 'xls', 'csv'],
  EXPORT_FORMATS: ['pdf', 'png', 'svg'],

  // Limites
  MAX_CONTACTS_PER_FOLDER: 1000,
  MAX_ORGCHARTS: 50,
  MAX_FILE_SIZE: 10 * 1024 * 1024,  // 10 MB

  // Features
  FEATURES: {
    DRAG_DROP: true,
    AUTO_SAVE: true,
    OFFLINE_MODE: true,
  },
};
