/**
 * Hook personnalisé pour la persistance des données
 * Centralise la logique de sauvegarde et restauration
 * 
 * ⚠️ IMPORTANT: Le flag `resetInProgress` (Ref) bloque toute persistance pendant un reset
 */

import { useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { logger } from '../utils/logger';

export const usePersistence = (state, stateSetters, resetInProgressRef = null, importInProgressRef = null) => {
  const {
    contacts,
    orgcharts,
    contactFolders,
    orgchartFolders,
    selectedOrgChart,
    expandedFolders,
    expandedSections,
    excelPath,
    excelVersion,
    displayFieldsByOrgChart,
  } = state;

  const {
    setContacts,
    setOrgcharts,
    setContactFolders,
    setOrgchartFolders,
    setSelectedOrgChart,
    setExpandedFolders,
    setExpandedSections,
    setExcelPath,
    setExcelVersion,
    setDisplayFieldsByOrgChart,
  } = stateSetters;

  /**
   * Charge les données au démarrage
   * 🔴 BLOCAGE: Ne charge PAS si resetInProgress === true OU si import en cours
   */
  const loadAllData = useCallback(async () => {
    // 🔑 BLOC CRITIQUE: Si un reset est en cours, ne rien charger
    if (resetInProgressRef?.current) {
      console.log('[usePersistence] 🔴 RESET EN COURS - loadAllData bloquée');
      return;
    }
    
    // 🔑 BLOC CRITIQUE: Si un import est en cours, ne rien charger
    if (importInProgressRef?.current) {
      console.log('[usePersistence] 🔴 IMPORT EN COURS - loadAllData bloquée');
      return;
    }

    try {
      logger.info('Chargement des données persistées...');

      // Valider et nettoyer les structures de dossiers
      const validateAndCleanFolders = (folders, isOrgchart = false) => {
        if (!folders || typeof folders !== 'object') {
          return {};
        }

        const cleaned = {};
        Object.entries(folders).forEach(([name, folderObj]) => {
          if (folderObj && typeof folderObj === 'object') {
            cleaned[name] = {
              subfolders: validateAndCleanFolders(folderObj.subfolders || {}, isOrgchart),
              [isOrgchart ? 'orgcharts' : 'contacts']: Array.isArray(folderObj[isOrgchart ? 'orgcharts' : 'contacts']) 
                ? folderObj[isOrgchart ? 'orgcharts' : 'contacts'] 
                : []
            };
          }
        });
        return cleaned;
      };

      // Charger contacts et orgcharts
      const data = await storageService.loadData();
      if (data.loadedContacts?.length > 0) {
        setContacts(data.loadedContacts);
      }
      if (data.loadedOrgcharts?.length > 0) {
        setOrgcharts(data.loadedOrgcharts);
      }

      // Restaurer l'état UI et Excel avec validation
      const appState = await storageService.loadAppState();
      console.log('[usePersistence] 📂 appState chargé du disque:', {
        hasOrgchartFolders: !!appState?.orgchartFolders,
        orgchartFolders: appState?.orgchartFolders,
        hasDisplayFields: !!appState?.displayFieldsByOrgChart,
        displayFieldsByOrgChart: appState?.displayFieldsByOrgChart
      });
      
      if (appState && typeof appState === 'object') {
        if (appState.excelPath && typeof appState.excelPath === 'string') setExcelPath(appState.excelPath);
        if (appState.excelVersion && typeof appState.excelVersion === 'object') setExcelVersion(appState.excelVersion);
        
        // VALIDATION: Nettoyer les dossiers lors du chargement
        if (appState.contactFolders && typeof appState.contactFolders === 'object') {
          const cleanedContactFolders = validateAndCleanFolders(appState.contactFolders, false);
          setContactFolders(cleanedContactFolders);
        }
        if (appState.orgchartFolders && typeof appState.orgchartFolders === 'object') {
          const cleanedOrgchartFolders = validateAndCleanFolders(appState.orgchartFolders, true);
          console.log('[usePersistence] ✅ Restauration orgchartFolders:', cleanedOrgchartFolders);
          setOrgchartFolders(cleanedOrgchartFolders);
        } else {
          console.log('[usePersistence] ❌ orgchartFolders manquant ou invalide');
        }
        
        if (appState.expandedFolders && typeof appState.expandedFolders === 'object') setExpandedFolders(appState.expandedFolders);
        if (appState.expandedSections && typeof appState.expandedSections === 'object') setExpandedSections(appState.expandedSections);
        if (appState.displayFieldsByOrgChart && typeof appState.displayFieldsByOrgChart === 'object') {
          console.log('[usePersistence] ✅ Restauration displayFieldsByOrgChart:', appState.displayFieldsByOrgChart);
          setDisplayFieldsByOrgChart(appState.displayFieldsByOrgChart);
        } else {
          console.log('[usePersistence] ❌ displayFieldsByOrgChart manquant ou invalide');
        }

        if (appState.selectedOrgChartId && data.loadedOrgcharts?.length > 0) {
          const selected = data.loadedOrgcharts.find(o => o.id === appState.selectedOrgChartId);
          if (selected) setSelectedOrgChart(selected);
        }
      } else {
        // Si pas d'appState, définir un excelPath par défaut pour que le sync automatique fonctionne
        console.log('[usePersistence] ℹ️ Aucun appState trouvé, définition du chemin Excel par défaut');
        setExcelPath('data\\Organigramme_Entreprise.xlsx');
      }

      logger.info('Données chargées avec succès');
    } catch (error) {
      logger.error('Erreur lors du chargement des données', error);
    }
  }, [resetInProgressRef, importInProgressRef, setContacts, setOrgcharts, setContactFolders, setOrgchartFolders, setExcelPath, setExcelVersion, setExpandedFolders, setExpandedSections, setDisplayFieldsByOrgChart, setSelectedOrgChart]);

  /**
   * Sauvegarde l'état complet
   * 🔴 BLOCAGE: Ne sauvegarde PAS si resetInProgress === true OU si import en cours
   */
  const saveAllState = useCallback(async () => {
    console.log('[usePersistence] 💾 saveAllState() APPELÉE');
    // 🔑 BLOC CRITIQUE: Si un reset est en cours, ne rien sauvegarder
    if (resetInProgressRef?.current) {
      console.log('[usePersistence] 🔴 RESET EN COURS - saveAllState bloquée');
      return;
    }
    
    // 🔑 BLOC CRITIQUE: Si un import est en cours, ne rien sauvegarder
    if (importInProgressRef?.current) {
      console.log('[usePersistence] 🔴 IMPORT EN COURS - saveAllState bloquée');
      return;
    }

    try {
      // Sauvegarder les données
      await storageService.saveData(contacts, orgcharts);

      // IMPORTANT: Valider et nettoyer les dossiers avant sauvegarde
      // pour s'assurer qu'ils ne sont jamais corrompus sur le disque
      const validateAndCleanFolders = (folders, isOrgchart = false) => {
        if (!folders || typeof folders !== 'object') {
          return {};
        }

        const cleaned = {};
        Object.entries(folders).forEach(([name, folderObj]) => {
          if (folderObj && typeof folderObj === 'object') {
            cleaned[name] = {
              subfolders: validateAndCleanFolders(folderObj.subfolders || {}, isOrgchart),
              [isOrgchart ? 'orgcharts' : 'contacts']: Array.isArray(folderObj[isOrgchart ? 'orgcharts' : 'contacts']) 
                ? folderObj[isOrgchart ? 'orgcharts' : 'contacts'] 
                : []
            };
          }
        });
        return cleaned;
      };

      // Sauvegarder l'état avec validation
      const appState = {
        contacts: contacts || [],
        orgcharts: orgcharts || [],
        contactFolders: validateAndCleanFolders(contactFolders, false),
        orgchartFolders: validateAndCleanFolders(orgchartFolders, true),
        selectedOrgChartId: selectedOrgChart?.id || null,
        expandedFolders,
        expandedSections,
        excelPath,
        excelVersion,
        displayFieldsByOrgChart,
      };
      console.log('[usePersistence] 📊 Sauvegarde appState:', {
        orgchartFolders: appState.orgchartFolders,
        displayFieldsByOrgChart: appState.displayFieldsByOrgChart
      });
      await storageService.saveAppState(appState);
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde', error);
    }
  }, [resetInProgressRef, importInProgressRef, contacts, orgcharts, contactFolders, orgchartFolders, selectedOrgChart, expandedFolders, expandedSections, excelPath, excelVersion, displayFieldsByOrgChart]);

  /**
   * Auto-sauvegarde à chaque changement d'état (debounced pour éviter race conditions)
   * 🔴 BLOCAGE: Ne sauvegarde PAS si resetInProgress === true OU si import en cours
   */
  useEffect(() => {
    // 🔑 BLOC CRITIQUE: Si un reset est en cours, ne rien sauvegarder
    if (resetInProgressRef?.current) {
      console.log('[usePersistence] 🔴 RESET EN COURS - Auto-save bloquée');
      return;
    }
    
    // 🔑 BLOC CRITIQUE: Si un import est en cours, ne rien sauvegarder
    if (importInProgressRef?.current) {
      console.log('[usePersistence] 🔴 IMPORT EN COURS - Auto-save bloquée');
      return;
    }

    // Debounce: attendez 500ms avant de sauvegarder pour regrouper les changements
    // (Plus rapide que 1000ms pour une meilleure réactivité après import)
    const timer = setTimeout(() => {
      saveAllState();
    }, 500);

    return () => clearTimeout(timer);
  }, [contacts, orgcharts, contactFolders, orgchartFolders, excelPath, excelVersion, selectedOrgChart, expandedFolders, expandedSections, displayFieldsByOrgChart, resetInProgressRef, importInProgressRef, saveAllState]);

  /**
   * Chargement au démarrage - UNE FOIS SEULEMENT (dépendance vide)
   */
  useEffect(() => {
    loadAllData();
  }, []); // ✅ VIDE: charge une seule fois au montage, pas à chaque changement de fonction

  /**
   * Listeners de fermeture + sauvegarde avant fermeture
   */
  useEffect(() => {
    // Listener beforeunload
    const handleBeforeUnload = async () => {
      await saveAllState();
    };

    // Listener before-quit (Electron)
    const handleBeforeQuit = async () => {
      logger.info('Fermeture de l\'application - Sauvegarde finale...');
      await saveAllState();
    };

    // Listener pour F5 (refresh) - Sauvegarder les données IMMÉDIATEMENT
    // ⚠️ IMPORTANT: Doit être synchrone ou le plus rapide possible
    const handleKeyDown = (e) => {
      if (e.key === 'F5') {
        logger.info('🔄 Refresh F5 détecté - Sauvegarde URGENTE des données...');
        
        // Sauvegarder IMMÉDIATEMENT sans attendre (fire and forget)
        saveAllState().then(() => {
          logger.info('✅ Données sauvegardées avant refresh');
        }).catch(err => {
          logger.error('❌ Erreur lors de la sauvegarde avant refresh', err);
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown);
    if (window.electronAPI?.onBeforeQuit) {
      window.electronAPI.onBeforeQuit(handleBeforeQuit);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveAllState]); // ️ Dépend de saveAllState pour les listeners, ok

  return {
    loadAllData,
    saveAllState,
  };
};
