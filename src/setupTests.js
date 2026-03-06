import '@testing-library/jest-dom';

// Mock Electron
global.electronAPI = {
  importExcel: jest.fn(),
  exportOrgChart: jest.fn(),
  getProjects: jest.fn(),
  onDataUpdated: jest.fn(),
  onImportProgress: jest.fn(),
};
