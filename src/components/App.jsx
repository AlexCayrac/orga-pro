import React, { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import '../styles/App.css';
import { usePersistence } from '../hooks/usePersistence';
import ErrorBoundary from './DevTools/ErrorBoundary';
import LogViewer from './DevTools/LogViewer';
import TopBar from './Layout/TopBar';
import ContactsPanel from './Layout/ContactsPanel';
import OrgChartCanvas from './Layout/OrgChartCanvas';

import OrgChartsList from './Layout/OrgChartsList';
import SplitLayout from './Layout/SplitLayout';
import ImportDialog from './Dialogs/ImportDialog';
import ChangesDialog from './Dialogs/ChangesDialog';
import DifferencesDialog from './Dialogs/DifferencesDialog';
import ExportWindow from './Dialogs/ExportWindow';
import LoadingOverlay from './Common/LoadingOverlay';
import { logger } from '../utils/logger';
import excelDiffService from '../modules/diff/excelDiffService';
import SyncManager from '../modules/sync/SyncManager';
import UIUpdateNotifier from '../modules/sync/UIUpdateNotifier';
import ExcelLoader from '../modules/sync/ExcelLoader';

/**
 * Composant principal d'Orga PRO
 * Gère:
 * - 3 zones: Dossiers (gauche en lecture seule), Canvas Organigramme (milieu), Liste Organigrammes (droite)
 * - Auto-organisation des contacts par Agence (dossier racine) → Poste (sous-dossier)
 * - Les dossiers sont créés automatiquement à partir des données Excel
 * - Navigation lecture seule: affichage des dossiers/contacts créés automatiquement
 */
function App() {
  // État principal
  const [contacts, setContacts] = useState([]);
  const [excelPath, setExcelPath] = useState(null);
  const [excelVersion, setExcelVersion] = useState(null);
  const [orgcharts, setOrgcharts] = useState([]);
  const [selectedOrgChart, setSelectedOrgChart] = useState(null);
  const [contactFolders, setContactFolders] = useState({});
  const [orgchartFolders, setOrgchartFolders] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});
  const [expandedSections, setExpandedSections] = useState({ contacts: true });
  
  // 📚 Historique pour Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyInProgressRef = useRef(false);
  
  // Préférences d'affichage PAR ORGANIGRAMME (mappées par organigramme ID)
  const [displayFieldsByOrgChart, setDisplayFieldsByOrgChart] = useState({});
  
  // Fonction helper pour obtenir les préférences d'affichage de l'organigramme courant
  const getDisplayFieldsForCurrentChart = () => {
    if (!selectedOrgChart?.id) {
      return {
        position: true,
        agency: false,
        age: false,
        email: false,
        phone: false,
        photo: false,
        localisation: false,
        anciennete: false,
      };
    }
    
    // Si ce graphique n'a pas de préférences, créer les défaut
    if (!displayFieldsByOrgChart[selectedOrgChart.id]) {
      return {
        position: true,
        agency: false,
        age: false,
        email: false,
        phone: false,
        photo: false,
        localisation: false,
        anciennete: false,
      };
    }
    
    return displayFieldsByOrgChart[selectedOrgChart.id];
  };
  
  // Setter pour les préférences d'affichage de l'organigramme courant
  const setDisplayFieldsForCurrentChart = (newFields) => {
    if (!selectedOrgChart?.id) return;
    setDisplayFieldsByOrgChart({
      ...displayFieldsByOrgChart,
      [selectedOrgChart.id]: newFields
    });
  };
  
  // Raccourci pour la compatibilité
  const displayFields = getDisplayFieldsForCurrentChart();
  const setDisplayFields = setDisplayFieldsForCurrentChart;
  
  // Dialogs
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [showDifferencesDialog, setShowDifferencesDialog] = useState(false);
  const [detectedChanges, setDetectedChanges] = useState(null);
  const [differencesCount, setDifferencesCount] = useState(0);
  const [pendingDifferences, setPendingDifferences] = useState([]);
  const [showExportWindow, setShowExportWindow] = useState(false);
  
  // Loading state pour bloquer l'UI pendant l'import
  const [isImporting, setIsImporting] = useState(false);
  
  // � REF SYNCHRONE: Bloque la persistance pendant le reset (pas de setState asynchrone!)
  const resetInProgressRef = useRef(false);
  
  // 🔑 REF SYNCHRONE: Bloque la persistance pendant et après l'import (évite race condition UI)
  const importInProgressRef = useRef(false);

  // 🔑 REF: Track if startup auto-check has been executed (prevent multiple runs)
  const startupCheckExecutedRef = useRef(false);
  const [syncReady, setSyncReady] = useState(false);

  // 🎨 REF pour le canvas - pour capturer le contenu à l'export
  const orgChartCanvasRef = useRef(null);

  // --------------------------------------------------------------------------
  // Helpers: sorting folder keys alphabetically (locale 'fr')
  // --------------------------------------------------------------------------
  const sortFoldersRecursively = (folders, isOrgchart = false) => {
    if (!folders || typeof folders !== 'object') return {};
    const sorted = {};
    const keys = Object.keys(folders).sort((a, b) => a.localeCompare(b, 'fr'));
    keys.forEach(k => {
      const obj = folders[k] || {};
      sorted[k] = {
        subfolders: sortFoldersRecursively(obj.subfolders || {}, isOrgchart)
      };
      if (isOrgchart) {
        sorted[k].orgcharts = Array.isArray(obj.orgcharts) ? obj.orgcharts.slice() : [];
      } else {
        sorted[k].contacts = Array.isArray(obj.contacts) ? obj.contacts.slice() : [];
      }
    });
    return sorted;
  };

  // 🔥 CRITICAL: Quand la fenêtre regagne le focus (ALT+TAB), restaurer le focus de l'input
  // Cela résout le problème où ALT+TAB fonctionne mais l'app ne rend pas focus automatiquement
  React.useEffect(() => {
    const handleWindowFocus = () => {
      console.log('[App] 🪟 Fenêtre a regagné le focus (window.focus event)');
      // Restaurer le focus sur l'input de recherche
      setTimeout(() => {
        const searchInput = document.querySelector('.search-input');
        if (searchInput && document.activeElement !== searchInput) {
          console.log('[App] 🔍 Restauration du focus sur search input');
          searchInput.focus();
        }
      }, 0);
    };
    
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

  // 🔄 Initialiser SyncManager et s'abonner aux changements
  React.useEffect(() => {
    const initializeSync = async () => {
      try {
        console.log('[App] Initializing SyncManager');
        await SyncManager.initialize();
        // Mark that SyncManager is ready so startup checks can run safely
        setSyncReady(true);
        
        // Charger l'état initial du UIUpdateNotifier
        const initialUpdates = UIUpdateNotifier.getPendingUpdates();
        console.log('[App] Initial pending differences:', initialUpdates.pendingDifferences.length);
        setPendingDifferences(initialUpdates.pendingDifferences);
        setDifferencesCount(initialUpdates.counts.total);
        
        // S'abonner aux changements futurs des différences
        const unsubscribe = UIUpdateNotifier.subscribe((updates) => {
          console.log('[App] UI Update received:', updates.pendingDifferences.length, 'differences');
          setPendingDifferences(updates.pendingDifferences);
          setDifferencesCount(updates.counts.total);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('[App] Error initializing SyncManager:', error);
      }
    };

    let unsubscribe;
    initializeSync().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ⌨️ Raccourcis clavier pour Undo/Redo (Ctrl+Z / Ctrl+Y)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // 📚 Sauvegarde automatique dans l'historique quand orgcharts change (sauf pendant undo/redo)
  React.useEffect(() => {
    if (historyInProgressRef.current) return;
    saveToHistory();
  }, [orgcharts]);

  // Hook de persistance - gère le chargement et sauvegarde automatique
  const persistenceHook = usePersistence(
    { contacts, orgcharts, contactFolders, orgchartFolders, selectedOrgChart, expandedFolders, expandedSections, excelPath, excelVersion, displayFieldsByOrgChart },
    { setContacts, setOrgcharts, setContactFolders, setOrgchartFolders, setSelectedOrgChart, setExpandedFolders, setExpandedSections, setExcelPath, setExcelVersion, setDisplayFieldsByOrgChart },
    resetInProgressRef,  // 🔑 Passer la ref synchrone du reset
    importInProgressRef  // 🔑 Passer la ref synchrone de l'import
  );

  // 🔄 Listener global beforeunload pour sauvegarder AVANT fermeture/reload
  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      console.log('[App] 🚨 beforeunload DÉCLENCHÉ!!!');
      
      // 🚀 FIRE-AND-FORGET: Déclencher la sauvegarde SANS l'attendre
      // Ça permet au reload de se faire quasi-immédiatement
      persistenceHook.saveAllState()
        .then(() => {
          console.log('[App] ✅ beforeunload - Sauvegarde complétée (arrière-plan)');
        })
        .catch(err => {
          console.error('[App] ❌ beforeunload - Erreur sauvegarde:', err);
        });
      
      // Ne pas attendre - laisser le reload se faire IMMÉDIATEMENT
      // Les données se sauvegarderont en parallèle
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [persistenceHook]);

  /**
   * Auto-génère l'arborescence de dossiers basée sur "Agence", "Regroupement Poste", et "Poste"
   * Structure: Agence (root) -> Regroupement Poste -> Poste -> Contacts
   * Accepte différentes variantes de noms de colonnes
   */
  const autoGenerateFolderStructure = (contactsList) => {
    const structure = {};
    
    // Parcourir chaque contact et créer la structure
    contactsList.forEach((contact) => {
      if (!contact || typeof contact !== 'object') return;
      
      // Chercher Agence
      const agenceValue = 
        contact.agency ||
        contact.Agency ||
        contact.AGENCY ||
        contact.agence || 
        contact.Agence || 
        contact.AGENCE || 
        contact.department ||
        contact.Department ||
        contact.DEPARTMENT ||
        contact.division ||
        contact.Division ||
        contact.team ||
        contact.Team ||
        'Sans Département';
      
      // Chercher Regroupement Poste (nouveau)
      const regroupementPosteValue = 
        contact.regroupementPoste ||
        contact.RegroupementPoste ||
        contact.REGROUPEMENT_POSTE ||
        contact['Regroupement Poste'] ||
        'Sans Regroupement';
        
      // Chercher Poste
      const posteValue = 
        contact.position ||
        contact.Position ||
        contact.POSITION ||
        contact.poste || 
        contact.Poste || 
        contact.POSTE || 
        contact.title ||
        contact.Title ||
        'Sans Poste';
      
      const agence = (String(agenceValue || '')).trim() || 'Sans Département';
      const regroupementPoste = (String(regroupementPosteValue || '')).trim() || 'Sans Regroupement';
      const poste = (String(posteValue || '')).trim() || 'Sans Poste';
      
      // Niveau 1: Agence
      if (!structure[agence]) {
        structure[agence] = {
          subfolders: {},
          contacts: []
        };
      }
      
      // Niveau 2: Regroupement Poste
      if (!structure[agence].subfolders[regroupementPoste]) {
        structure[agence].subfolders[regroupementPoste] = {
          subfolders: {},
          contacts: []
        };
      }
      
      // Niveau 3: Poste
      if (!structure[agence].subfolders[regroupementPoste].subfolders[poste]) {
        structure[agence].subfolders[regroupementPoste].subfolders[poste] = {
          subfolders: {},
          contacts: []
        };
      }
      
      // Ajouter le contact au niveau 3 (éviter les doublons)
      if (contact.id && !structure[agence].subfolders[regroupementPoste].subfolders[poste].contacts.includes(contact.id)) {
        structure[agence].subfolders[regroupementPoste].subfolders[poste].contacts.push(contact.id);
        if (!window._debugFolderStructure) {
          window._debugFolderStructure = { contactsAdded: 0, contactsWithoutId: 0 };
        }
        window._debugFolderStructure.contactsAdded++;
      } else if (!contact.id) {
        if (!window._debugFolderStructure) {
          window._debugFolderStructure = { contactsAdded: 0, contactsWithoutId: 0 };
        }
        window._debugFolderStructure.contactsWithoutId++;
      }
    });
    
    if (window._debugFolderStructure) {
      console.log('[autoGenerateFolderStructure] DEBUG:', window._debugFolderStructure);
    }

    return sortFoldersRecursively(structure);
  };


  const handleImportExcel = async (data) => {
    try {
      console.log('[App] 🚀 IMPORT EXCEL DÉBUT');
      
      if (!data || !data.data) {
        alert('❌ Erreur: Les données Excel ne contiennent rien');
        return;
      }
      
      console.log('[App] 📊 Premier contact importé:', data.data[0]);
      console.log('[App] 🔑 Champs du premier contact:', Object.keys(data.data[0] || {}));
      
      // 🔍 DIAGNOSTIC: Vérifier si les nouvelles colonnes sont présentes
      if (data.data[0]) {
        const contact = data.data[0];
        const newFields = {
          matricule: contact.matricule,
          photoPath: contact.photoPath,
          qualification: contact.qualification,
          localisation: contact.localisation,
          anciennete: contact.anciennete,
          birthDate: contact.birthDate,
          entryDate: contact.entryDate,
        };
        console.log('[App] 🔍 DIAGNOSTIC CHAMPS NOUVEAUX:', newFields);
      }
      
      // 🔑 CRITICAL: Bloquer la persistance pendant l'import
      console.log('[App] 🔴 Blocage de la persistance - importInProgressRef = true');
      importInProgressRef.current = true;
      
      // Sanitize imported contacts: ensure each contact has an id and trimmed fields
      let importedContacts = Array.isArray(data.data) ? data.data.map((c, i) => {
        const contact = Object.assign({}, c);
        if (!contact.id) contact.id = `contact_${Date.now()}_${i}`;
        contact.firstName = (contact.firstName || '').toString().trim();
        contact.lastName = (contact.lastName || '').toString().trim();
        contact.position = (contact.position || contact.poste || '').toString().trim();
        // ensure regroupementPoste exists
        contact.regroupementPoste = (contact.regroupementPoste || contact['Regroupement Poste'] || '').toString().trim();
        return contact;
      }) : [];
      console.log('[App] ✓ Calcul de la structure...');
      const autoFolders = autoGenerateFolderStructure(importedContacts);
      const folderCount = Object.keys(autoFolders).length;
      
      // Afficher loader ET mettre à jour les données dans UN SEUL flushSync
      console.log('[App] ✓ Affichage du loader et mise à jour des états');
      flushSync(() => {
        setIsImporting(true);
        setContacts(importedContacts);
        setContactFolders(autoFolders);
        
        // Auto-expand all levels for better visibility
        const newExpandedFolders = {};
        Object.keys(autoFolders).forEach(agence => {
          newExpandedFolders[agence] = true;
          // Also expand all nested Regroupement Poste and Poste folders
          const agenceObj = autoFolders[agence];
          if (agenceObj.subfolders) {
            Object.keys(agenceObj.subfolders).forEach(regroupement => {
              newExpandedFolders[`${agence}/${regroupement}`] = true;
              const regroupementObj = agenceObj.subfolders[regroupement];
              if (regroupementObj.subfolders) {
                Object.keys(regroupementObj.subfolders).forEach(poste => {
                  newExpandedFolders[`${agence}/${regroupement}/${poste}`] = true;
                });
              }
            });
          }
        });
        setExpandedFolders(newExpandedFolders);
        
        setExcelPath(data.filePath);
        setExcelVersion({ timestamp: Date.now(), data });
        setShowImportDialog(false);
      });
      
      console.log('[App] ✅ CHECKPOINT: Avant diagnostics - contacts count:', importedContacts.length);
      console.log('[App] ✅ CHECKPOINT: autoFolders keys:', Object.keys(autoFolders));
      
      // DIAGNOSTIC: comparer les IDs de contacts et les IDs utilisés dans les dossiers
      console.log('[App][DIAG] importedContacts IDs:', importedContacts.map(c => c.id).slice(0, 30));
      console.log('[App][DIAG] importedContacts Structure (first 3):', importedContacts.slice(0, 3).map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName })));
      
      // Lister les IDs présents dans les dossiers (structure: Agence → Regroupement Poste → Poste → Contacts)
      const folderIds = [];
      const folderIdMap = {}; // Map to check matching
      Object.entries(autoFolders).forEach(([agence, aObj]) => {
        Object.entries(aObj.subfolders || {}).forEach(([regroupement, rObj]) => {
          Object.entries(rObj.subfolders || {}).forEach(([poste, pObj]) => {
            const contactIds = pObj.contacts || [];
            folderIds.push(...contactIds);
            contactIds.forEach(id => {
              folderIdMap[id] = { agence, regroupement, poste };
            });
            console.log(`[App][DIAG] Folder IDs - ${agence} / ${regroupement} / ${poste}:`, contactIds.slice(0, 5));
          });
        });
      });
      console.log('[App][DIAG] Folder IDs - TOTAL FOUND:', folderIds.length, 'contact IDs');
      
      // Check for mismatches
      const contactIdsSet = new Set(importedContacts.map(c => c.id));
      const folderIdsSet = new Set(folderIds);
      const mismatchedInFolders = folderIds.filter(id => !contactIdsSet.has(id));
      const missingInFolders = importedContacts.filter(c => !folderIdsSet.has(c.id));
      
      console.log('[App][DIAG] ID MATCH CHECK:');
      console.log('[App][DIAG] - Contacts in folders but NOT in contacts array:', mismatchedInFolders.slice(0, 5));
      console.log('[App][DIAG] - Contacts in array but NOT in folders:', missingInFolders.map(c => c.id).slice(0, 5));
      
      console.log('[App] ✓ États mis à jour - LoadingOverlay en cours');
      
      // Attendre 500ms pour que ContactsPanel se stabilise COMPLÈTEMENT
      // avant de fermer le loader
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ⚠️ Fermer le loader
      console.log('[App] ✓ Fermeture du loader - attente de onDismissed');
      setIsImporting(false);
      
      // 🔑 NOTE IMPORTANTE: 
      // Le focus sera appliqué dans le callback onDismissed de LoadingOverlay
      // qui se déclenche EXACTEMENT quand le DOM est retiré
      // Ne PAS appliquer le focus ici - c'est trop tôt!
      
      // Débloquer la persistance
      importInProgressRef.current = false;
      console.log('[App] 🟢 Déblocage de la persistance');
      
      // Afficher l'alert
      console.log(`[App] ✅ Excel importé! ${importedContacts.length} contacts, ${folderCount} agences créées`);
      await new Promise(resolve => setTimeout(resolve, 100));
      alert(`✅ Excel importé!\n${importedContacts.length} contacts\n${folderCount} agences créées`);
      
      // � NOTE: L'alert cause une perte de focus au niveau du système d'exploitation
      // CRITICAL: L'alert cause une perte de focus au niveau du système d'exploitation
      // SOLUTION: Appeler requestFocus() IMMÉDIATEMENT après la fermeture de l'alert
      // pour que Electron reprenne le focus système SANS attendre un clic utilisateur
      if (window.electronAPI && window.electronAPI.requestFocus) {
        console.log('[App] Restauration du focus après alert (requestFocus)');
        window.electronAPI.requestFocus();
      }
      
      logger.info('Excel importé', { count: importedContacts.length, folderCount });
      
    } catch (error) {
      console.error('[App] ❌ ERREUR:', error);
      setIsImporting(false);
      alert('❌ Erreur: ' + error.message);
    }
  };

  // 🔑 CRITICAL: Fonction appelée EXACTEMENT quand LoadingOverlay est retiré du DOM
  // C'est le moment PARFAIT pour restaurer le focus
  const handleLoadingOverlayDismissed = () => {
    console.log('[App] 🎯 Callback onDismissed - LoadingOverlay complètement retiré du DOM');
    
    // Diagnostic: État du document au moment du callback
    // 🔑 SIMPLE: LoadingOverlay a été retiré du DOM
    // Le listener window.focus gérera la restauration du focus quand la fenêtre le récupère
    console.log('[App] ✅ LoadingOverlay complètement retiré du DOM');
    console.log('[App] 📝 NOTE: La restauration du focus est gérée par le listener window.focus event');
  };

  const detectChanges = (oldContacts, newContacts) => {
    const changes = {
      added: [],
      removed: [],
      modified: [],
    };

    const oldMap = new Map(oldContacts.map(c => [`${c.firstName}_${c.lastName}`, c]));
    const newMap = new Map(newContacts.map(c => [`${c.firstName}_${c.lastName}`, c]));

    // Détecte les nouveaux
    newContacts.forEach(newC => {
      const key = `${newC.firstName}_${newC.lastName}`;
      if (!oldMap.has(key)) {
        changes.added.push(newC);
      }
    });

    // Détecte les supprimés
    oldContacts.forEach(oldC => {
      const key = `${oldC.firstName}_${oldC.lastName}`;
      if (!newMap.has(key)) {
        changes.removed.push(oldC);
      }
    });

    // Détecte les modifiés
    oldContacts.forEach(oldC => {
      const key = `${oldC.firstName}_${oldC.lastName}`;
      const newC = newMap.get(key);
      if (newC && JSON.stringify(oldC) !== JSON.stringify(newC)) {
        changes.modified.push({ old: oldC, new: newC });
      }
    });

    return changes;
  };

  const handleValidateChanges = (approvedChanges) => {
    // Validation des données
    if (!approvedChanges || typeof approvedChanges !== 'object') {
      logger.error('Changements invalides reçus', approvedChanges);
      alert('❌ Erreur: Changements invalides');
      return;
    }

    // Applique les changements approuvés
    let updatedContacts = [...contacts];

    // Ajoute les nouveaux
    if (Array.isArray(approvedChanges.added)) {
      approvedChanges.added.forEach(c => {
        if (c && c.id && !updatedContacts.find(existing => existing.id === c.id)) {
          updatedContacts.push(c);
        }
      });
    }

    // Supprime les contacts approuvés
    // Conservative policy: IGNORE removals by default to avoid breaking organigrams.
    if (Array.isArray(approvedChanges.removed) && approvedChanges.removed.length > 0) {
      console.warn('[App] Politique conservative: suppressions IGNORÉES pour éviter bloc(s) invalides', approvedChanges.removed.length);
    }

    // Met à jour les modifiés — fusionner les champs en PRÉSERVANT l'ID existant
    if (Array.isArray(approvedChanges.modified)) {
      approvedChanges.modified.forEach(mod => {
        if (!mod || !mod.new) return;

        // Try to find by explicit id first
        let idx = -1;
        if (mod.new.id) {
          idx = updatedContacts.findIndex(c => c.id === mod.new.id);
        }

        // Fallback: try to match by key (firstName|lastName) when provided
        if (idx === -1 && mod.key) {
          idx = updatedContacts.findIndex(c => {
            const cKey = (c.firstName || '').toString().toLowerCase() + '|' + (c.lastName || '').toString().toLowerCase();
            return cKey === mod.key;
          });
        }

        if (idx !== -1) {
          const existing = updatedContacts[idx];
          // Merge fields from mod.new but keep existing.id to avoid invalidating blocks
          const merged = { ...existing, ...mod.new, id: existing.id };
          updatedContacts[idx] = merged;
        } else {
          // If we cannot find an existing contact, append only if mod.new.id is present
          if (mod.new.id) {
            console.warn('[App] Contact modifié non trouvé — ajout en fallback avec id fourni:', mod.new.id);
            updatedContacts.push(mod.new);
          } else {
            console.warn('[App] Contact modifié non trouvé et sans id — changement ignoré', mod);
          }
        }
      });
    }

    setContacts(updatedContacts);
    
    // Auto-générer la structure de dossiers basée sur les nouveaux contacts
    const autoFolders = autoGenerateFolderStructure(updatedContacts);
    setContactFolders(autoFolders);
    
    setExcelVersion({ timestamp: Date.now(), changes: approvedChanges });
    setShowChangesDialog(false);
    logger.info('Changements validés, appliqués et dossiers auto-organisés');
  };

  /**
   * Détecte les changements dans le fichier Excel Organigramme_Entreprise.xlsx
   * et les affiche dans un dialog
   */
  const handleCheckExcelUpdates = React.useCallback(async (silentMode = false, forceFlag = false) => {
    try {
      console.log('[App] 🔍 Check Excel Updates with SyncManager');
      
      // Lancer la synchronisation - respect explicit forceFlag OR inverse of silentMode
      const syncResult = await SyncManager.syncWithExcel(contacts, { force: (forceFlag === true) || (!silentMode) });
      
      console.log('[App] Sync result:', {
        hasChanges: syncResult.hasChanges,
        total: syncResult.totalDifferences || syncResult.total || syncResult.totalDifferences,
        excelCount: syncResult.excelCount,
        adds: syncResult.additions,
        updates: syncResult.updates,
        removes: syncResult.removals,
      });

      // Si mode silencieux ou pas de différences, mettre à jour juste le badge et quitter
      if (silentMode || !syncResult.hasChanges) {
        console.log('[App] Silent mode or no changes - badge updated');
        // IMPORTANT: Always update the badge in silent mode, even if differences count is 0
        const total = syncResult.total || syncResult.totalDifferences || (
          (Array.isArray(syncResult.additions) ? syncResult.additions.length : 0) +
          (Array.isArray(syncResult.updates) ? syncResult.updates.length : 0) +
          (Array.isArray(syncResult.removals) ? syncResult.removals.length : 0) +
          (Array.isArray(syncResult.differences) ? syncResult.differences.length : 0)
        );
        setDifferencesCount(Number(total || 0));
        
        if (!syncResult.hasChanges && !silentMode) {
          // Mode manuel et aucune différence: afficher un dump de debug
          try {
            console.log('[App] No differences detected — dumping sample of Excel vs internal contacts for debug');
            const excelData = await ExcelLoader.loadEmbeddedExcel();
            const excelSample = (excelData.data || []).slice(0, 10);
            const contactsSample = (contacts || []).slice(0, 10);
            console.log('[App][DEBUG] Excel sample (first 10 rows):', excelSample);
            console.log('[App][DEBUG] Internal contacts sample (first 10):', contactsSample);
            alert('Aucune différence détectée — échantillons Excel et contacts imprimés dans la console (DevTools).');
          } catch (dumpErr) {
            console.error('[App] Erreur lors du dump debug:', dumpErr);
          }
        }
        return;
      }

      // Mode manuel: Construire l'objet `detectedChanges` attendu par le dialog puis l'afficher
      try {
        const diffs = syncResult.differences || [];
        const added = [];
        const removed = [];
        const modified = [];

        diffs.forEach(d => {
          if (d.type === 'ADD') {
            added.push({ excelContact: d.excelContact, type: 'added' });
          } else if (d.type === 'REMOVE') {
            removed.push({ contact: d.internalContact, type: 'removed' });
          } else if (d.type === 'UPDATE') {
            const mods = (d.fieldChanges || []).map(f => ({ field: f.fieldName || f.field, oldValue: f.oldValue, newValue: f.newValue }));
            modified.push({ currentContact: d.internalContact, newContact: d.excelContact, modifications: mods, type: 'modified' });
          }
        });

        const summary = {
          totalAdded: added.length,
          totalRemoved: removed.length,
          totalModified: modified.length,
          total: added.length + removed.length + modified.length,
        };

        const changesObj = { added, removed, modified, summary };
        console.log('[App] Prepared detectedChanges for dialog:', summary);
        setDetectedChanges(changesObj);
        console.log('[App] Opening differences dialog');
        setShowDifferencesDialog(true);
      } catch (mapErr) {
        console.error('[App] Error preparing detectedChanges for dialog:', mapErr);
        setDetectedChanges({ added: [], removed: [], modified: [], summary: { totalAdded: 0, totalRemoved: 0, totalModified: 0, total: 0 } });
        setShowDifferencesDialog(true);
      }

    } catch (error) {
      console.error('[App] Error during sync:', error);
      
      if (!silentMode) {
        alert('❌ Erreur lors de la synchronisation: ' + error.message);
      }
    }
  }, [contacts, setDifferencesCount, setDetectedChanges, setShowDifferencesDialog]);

  // Auto-vérification des changements à chaque import d'Excel ou modification des contacts
  // NOTE: On dépend de excelPath et handleCheckExcelUpdates pour avoir la bonne closure
  React.useEffect(() => {
    console.log('[App] 🚀 useEffect auto-check: contacts.length =', contacts.length, ', excelPath =', excelPath);
    
    if (contacts.length > 0 && excelPath) {
      // Exécuter en mode silencieux pour afficher seulement le badge (ne pas ouvrir la fenêtre)
      const debounceTimer = setTimeout(() => {
        handleCheckExcelUpdates(true);
      }, 500); // Débounce de 500ms pour éviter les appels trop fréquents
      
      return () => clearTimeout(debounceTimer);
    }
  }, [excelPath, handleCheckExcelUpdates]);

  // Auto-check unique au démarrage: lance un check silencieux une seule fois
  // S'exécute dès que excelPath et contacts sont disponibles, mais seulement UNE FOIS
  React.useEffect(() => {
    if (syncReady && excelPath && contacts.length > 0 && !startupCheckExecutedRef.current) {
      console.log('[App] 🚀 Running startup auto-check (first time)');
      startupCheckExecutedRef.current = true;
      // Run a silent but forced check at startup to detect changes regardless of stored hash
      handleCheckExcelUpdates(true, true);
    }
  }, [syncReady, excelPath, contacts.length, handleCheckExcelUpdates]);

  // Écouter les différences appliquées depuis la fenêtre indépendante (IPC)
  React.useEffect(() => {
    console.log('[App] 🔔 useEffect onDifferencesApplied - démarrage');
    console.log('[App] window.electronAPI?', !!window.electronAPI);
    console.log('[App] onDifferencesApplied?', !!(window.electronAPI && window.electronAPI.onDifferencesApplied));
    
    if (window.electronAPI && window.electronAPI.onDifferencesApplied) {
      const handler = (acceptedChanges) => {
        console.log('[App] 📡 IPC EVENT REÇU: differences-applied');
        console.log('[App] acceptedChanges payload:', JSON.stringify(acceptedChanges, null, 2));
        try {
          handleApplyDifferences(acceptedChanges || []);
        } catch (err) {
          console.error('[App] ❌ Erreur lors du traitement des différences appliquées:', err);
        }
      };

      console.log('[App] ✅ Enregistrement listener onDifferencesApplied');
      window.electronAPI.onDifferencesApplied(handler);
      return () => {
        console.log('[App] 🧹 Cleanup useEffect onDifferencesApplied');
      };
    } else {
      console.warn('[App] ⚠️ onDifferencesApplied non disponible');
    }
  }, []);

  /**
   * Applique les changements acceptés depuis le dialog des différences
   * Utilise le nouveau SyncManager pour une gestion propre et auditable
   */
  const handleApplyDifferences = async (acceptedChanges) => {
    try {
      console.log('[App] 🔥 APPLY DIFFERENCES - START');
      console.log('[App] acceptedChanges:', acceptedChanges);
      
      if (!Array.isArray(acceptedChanges)) {
        console.error('[App] ❌ acceptedChanges n\'est pas un array');
        alert('❌ Erreur: format de données invalide');
        return;
      }

      if (acceptedChanges.length === 0) {
        console.log('[App] ℹ️ Aucun changement à appliquer');
        setShowDifferencesDialog(false);
        setPendingDifferences([]);
        setDifferencesCount(0);
        return;
      }

      console.log('[App] 📋 Avant application: ' + contacts.length + ' contacts');

      // Extraire les IDs des changements acceptés (les éléments venant du dialog sont des objets)
      const acceptedDifferenceIds = acceptedChanges.map(ch => {
        if (!ch) return null;
        if (ch.type === 'added' || ch.type === 'ADD') return ch.excelContact && ch.excelContact.id ? ch.excelContact.id : ch.contactId || null;
        if (ch.type === 'removed' || ch.type === 'REMOVE') return ch.contact && ch.contact.id ? ch.contact.id : ch.contactId || null;
        if (ch.type === 'modified' || ch.type === 'UPDATE') return ch.currentContact && ch.currentContact.id ? ch.currentContact.id : ch.contactId || null;
        // fallback
        return ch.contactId || ch.id || null;
      }).filter(Boolean);

      const rejectedDifferenceIds = pendingDifferences
        .map(d => d.contactId)
        .filter(id => !acceptedDifferenceIds.includes(id));

      // Appliquer via SyncManager
      const applyResult = await SyncManager.applyDifferences(
        acceptedDifferenceIds,
        rejectedDifferenceIds
      );

      const { acceptedDifferences, excelContacts } = applyResult;

      console.log('[App] 📝 Applying ' + acceptedDifferences.length + ' differences');

      // Appliquer les changements aux contacts
      let updatedContacts = [...contacts];

      acceptedDifferences.forEach(diff => {
        const { contactId, type, fieldChanges } = diff;

        switch (type) {
          case 'UPDATE':
            // Trouver et mettre à jour le contact
            const updateIdx = updatedContacts.findIndex(c => c.id === contactId);
            if (updateIdx >= 0 && fieldChanges) {
              const updated = { ...updatedContacts[updateIdx] };
              fieldChanges.forEach(change => {
                updated[change.fieldName] = change.newValue;
              });
              updatedContacts[updateIdx] = updated;
              console.log(`[App] ✅ Contact ${contactId} mis à jour`);
            }
            break;

          case 'ADD':
            // Ajouter le contact brut (avec son managerId possiblement non-parsé)
            // Le layoutEngine va parser et remap les managerId automatiquement
            if (!updatedContacts.find(c => c.id === contactId)) {
              updatedContacts.push(diff.excelContact);
              console.log(`[App] ✅ Contact ${contactId} ajouté (managerId: ${diff.excelContact.managerId})`);
            }
            break;

          case 'REMOVE':
                // Supprimer le contact si non référencé; sinon marquer pour revue sur l'organigramme
                const removeIdx = updatedContacts.findIndex(c => c.id === contactId);
                // Trouver orgcharts qui référencent ce contact
                const referencingOrgcharts = (orgcharts || []).filter(oc => Array.isArray(oc.blocks) && oc.blocks.some(b => b.contactId === contactId));

                if (referencingOrgcharts.length > 0) {
                  // Au moins un organigramme utilise ce contact: marquer pour revue sur ces organigrammes
                  console.warn(`[App] ⚠️ Contact ${contactId} utilisé dans ${referencingOrgcharts.length} organigramme(s) — marqué pour revue`);
                  // Ajouter un review alert sur les orgcharts (ajoute property reviewAlerts map)
                  const updatedOrgcharts = (orgcharts || []).map(oc => {
                    if (referencingOrgcharts.find(r => r.id === oc.id)) {
                      const reviewAlerts = Object.assign({}, oc.reviewAlerts || {});
                      reviewAlerts[contactId] = true;
                      return { ...oc, reviewAlerts };
                    }
                    return oc;
                  });
                  // Mettre à jour le state des orgcharts
                  setOrgcharts(updatedOrgcharts);

                  // Marquer le contact comme needing review but keep it in list for manual action
                  if (removeIdx >= 0) {
                    updatedContacts[removeIdx] = { ...updatedContacts[removeIdx], needsReview: true, isDeleted: true };
                  }
                } else {
                  // Aucun orgchart ne référence ce contact — suppression définitive
                  if (removeIdx >= 0) {
                    updatedContacts.splice(removeIdx, 1);
                    console.log(`[App] ✅ Contact ${contactId} supprimé définitivement (non référencé)`);
                  }
                }
            break;

          default:
            console.warn(`[App] Type de changement inconnu: ${type}`);
        }
      });

      console.log('[App] 📊 Résumé: ' + acceptedDifferences.length + ' modifications appliquées');

      // Mettre à jour les contacts et les dossiers
      setContacts(updatedContacts);
      const autoFolders = autoGenerateFolderStructure(updatedContacts);
      setContactFolders(autoFolders);

      // Si des contacts ont été AJOUTÉS et sont marqués pour revue dans des organigrammes,
      // recréer les blocs correspondants et nettoyer les reviewAlerts.
      try {
        const addedIds = acceptedDifferences.filter(d => d.type === 'ADD').map(d => d.contactId).filter(Boolean);
        if (addedIds.length > 0 && Array.isArray(orgcharts) && orgcharts.length > 0) {
          let overallChange = false;
          const newOrgcharts = orgcharts.map(oc => {
            let ocCopy = { ...oc };
            const blocks = Array.isArray(ocCopy.blocks) ? ocCopy.blocks.slice() : [];
            let ocChanged = false;

            addedIds.forEach(id => {
              if (ocCopy.reviewAlerts && ocCopy.reviewAlerts[id]) {
                if (!blocks.some(b => b.contactId === id)) {
                  blocks.push({ id: `block_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, contactId: id, x: 0, y: 0, width: 140, height: 100, backgroundColor: '#0A4866' });
                }
                const newAlerts = Object.assign({}, ocCopy.reviewAlerts || {});
                delete newAlerts[id];
                ocCopy.reviewAlerts = newAlerts;
                ocChanged = true;
              }
            });

            if (ocChanged) {
              ocCopy.blocks = blocks;
              ocCopy.updatedAt = new Date();
              overallChange = true;
            }
            return ocCopy;
          });

          if (overallChange) {
            setOrgcharts(newOrgcharts);
            // If the currently selected orgchart was changed, update it too
            if (selectedOrgChart && selectedOrgChart.id) {
              const updatedSelected = newOrgcharts.find(o => o.id === selectedOrgChart.id);
              if (updatedSelected) setSelectedOrgChart(updatedSelected);
            }
          }
        }
      } catch (err) {
        console.error('[App] ❌ Erreur lors de la recréation des blocs pour contacts ajoutés:', err);
      }

      // Fermer le dialog
      setShowDifferencesDialog(false);
      
      // Recalculer les changements restants non appliqués
      const remainingDifferences = pendingDifferences.filter(d => rejectedDifferenceIds.includes(d.contactId));
      console.log(`[App] 📊 Changements restants: ${remainingDifferences.length}`);
      setPendingDifferences(remainingDifferences);
      setDifferencesCount(remainingDifferences.length);

      alert('✅ Changements appliqués!\n✓ Contacts et organigrammes préservés.');
      logger.info('Changements appliqués (SyncManager)', { count: acceptedDifferences.length });
      console.log('[App] 🔥 APPLY DIFFERENCES - END');

    } catch (error) {
      console.error('[App] ❌ ERREUR:', error);
      console.error('[App] Stack:', error.stack);
      alert('❌ Erreur: ' + error.message);
    }
  };

  /**
   * Ferme le dialog des différences sans appliquer
   */
  const handleCloseDifferencesDialog = () => {
    // Ne PAS annuler le sync ni effacer les différences:
    // fermer la fenêtre doit simplement cacher le dialog et
    // laisser le badge refléter le nombre de différences non traitées.
    setShowDifferencesDialog(false);
    setDetectedChanges(null);
    // Rafraîchir le compteur depuis le notifier (au cas où il a changé)
    try {
      const updates = UIUpdateNotifier.getPendingUpdates();
      setPendingDifferences(updates.pendingDifferences || []);
      setDifferencesCount(updates.counts ? updates.counts.total : (updates.pendingDifferences || []).length);
    } catch (e) {
      // Fallback conservative: ne pas toucher au badge si erreur
      console.error('[App] Error refreshing pending updates on close:', e);
    }
  };

  /**
   * ========================= 
   * UTILITIES: Folder Validation & Cleanup
   * =========================
   */

  /**
   * Valide et nettoie la structure des dossiers
   * S'assure qu'elle a toujours { subfolders: {}, contacts: [] }
   */
  const validateAndCleanFolders = (folders, isOrgchart = false) => {
    if (!folders || typeof folders !== 'object') {
      return {};
    }

    const cleaned = {};
    Object.entries(folders).forEach(([name, folderObj]) => {
      // Vérifier que c'est un objet valide
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

  /**
   * ========================= 
   * UTILITIES: Navigation Folders
   * =========================
   * Fonctions réutilisables pour naviguer dans les dossiers de manière cohérente
   */

  /**
   * Trouve le parent et le nom d'un dossier dans l'arborescence
   * Retourne { parent, folderName, exists } où parent est l'objet contenant le dossier
   */
  const findFolder = (folderPath, folderStructure) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return { parent: null, folderName: '', exists: false };
    }

    const pathParts = folderPath.split('/').filter(p => p.length > 0);
    if (pathParts.length === 0) {
      return { parent: null, folderName: '', exists: false };
    }

    const folderName = pathParts[pathParts.length - 1];
    let current = folderStructure;

    // Naviguer jusqu'au parent
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        return { parent: null, folderName, exists: false };
      }
      current = current[pathParts[i]].subfolders;
    }

    return {
      parent: current,
      folderName,
      exists: current && current[folderName] ? true : false
    };
  };

  /**
   * Ajoute un dossier racine avec structure { subfolders: {}, contacts: [] }
   */
  const handleAddContactFolder = (folderName) => {
    // Vérifier que le dossier n'existe pas déjà
    if (contactFolders[folderName]) {
      logger.warn('Le dossier existe déjà', folderName);
      return;
    }

    const updatedFolders = {
      ...contactFolders,
      [folderName]: {
        subfolders: {},
        contacts: []
      }
    };
    
    logger.info('Dossier créé', folderName);
    setContactFolders(sortFoldersRecursively(updatedFolders));
  };

  /**
   * Ajoute un sous-dossier à un chemin donné - UTILISE findFolder()
   */
  const handleAddSubfolder = (folderPath, subfolderName) => {
    if (!folderPath || typeof folderPath !== 'string' || !subfolderName || typeof subfolderName !== 'string') {
      logger.error('Paramètres invalides pour handleAddSubfolder', { folderPath, subfolderName });
      return;
    }

    const { parent, folderName, exists } = findFolder(folderPath, contactFolders);

    // Vérifier que le dossier parent existe
    if (!exists || !parent || !parent[folderName]) {
      logger.error('Dossier cible n\'existe pas', folderPath);
      return;
    }

    // Vérifier que le sous-dossier n'existe pas déjà
    if (parent[folderName].subfolders && parent[folderName].subfolders[subfolderName]) {
      logger.warn('Le sous-dossier existe déjà', subfolderName);
      return;
    }

    // Créer une copie de l'état et ajouter le sous-dossier
    const updatedFolders = JSON.parse(JSON.stringify(contactFolders));
    const { parent: parentCopy, folderName: folderNameCopy } = findFolder(folderPath, updatedFolders);
    
    if (!parentCopy[folderNameCopy].subfolders) {
      parentCopy[folderNameCopy].subfolders = {};
    }
    
    parentCopy[folderNameCopy].subfolders[subfolderName] = {
      subfolders: {},
      contacts: []
    };

    logger.info('Sous-dossier créé', { parent: folderPath, subfolder: subfolderName });
    setContactFolders(sortFoldersRecursively(updatedFolders));
  };

  /**
   * Enlève un contact de TOUS les dossiers (et leurs sous-dossiers)
   */
  const removeContactFromAllFolders = (contactId, folders) => {
    const updated = {};
    
    Object.entries(folders).forEach(([name, folderObj]) => {
      updated[name] = { ...folderObj };
      
      // Enlever du dossier courant
      updated[name].contacts = (folderObj.contacts || []).filter(id => id !== contactId);
      
      // Enlever récursivement des sous-dossiers
      if (folderObj.subfolders && Object.keys(folderObj.subfolders).length > 0) {
        updated[name].subfolders = removeContactFromAllSubfolders(contactId, folderObj.subfolders);
      }
    });
    
    return updated;
  };

  /**
   * Enlève un contact de tous les sous-dossiers (récursif)
   */
  const removeContactFromAllSubfolders = (contactId, subfolders) => {
    const updated = {};
    
    Object.entries(subfolders).forEach(([name, subfolderObj]) => {
      updated[name] = { ...subfolderObj };
      updated[name].contacts = (subfolderObj.contacts || []).filter(id => id !== contactId);
      
      if (subfolderObj.subfolders && Object.keys(subfolderObj.subfolders).length > 0) {
        updated[name].subfolders = removeContactFromAllSubfolders(contactId, subfolderObj.subfolders);
      }
    });
    
    return updated;
  };

  /**
   * Ajoute un contact à un dossier spécifique (l'enlève des autres d'abord)
   * folderPath peut être: "FolderA" ou "FolderA/SubFolder1"
   */
  const handleAddContactToFolder = (contactId, folderPath) => {
    // Enlever du contact de TOUS les dossiers
    let updatedFolders = removeContactFromAllFolders(contactId, contactFolders);
    
    // Naviguer jusqu'au dossier cible
    const pathParts = folderPath.split('/');
    let current = updatedFolders;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!current[part]) {
        current[part] = { subfolders: {}, contacts: [] };
      }
      if (i < pathParts.length - 1) {
        current = current[part].subfolders;
      }
    }
    
    // Ajouter au dossier cible
    const targetFolder = pathParts.reduce((acc, part, idx) => {
      return idx === pathParts.length - 1 ? acc : acc[part].subfolders;
    }, updatedFolders);
    
    const targetFolderName = pathParts[pathParts.length - 1];
    if (!targetFolder[targetFolderName].contacts.includes(contactId)) {
      targetFolder[targetFolderName].contacts.push(contactId);
      
      // Trier les contacts par nom
      targetFolder[targetFolderName].contacts.sort((idA, idB) => {
        const contactA = contacts.find(c => c.id === idA);
        const contactB = contacts.find(c => c.id === idB);
        if (!contactA || !contactB) return 0;
        
        const nameA = `${contactA.lastName} ${contactA.firstName}`.toLowerCase().trim();
        const nameB = `${contactB.lastName} ${contactB.firstName}`.toLowerCase().trim();
        return nameA.localeCompare(nameB, 'fr');
      });
    }
    
    setContactFolders(sortFoldersRecursively(updatedFolders));
  };

  /**
   * Enlève un contact d'un dossier spécifique
   * folderPath peut être: "FolderA" ou "FolderA/SubFolder1"
   */
  const handleRemoveContactFromFolder = (contactId, folderPath) => {
    const updatedFolders = JSON.parse(JSON.stringify(contactFolders));
    const pathParts = folderPath.split('/');
    
    // Naviguer jusqu'au dossier cible
    let current = updatedFolders;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part]) return;
      current = current[part].subfolders;
    }
    
    // Enlever du dossier cible
    const targetFolderName = pathParts[pathParts.length - 1];
    if (current[targetFolderName]) {
      current[targetFolderName].contacts = current[targetFolderName].contacts.filter(id => id !== contactId);
    }
    
    setContactFolders(updatedFolders);
  };

  /**
   * =========================
   * HANDLERS DOSSIERS ORGANIGRAMMES
   * =========================
   */

  const handleAddOrgchartFolder = (folderName) => {
    // Vérifier que le dossier n'existe pas déjà
    if (orgchartFolders[folderName]) {
      logger.warn('Le dossier organigramme existe déjà', folderName);
      return;
    }

    const updatedFolders = {
      ...orgchartFolders,
      [folderName]: {
        subfolders: {},
        orgcharts: []
      }
    };
    
    logger.info('Dossier organigramme créé', folderName);
    setOrgchartFolders(sortFoldersRecursively(updatedFolders, true));
  };

  const handleAddOrgchartSubfolder = (folderPath, subfolderName) => {
    if (!folderPath || typeof folderPath !== 'string' || !subfolderName || typeof subfolderName !== 'string') {
      logger.error('Paramètres invalides pour handleAddOrgchartSubfolder', { folderPath, subfolderName });
      return;
    }

    const { parent, folderName, exists } = findFolder(folderPath, orgchartFolders);

    // Vérifier que le dossier parent existe
    if (!exists || !parent || !parent[folderName]) {
      logger.error('Dossier cible organigramme n\'existe pas', folderPath);
      return;
    }

    // Vérifier que le sous-dossier n'existe pas déjà
    if (parent[folderName].subfolders && parent[folderName].subfolders[subfolderName]) {
      logger.warn('Le sous-dossier organigramme existe déjà', subfolderName);
      return;
    }

    // Créer une copie profonde et ajouter le sous-dossier
    const updatedFolders = JSON.parse(JSON.stringify(orgchartFolders));
    const { parent: parentCopy, folderName: folderNameCopy } = findFolder(folderPath, updatedFolders);
    
    if (!parentCopy[folderNameCopy].subfolders) {
      parentCopy[folderNameCopy].subfolders = {};
    }
    
    parentCopy[folderNameCopy].subfolders[subfolderName] = {
      subfolders: {},
      orgcharts: []
    };

    logger.info('Sous-dossier organigramme créé', { parent: folderPath, subfolder: subfolderName });
    setOrgchartFolders(sortFoldersRecursively(updatedFolders, true));
  };

  const handleMoveOrgchartToFolder = (orgchartId, folderPath) => {
    // Deep clone pour éviter les mutations
    const updatedFolders = JSON.parse(JSON.stringify(orgchartFolders));
    
    // Enlever de TOUS les dossiers d'abord
    const removeFromAll = (folders) => {
      const updated = {};
      Object.entries(folders).forEach(([name, folderObj]) => {
        updated[name] = { ...folderObj };
        updated[name].orgcharts = (folderObj.orgcharts || []).filter(id => id !== orgchartId);
        
        if (folderObj.subfolders && Object.keys(folderObj.subfolders).length > 0) {
          updated[name].subfolders = removeFromAll(folderObj.subfolders);
        }
      });
      return updated;
    };

    let cleanedFolders = removeFromAll(updatedFolders);
    
    // Ajouter au dossier cible
    const pathParts = folderPath.split('/');
    let current = cleanedFolders;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!current[part]) {
        current[part] = { subfolders: {}, orgcharts: [] };
      }
      if (i < pathParts.length - 1) {
        current = current[part].subfolders;
      }
    }
    
    const targetFolder = pathParts.reduce((acc, part, idx) => {
      return idx === pathParts.length - 1 ? acc : acc[part].subfolders;
    }, cleanedFolders);
    
    const targetFolderName = pathParts[pathParts.length - 1];
    if (!targetFolder[targetFolderName].orgcharts.includes(orgchartId)) {
      targetFolder[targetFolderName].orgcharts.push(orgchartId);
    }
    
    setOrgchartFolders(sortFoldersRecursively(cleanedFolders, true));
  };

  /**
   * Renomme un dossier de contacts
   */
  const handleRenameFolderContact = (folderPath, newName) => {
    if (!newName.trim()) return;
    
    const updatedFolders = JSON.parse(JSON.stringify(contactFolders));
    const pathParts = folderPath.split('/');
    
    if (pathParts.length === 1) {
      // Dossier racine
      if (updatedFolders[newName]) return; // Nom déjà utilisé
      updatedFolders[newName] = updatedFolders[folderPath];
      delete updatedFolders[folderPath];
    } else {
      // Sous-dossier
      let current = updatedFolders;
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]].subfolders;
      }
      current[newName] = current[folderPath.split('/').pop()];
      delete current[folderPath.split('/').pop()];
    }
    
    setContactFolders(updatedFolders);
  };

  /**
   * Supprime un dossier de contacts - UTILISE findFolder()
   */
  const handleDeleteFolderContact = (folderPath) => {
    // Validation
    if (!folderPath || typeof folderPath !== 'string') {
      logger.error('Chemin de dossier invalide pour suppression', folderPath);
      return;
    }

    const { parent, folderName, exists } = findFolder(folderPath, contactFolders);

    // Vérifier que le dossier existe
    if (!exists || !parent || !parent[folderName]) {
      logger.error('Dossier à supprimer n\'existe pas', folderPath);
      return;
    }

    // Créer une copie profonde et supprimer
    const updatedFolders = JSON.parse(JSON.stringify(contactFolders));
    const { parent: parentCopy, folderName: folderNameCopy } = findFolder(folderPath, updatedFolders);
    
    delete parentCopy[folderNameCopy];

    logger.info('Dossier supprimé', folderPath);
    setContactFolders(updatedFolders);
  };

  /**
   * Renomme un dossier d'organigrammes
   */
  const handleRenameFolderOrgchart = (folderPath, newName) => {
    if (!newName.trim()) return;
    
    const updatedFolders = JSON.parse(JSON.stringify(orgchartFolders));
    const pathParts = folderPath.split('/');
    
    if (pathParts.length === 1) {
      // Dossier racine
      if (updatedFolders[newName]) return; // Nom déjà utilisé
      updatedFolders[newName] = updatedFolders[folderPath];
      delete updatedFolders[folderPath];
    } else {
      // Sous-dossier
      let current = updatedFolders;
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]].subfolders;
      }
      current[newName] = current[folderPath.split('/').pop()];
      delete current[folderPath.split('/').pop()];
    }
    
    setOrgchartFolders(updatedFolders);
  };

  /**
   * Supprime un dossier d'organigrammes
   */
  const handleDeleteFolderOrgchart = (folderPath) => {
    // Validation
    if (!folderPath || typeof folderPath !== 'string') {
      logger.error('Chemin de dossier invalide pour suppression organigramme', folderPath);
      return;
    }

    const { parent, folderName, exists } = findFolder(folderPath, orgchartFolders);

    // Vérifier que le dossier existe
    if (!exists || !parent || !parent[folderName]) {
      logger.error('Dossier organigramme à supprimer n\'existe pas', folderPath);
      return;
    }

    // Créer une copie profonde et supprimer
    const updatedFolders = JSON.parse(JSON.stringify(orgchartFolders));
    const { parent: parentCopy, folderName: folderNameCopy } = findFolder(folderPath, updatedFolders);
    
    delete parentCopy[folderNameCopy];

    logger.info('Dossier organigramme supprimé', folderPath);
    setOrgchartFolders(updatedFolders);
  };

  /**
   * Drag & drop: Déplacer un dossier contact dans un autre dossier - UTILISE findFolder()
   * IMPORTANT: Le dossier source devient un SOUS-DOSSIER du dossier cible
   */
  const handleMoveFolderToFolder = (sourceFolderPath, targetFolderPath) => {
    // Validation basique
    if (!sourceFolderPath || !targetFolderPath || typeof sourceFolderPath !== 'string' || typeof targetFolderPath !== 'string') {
      logger.error('Chemins invalides pour le déplacement de dossier', { sourceFolderPath, targetFolderPath });
      return;
    }
    if (sourceFolderPath === targetFolderPath) return;
    if (targetFolderPath.startsWith(sourceFolderPath + '/')) return;
    
    // Chercher le dossier source et cible dans l'état ACTUEL (non nettoyé)
    const sourceInfo = findFolder(sourceFolderPath, contactFolders);
    const targetInfo = findFolder(targetFolderPath, contactFolders);
    
    // Validation complète
    if (!sourceInfo.exists || !sourceInfo.parent || !sourceInfo.parent[sourceInfo.folderName]) {
      logger.error('Dossier source n\'existe pas', sourceFolderPath);
      return;
    }
    
    if (!targetInfo.exists || !targetInfo.parent || !targetInfo.parent[targetInfo.folderName]) {
      logger.error('Dossier cible n\'existe pas', targetFolderPath);
      return;
    }

    // Créer une copie profonde
    const updatedFolders = JSON.parse(JSON.stringify(contactFolders));
    const { parent: sourceParentCopy, folderName: sourceFolderNameCopy } = findFolder(sourceFolderPath, updatedFolders);
    const { parent: targetParentCopy, folderName: targetFolderNameCopy } = findFolder(targetFolderPath, updatedFolders);
    
    // Cloner le dossier source (contenu + structure)
    const folderToMove = JSON.parse(JSON.stringify(sourceParentCopy[sourceFolderNameCopy]));
    
    // Ajouter le dossier source comme sous-dossier de la cible
    if (!targetParentCopy[targetFolderNameCopy].subfolders) {
      targetParentCopy[targetFolderNameCopy].subfolders = {};
    }
    targetParentCopy[targetFolderNameCopy].subfolders[sourceFolderNameCopy] = folderToMove;
    
    // Supprimer le dossier source de son emplacement original
    delete sourceParentCopy[sourceFolderNameCopy];

    logger.info('Dossier déplacé', { from: sourceFolderPath, to: targetFolderPath });
    setContactFolders(sortFoldersRecursively(updatedFolders));
  };

  /**
   * Drag & drop: Déplacer un dossier organigramme dans un autre dossier - UTILISE findFolder()
   * IMPORTANT: Le dossier source devient un SOUS-DOSSIER du dossier cible
   */
  const handleMoveOrgchartFolderToFolder = (sourceFolderPath, targetFolderPath) => {
    // Validation basique
    if (!sourceFolderPath || !targetFolderPath || typeof sourceFolderPath !== 'string' || typeof targetFolderPath !== 'string') {
      logger.error('Chemins invalides pour le déplacement de dossier organigramme', { sourceFolderPath, targetFolderPath });
      return;
    }
    if (sourceFolderPath === targetFolderPath) return;
    if (targetFolderPath.startsWith(sourceFolderPath + '/')) return;
    
    // Chercher le dossier source et cible dans l'état ACTUEL (non nettoyé)
    const sourceInfo = findFolder(sourceFolderPath, orgchartFolders);
    const targetInfo = findFolder(targetFolderPath, orgchartFolders);
    
    // Validation complète
    if (!sourceInfo.exists || !sourceInfo.parent || !sourceInfo.parent[sourceInfo.folderName]) {
      logger.error('Dossier source organigramme n\'existe pas', sourceFolderPath);
      return;
    }
    
    if (!targetInfo.exists || !targetInfo.parent || !targetInfo.parent[targetInfo.folderName]) {
      logger.error('Dossier cible organigramme n\'existe pas', targetFolderPath);
      return;
    }

    // Créer une copie profonde
    const updatedFolders = JSON.parse(JSON.stringify(orgchartFolders));
    const { parent: sourceParentCopy, folderName: sourceFolderNameCopy } = findFolder(sourceFolderPath, updatedFolders);
    const { parent: targetParentCopy, folderName: targetFolderNameCopy } = findFolder(targetFolderPath, updatedFolders);
    
    // Cloner le dossier source (contenu + structure)
    const folderToMove = JSON.parse(JSON.stringify(sourceParentCopy[sourceFolderNameCopy]));
    
    // Ajouter le dossier source comme sous-dossier de la cible
    if (!targetParentCopy[targetFolderNameCopy].subfolders) {
      targetParentCopy[targetFolderNameCopy].subfolders = {};
    }
    targetParentCopy[targetFolderNameCopy].subfolders[sourceFolderNameCopy] = folderToMove;
    
    // Supprimer le dossier source de son emplacement original
    delete sourceParentCopy[sourceFolderNameCopy];

    logger.info('Dossier organigramme déplacé', { from: sourceFolderPath, to: targetFolderPath });
    setOrgchartFolders(updatedFolders);
  };

  /**
   * Drag & drop: Accepter un organigramme droppé depuis OrgChartsList
   */
  // eslint-disable-next-line no-unused-vars
  const handleDropOrgchartOnFolder = (orgchartId, targetFolderPath) => {
    handleMoveOrgchartToFolder(orgchartId, targetFolderPath);
  };

  const handleCreateOrgChart = (orgChart) => {
    const newOrgChart = { ...orgChart, id: `org_${Date.now()}` };
    setOrgcharts([...orgcharts, newOrgChart]);
    setSelectedOrgChart(newOrgChart);
  };

  const handleUpdateOrgChart = (updatedOrgChart) => {
    if (!updatedOrgChart || !updatedOrgChart.id) {
      console.warn('[App] ⚠️ handleUpdateOrgChart called with invalid orgChart:', updatedOrgChart);
      return;
    }
    if (!Array.isArray(orgcharts)) {
      console.warn('[App] ⚠️ orgcharts is not an array:', orgcharts);
      return;
    }
    
    try {
      setOrgcharts(orgcharts.map(o => o.id === updatedOrgChart.id ? updatedOrgChart : o));
      setSelectedOrgChart(updatedOrgChart);
    } catch (err) {
      console.error('[App] ❌ Error in handleUpdateOrgChart:', err);
    }
  };

  const handleDeleteOrgChart = (orgChartId) => {
    const filtered = orgcharts.filter(o => o.id !== orgChartId);
    setOrgcharts(filtered);
    if (selectedOrgChart?.id === orgChartId) {
      setSelectedOrgChart(filtered.length > 0 ? filtered[0] : null);
    }
  };

  const handleDuplicateOrgChart = (orgChartToDuplicate) => {
    try {
      if (!orgChartToDuplicate) return;
      
      // Créer une copie profonde de l'organigramme
      const duplicatedOrgChart = JSON.parse(JSON.stringify(orgChartToDuplicate));
      
      // Générer un nouvel ID et modifier le nom
      duplicatedOrgChart.id = `org_${Date.now()}`;
      duplicatedOrgChart.name = `${orgChartToDuplicate.name} (copie)`;
      duplicatedOrgChart.createdAt = new Date();
      duplicatedOrgChart.updatedAt = new Date();
      
      // Ajouter l'organigramme dupliqué à la liste
      const newOrgcharts = [...orgcharts, duplicatedOrgChart];
      setOrgcharts(newOrgcharts);
      
      // 🎯 DUPLIQUER AUSSI LES AFFICHAGES (displayFieldsByOrgChart)
      const originalDisplayFields = displayFieldsByOrgChart[orgChartToDuplicate.id];
      if (originalDisplayFields) {
        const updatedDisplayFieldsByOrgChart = {
          ...displayFieldsByOrgChart,
          [duplicatedOrgChart.id]: JSON.parse(JSON.stringify(originalDisplayFields))
        };
        setDisplayFieldsByOrgChart(updatedDisplayFieldsByOrgChart);
      }
      
      // Sélectionner le nouvel organigramme
      setSelectedOrgChart(duplicatedOrgChart);
      
      console.log('[App] ✅ Organigramme dupliqué:', duplicatedOrgChart.name);
    } catch (err) {
      console.error('[App] ❌ Erreur lors de la duplication:', err);
    }
  };

  /**
   * Ouvre la fenêtre d'export
   */
  const handleExport = async () => {
    if (!selectedOrgChart) {
      alert('❌ Veuillez sélectionner un organigramme à exporter');
      return;
    }

    setShowExportWindow(true);
  };

  /**
   * Gère l'export réel depuis la fenêtre d'export
   */
  const handleExportSubmit = async (options) => {
    try {
      console.log('[App] 📤 Export - Options reçues:', options);
      
      // Appeler Electron pour exporter
      const result = await window.electronAPI.exportOrgChart(
        selectedOrgChart.name,
        options
      );

      if (result.success) {
        console.log('[App] ✅ Export réussi:', result.filePath);
        alert(`✅ Export réussi!\nFichier sauvegardé: ${result.filePath}`);
        setShowExportWindow(false);
      } else {
        console.error('[App] ❌ Erreur export:', result.error);
        throw new Error(result.error || 'Erreur lors de l\'export');
      }
    } catch (err) {
      console.error('[App] ❌ Erreur export:', err);
      alert('❌ Erreur lors de l\'export: ' + err.message);
      throw err;
    }
  };

  /**
   * Sauvegarde l'état actuel dans l'historique
   */
  const saveToHistory = () => {
    if (historyInProgressRef.current) return;
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(orgcharts)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  /**
   * Revenir à l'état précédent (Ctrl+Z)
   */
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    
    historyInProgressRef.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setOrgcharts(JSON.parse(JSON.stringify(history[newIndex])));
    
    setTimeout(() => {
      historyInProgressRef.current = false;
    }, 0);
  };

  /**
   * Avancer à l'état suivant (Ctrl+Y)
   */
  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    
    historyInProgressRef.current = true;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setOrgcharts(JSON.parse(JSON.stringify(history[newIndex])));
    
    setTimeout(() => {
      historyInProgressRef.current = false;
    }, 0);
  };

  /**
   * Réinitialise toutes les données de manière fiable
   * ✅ Active le flag resetInProgress AVANT de vider
   * ✅ Bloque usePersistence pendant le reset
   * ✅ Vide l'état React et le storage
   * ✅ Recharge la page proprement
   * 
   * ⚠️ ASYNC: Doit être attendu pour que le reset soit complet!
   */
  const handleRefresh = () => {
    console.log('[App] 🔄 Actualisation manuelle déclenchée');
    if (selectedOrgChart && orgChartCanvasRef?.current?.refresh) {
      // Appeler la méthode imperativement au lieu de remonter le composant
      // Cela garde le zoom/pan intact
      orgChartCanvasRef.current.refresh();
      console.log('[App] ✅ Refresh exécuté');
    } else {
      console.warn('[App] ⚠️ Impossible d\'exécuter refresh:', {
        hasSelectedOrgChart: !!selectedOrgChart,
        hasCanvasRef: !!orgChartCanvasRef?.current,
        hasRefreshMethod: typeof orgChartCanvasRef?.current?.refresh
      });
    }
  };

  const handleClearAllData = async () => {
    try {
      console.log('[App] 🔴 DÉBUT: Reset complet des données');
      
      // 🔑 ÉTAPE 1: Activer le flag de reset pour bloquer usePersistence SYNCHRONEMENT
      console.log('[App] ✓ Étape 1: Activation du flag resetInProgress');
      resetInProgressRef.current = true;  // ✅ Synchrone! Bloque immédiatement

      // 🔑 ÉTAPE 2: Vider TOUS les états React de manière SYNCHRONE avec flushSync
      console.log('[App] ✓ Étape 2: Réinitialisation synchrone de l\'état React');
      try {
        flushSync(() => {
          setSelectedOrgChart(null); // ✅ Faire d'abord pour protéger les components
          setContacts([]);
          setContactFolders({});
          setOrgcharts([]);
          setOrgchartFolders({});
          setExpandedFolders({});
          setExpandedSections({ contacts: true });
          setExcelPath(null);
          setExcelVersion(null);
          setDisplayFields({
            position: true,
            agency: false,
            age: false,
            email: false,
            phone: false,
            address: false
          });
        });
      } catch (stateError) {
        console.error('[App] ⚠️ Erreur lors de la réinitialisation d\'état:', stateError);
        // Continuer même s'il y a une erreur d'état
      }
      
      console.log('[App] ✓ État React vidé synchronement, usePersistence bloquée');

      // 🔑 ÉTAPE 3: Vider le localStorage et sessionStorage
      console.log('[App] ✓ Étape 3: Nettoyage localStorage/sessionStorage');
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageError) {
        console.warn('[App] ⚠️ Erreur clearing storage:', storageError);
      }
      console.log('[App] ✓ localStorage.length:', localStorage.length);
      console.log('[App] ✓ sessionStorage.length:', sessionStorage.length);

      // 🔑 ÉTAPE 4: Vider les données Electron userData si disponible
      console.log('[App] ✓ Étape 4: Nettoyage Electron userData');
      if (window.electronAPI?.clearUserData) {
        try {
          await window.electronAPI.clearUserData();
          console.log('[App] ✓ Electron userData supprimé');
        } catch (electronError) {
          console.warn('[App] ⚠️ Erreur clearing Electron:', electronError);
        }
      }

      // 🔑 ÉTAPE 5: Attendre avant rechargement pour s'assurer que tout est vidé
      console.log('[App] ✓ Étape 5: Attente avant rechargement');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('[App] ✅ SUCCÈS: Reset complète, rechargement');
      window.location.href = window.location.pathname;
    } catch (error) {
      console.error('[App] ❌ ERREUR lors du reset:', error);
      resetInProgressRef.current = false;  // Débloquer en cas d'erreur
      alert('❌ Erreur lors de la suppression des données: ' + error.message);
    }
  };

  return (
    <ErrorBoundary>
      <div className="app-layout">
        {/* Barre supérieure */}
        <TopBar
          onImportExcel={() => setShowImportDialog(true)}
          hasExcelLoaded={!!excelPath}
          onClearAllData={handleClearAllData}
          onExport={handleExport}
          onCheckUpdates={handleCheckExcelUpdates}
          differencesCount={differencesCount}
          selectedOrgChart={selectedOrgChart}
        />

        {/* Zone principale 3 colonnes: DOSSIERS | CANVAS | LISTE */}
        <div className="app-body">
          {/* SplitLayout gère le diviseur et isole le state du resize */}
          <SplitLayout
            leftPanel={() => (
              <ContactsPanel
                contacts={contacts}
                folders={contactFolders}
                orgcharts={orgcharts}
                isReadOnly={false}
                expandedFolders={expandedFolders}
                setExpandedFolders={setExpandedFolders}
                expandedSections={expandedSections}
                setExpandedSections={setExpandedSections}
                onAddFolder={handleAddContactFolder}
                onAddSubfolder={handleAddSubfolder}
                onAddContactToFolder={handleAddContactToFolder}
                onRemoveContactFromFolder={handleRemoveContactFromFolder}
                onRenameFolder={handleRenameFolderContact}
                onDeleteFolder={handleDeleteFolderContact}
              />
            )}
            rightPanel={() => (
              <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                {/* COLONNE 2 (MILIEU): Canvas Organigramme */}
                <OrgChartCanvas
                  ref={orgChartCanvasRef}
                  selectedOrgChart={selectedOrgChart}
                  allContacts={contacts}
                  onUpdateOrgChart={handleUpdateOrgChart}
                  onCreateOrgChart={handleCreateOrgChart}
                  displayFields={displayFields}
                  setDisplayFields={setDisplayFields}
                />



                {/* COLONNE 3 (DROITE): Liste des organigrammes */}
                <OrgChartsList
                  orgcharts={orgcharts}
                  orgchartFolders={orgchartFolders}
                  selectedOrgChart={selectedOrgChart}
                  onSelectOrgChart={setSelectedOrgChart}
                  onCreateOrgChart={handleCreateOrgChart}
                  onUpdateOrgChart={handleUpdateOrgChart}
                  onDeleteOrgChart={handleDeleteOrgChart}
                  onDuplicateOrgChart={handleDuplicateOrgChart}
                  onAddFolder={handleAddOrgchartFolder}
                  onAddSubfolder={handleAddOrgchartSubfolder}
                  onMoveOrgchartToFolder={handleMoveOrgchartToFolder}
                  onMoveOrgchartFolderToFolder={handleMoveOrgchartFolderToFolder}
                  onRenameFolder={handleRenameFolderOrgchart}
                  onDeleteFolder={handleDeleteFolderOrgchart}
                />
              </div>
            )}
          />
        </div>

        {/* Dialogs */}
        <ImportDialog
          isOpen={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImportSuccess={handleImportExcel}
        />

        <ChangesDialog
          isOpen={showChangesDialog}
          changes={detectedChanges}
          onClose={() => setShowChangesDialog(false)}
          onValidate={handleValidateChanges}
        />

        <DifferencesDialog
          isOpen={showDifferencesDialog}
          changes={detectedChanges || { added: [], removed: [], modified: [], summary: { totalAdded: 0, totalRemoved: 0, totalModified: 0, total: 0 } }}
          onApply={handleApplyDifferences}
          onCancel={handleCloseDifferencesDialog}
        />

        <ExportWindow
          isOpen={showExportWindow}
          onClose={() => setShowExportWindow(false)}
          selectedOrgChart={selectedOrgChart}
          orgChartCanvasRef={orgChartCanvasRef}
          onExport={handleExportSubmit}
          allContacts={contacts}
          displayFields={displayFields}
          blocks={selectedOrgChart?.blocks || []}
        />

        {/* Loading Overlay - Bloque l'UI pendant l'import Excel */}
        <LoadingOverlay
          isVisible={isImporting}
          message="Import Excel en cours... Cela peut prendre quelques secondes pour les fichiers volumineux."
          onDismissed={handleLoadingOverlayDismissed}
        />

        {/* LogViewer - Affiche les logs en bas à droite */}
        <LogViewer />
      </div>
    </ErrorBoundary>
  );
}

export default App;
