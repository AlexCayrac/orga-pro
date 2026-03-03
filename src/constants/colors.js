/**
 * Configuration des Constantes de Couleurs
 * Couleurs du thème et variables CSS
 */

export const colors = {
  // Couleurs primaires
  primary: '#0A4866',        // Bleu marine professionnel
  primaryDark: '#063349',    // Variante plus sombre
  
  // Couleurs avec transparence
  primaryRgba: 'rgba(10, 72, 102, 0.6)',
  primaryRgbaLight: 'rgba(10, 72, 102, 0.1)',

  // Couleurs neutres
  white: '#ffffff',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',

  // Couleurs de statut
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Couleurs pour UI
  border: '#e5e7eb',
  background: '#f9fafb',
  text: '#1f2937',
};

export const cssVariables = {
  '--primary': colors.primary,
  '--primary-dark': colors.primaryDark,
  '--primary-rgba': colors.primaryRgba,
  '--white': colors.white,
  '--gray-100': colors.gray100,
  '--gray-500': colors.gray500,
  '--border': colors.border,
  '--background': colors.background,
  '--text': colors.text,
};
