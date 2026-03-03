import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import html2canvas from 'html2canvas';
import { SnapshotExportService, LayoutSnapshot } from '../../services/LayoutSnapshotService';
import ExportPreview from './ExportPreview';
import '../../styles/dialogs/ExportWindow.css';

/**
 * Fenêtre d'export - Interface utilisateur pour les options d'export
 * Utilise un snapshot du layout plutôt que de dépendre du DOM
 */
function ExportWindow({ isOpen, onClose, selectedOrgChart, orgChartCanvasRef, onExport, allContacts = [], displayFields = {}, blocks = [] }) {
  // Formats standards de papier ISO 216 (en mm)
  const PAPER_FORMATS = {
    'A0': { width: 841, height: 1189, label: 'A0' },
    'A1': { width: 594, height: 841, label: 'A1' },
    'A2': { width: 420, height: 594, label: 'A2' },
    'A3': { width: 297, height: 420, label: 'A3' },
    'A4': { width: 210, height: 297, label: 'A4' },
    'A5': { width: 148, height: 210, label: 'A5' }
  };

  const [format, setFormat] = useState('PNG');
  const [orientation, setOrientation] = useState('landscape');
  const [paperFormat, setPaperFormat] = useState('A4');
  const [fileName, setFileName] = useState('organigramme');
  const [exportFolder, setExportFolder] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSnapshot, setExportSnapshot] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]); // Affichage des logs dans l'UI
  const [logoImageUrl, setLogoImageUrl] = useState(null); // Data URL du logo
  const [logoPosition, setLogoPosition] = useState('top-right'); // top-left | top-right | bottom-left | bottom-right
  const [logoHasTransparency, setLogoHasTransparency] = useState(null); // null=unknown, true/false
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastSnapshotRef = useRef(null); // Pour éviter les re-renders inutiles

  // Ajouter un log à l'affichage UI
  const addLog = useCallback((message, data = null) => {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const logEntry = data ? `[${timestamp}] ${message}: ${JSON.stringify(data)}` : `[${timestamp}] ${message}`;
    console.log(logEntry); // Toujours afficher dans la console aussi
    setDebugLogs(prev => [...prev.slice(-100), logEntry]); // Garder les 100 derniers logs
  }, []); // Pour éviter les re-renders inutiles

  // DPI constant pour l'export (utilisé partout pour consistance centering)
  // 600 DPI = résolution ultra-haute pour archive/impression professionnelle
  const EXPORT_DPI = 600;

  // Calculer les dimensions réelles de la feuille selon l'orientation (wrapper useMemo pour stabilité)
  const paperDimensions = useMemo(() => {
    const baseDim = PAPER_FORMATS[paperFormat];
    if (orientation === 'portrait') {
      // En portrait, largeur < hauteur
      return baseDim.width < baseDim.height 
        ? { width: baseDim.width, height: baseDim.height }
        : { width: baseDim.height, height: baseDim.width };
    } else {
      // En paysage, largeur > hauteur
      return baseDim.width > baseDim.height 
        ? { width: baseDim.width, height: baseDim.height }
        : { width: baseDim.height, height: baseDim.width };
    }
  }, [paperFormat, orientation]);

  // Créer un snapshot adapté aux dimensions du papier pour l'export
  // Fallback vers mainSnapshot si la création échoue
  const createExportSnapshot = useCallback((mainSnapshot, paperDims) => {
    if (!mainSnapshot || !mainSnapshot.positions || mainSnapshot.positions.size === 0) {
      addLog('createExportSnapshot: snapshot invalide, retour null');
      return null;
    }

    try {
      // Les positions du snapshot du canvas sont les positions ABSOLUES du layout
      // Elles ne changent pas selon la taille de la feuille d'export
      // Seul le centrage et zoom changent
      
      // IMPORTANT: S'assurer que les connexions sont présentes et copiées
      const conns = mainSnapshot.connections;
      addLog('📊 createExportSnapshot DEBUG:', {
        connectionsPresentInSnapshot: !!conns,
        connectionsType: typeof conns,
        connectionsIsArray: Array.isArray(conns),
        connectionsLength: conns?.length || 'undefined',
        connectionsValue: conns
      });
      
      // Calculer les dimensions d'export en pixels (utiliser EXPORT_DPI constant pour consistance)
      const MM_TO_PX = EXPORT_DPI / 25.4;
      const exportPx = {
        width: (paperDims.width || 0) * MM_TO_PX,
        height: (paperDims.height || 0) * MM_TO_PX
      };

      // Recomposer un layoutResult utilisable par LayoutSnapshot
      const layoutResult = {
        positions: mainSnapshot.positions,
        connections: mainSnapshot.connections || [],
        viewport: mainSnapshot.viewport || { x: 0, y: 0, width: 0, height: 0 },
        fitToView: mainSnapshot.fitToView || {}
      };

      const canvasDims = {
        width: mainSnapshot.canvasWidth || (exportPx.width || 1000),
        height: mainSnapshot.canvasHeight || (exportPx.height || 1000)
      };

      // Créer un LayoutSnapshot spécifiquement pour l'export (calculera centeringValues pour la page)
      const exportLayoutSnapshot = new LayoutSnapshot(layoutResult, canvasDims, exportPx);

      addLog('✅ Export LayoutSnapshot créé (centering calculé pour la page)', {
        positionsSize: exportLayoutSnapshot.positions?.size,
        connectionsLength: exportLayoutSnapshot.connections?.length,
        centeringValues: exportLayoutSnapshot.centeringValues
      });

      return exportLayoutSnapshot;
    } catch (err) {
      addLog('❌ Erreur création export snapshot', err.message);
      return null;
    }
  }, [addLog]);

  // Créer un snapshot adapté aux dimensions du papier pour l'export
  // UTILISER UN ABONNEMENT: Remplacer le polling par une subscription évènementielle
  useEffect(() => {
    if (!isOpen) {
      console.log('[ExportWindow] 🔴 Dialog fermée - Reset snapshot');
      setExportSnapshot(null);
      lastSnapshotRef.current = null;
      return;
    }

    addLog('[ExportWindow] 🟢 Dialog ouverte - Abonnement au snapshot (subscribe)');

    let unsubscribe = null;

    const handleSnapshot = (mainSnapshot) => {
      addLog('🔔 subscribeSnapshot: snapshot reçu', { positions: mainSnapshot?.positions?.size, connections: mainSnapshot?.connections?.length });
      try {
        addLog(`❓ snapshot.positions existe?`, !!mainSnapshot?.positions);
        addLog(`❓ snapshot.positions.size`, mainSnapshot?.positions?.size || 'undefined');

        if (mainSnapshot && mainSnapshot.positions && mainSnapshot.positions.size > 0) {
          const positionsDebug = Array.from(mainSnapshot.positions.entries())
            .slice(0, 3)
            .map(([id, pos]) => `${id.substring(0, 6)}: (${Math.round(pos.x)}, ${Math.round(pos.y)})`)
            .join(', ');
          addLog('📍 Positions du canvas', positionsDebug);

          if (mainSnapshot.connections && mainSnapshot.connections.length > 0) {
            const connDebug = mainSnapshot.connections[0];
            addLog('✅ CONNEXIONS PRÉSENTES!', {
              count: mainSnapshot.connections.length,
              isArray: Array.isArray(mainSnapshot.connections),
              first: `(${Math.round(connDebug.fromPos?.x || 0)}, ${Math.round(connDebug.fromPos?.y || 0)}) → (${Math.round(connDebug.toPos?.x || 0)}, ${Math.round(connDebug.toPos?.y || 0)})`
            });
          } else {
            addLog('⚠️ CONNEXIONS MANQUANTES!', {
              connectionsExists: !!mainSnapshot.connections,
              connectionsType: typeof mainSnapshot.connections,
              connectionsIsArray: Array.isArray(mainSnapshot.connections),
              connectionsLength: mainSnapshot.connections?.length,
              connectionsValue: mainSnapshot.connections
            });
          }

          const exportSnap = createExportSnapshot(mainSnapshot, paperDimensions);
          if (exportSnap && exportSnap.positions && exportSnap.positions.size > 0) {
            addLog('✅ Export snapshot créé', { 
              positions: exportSnap.positions?.size,
              connections: exportSnap.connections?.length,
              connectionsIsArray: Array.isArray(exportSnap.connections),
              connectionsType: typeof exportSnap.connections,
              firstConn: exportSnap.connections?.[0]
            });
            addLog('🚀 VA PASSER À EXPORTPREVIEW:', {
              exportSnapExists: !!exportSnap,
              positionsSize: exportSnap.positions?.size,
              connectionsLength: exportSnap.connections?.length
            });
            setExportSnapshot(exportSnap);
          } else {
            addLog('⚠️ createExportSnapshot échoué ou vide, fallback au snapshot principal');
            setExportSnapshot(mainSnapshot);
          }
          lastSnapshotRef.current = mainSnapshot;
        } else {
          addLog('⚠️ Snapshot invalide: pas de positions', { size: mainSnapshot?.positions?.size });
          if (lastSnapshotRef.current) {
            addLog('🔄 Fallback: dernier snapshot valide', { positions: lastSnapshotRef.current.positions?.size });
            setExportSnapshot(lastSnapshotRef.current);
          }
        }
      } catch (err) {
        addLog('❌ subscribe handler - Erreur', err.message);
      }
    };

    // Si le canvas expose la méthode subscribeSnapshot, utiliser l'abonnement
    if (orgChartCanvasRef?.current?.subscribeSnapshot) {
      addLog('✅ Utilisation de subscribeSnapshot()');
      unsubscribe = orgChartCanvasRef.current.subscribeSnapshot(handleSnapshot);

      // Appel initial immédiat si getLayoutSnapshot existe
      try {
        if (orgChartCanvasRef.current.getLayoutSnapshot) {
          const initial = orgChartCanvasRef.current.getLayoutSnapshot();
          if (initial) handleSnapshot(initial);
        }
      } catch (err) {
        addLog('❌ Erreur getLayoutSnapshot initial', err.message);
      }
    } else {
      // Fallback: lire une fois le snapshot s'il est disponible
      addLog('⚠️ subscribeSnapshot non disponible, fallback to getLayoutSnapshot once');
      try {
        if (orgChartCanvasRef.current?.getLayoutSnapshot) {
          const s = orgChartCanvasRef.current.getLayoutSnapshot();
          if (s) handleSnapshot(s);
        }
      } catch (err) {
        addLog('❌ getLayoutSnapshot fallback error', err.message);
      }
    }

    return () => {
      try {
        if (typeof unsubscribe === 'function') unsubscribe();
        addLog('🔕 Unsubscribed from snapshot');
      } catch (err) {
        addLog('❌ Erreur lors de unsubscribe', err.message);
      }
    };
  }, [isOpen, orgChartCanvasRef, createExportSnapshot, paperDimensions, addLog]);

  // NOTE: monitoring polling removed - using subscription via subscribeSnapshot instead

  // Définir le nom par défaut
  useEffect(() => {
    if (selectedOrgChart?.name) {
      setFileName(selectedOrgChart.name.replace(/\s+/g, '_'));
    }
  }, [selectedOrgChart]);

  // L'aperçu est rendu directement par ExportPreview avec exportSnapshot
  // Aucune capture PNG nécessaire pour l'aperçu (les données du snapshot sont rendues en SVG)
  useEffect(() => {
    if (!isOpen) {
      console.log('[ExportWindow] ℹ️ Dialog fermée');
    }
  }, [isOpen]);

  /**
   * Gère la sélection d'un fichier logo
   */
  const handleLogoSelect = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      alert('❌ Veuillez sélectionner un fichier image valide (PNG, JPG, SVG, etc.)');
      return;
    }

    // Lire le fichier et convertir en data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (dataUrl) {
        // Détecter si l'image a des pixels transparents (alpha channel)
        const testImg = new Image();
        testImg.crossOrigin = 'anonymous';
        testImg.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = testImg.naturalWidth || testImg.width || 1;
            c.height = testImg.naturalHeight || testImg.height || 1;
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.drawImage(testImg, 0, 0);
            const imgData = ctx.getImageData(0, 0, Math.min(3, c.width), Math.min(3, c.height)).data;
            let hasTransparency = false;
            for (let i = 0; i < imgData.length; i += 4) {
              const a = imgData[i + 3];
              if (a !== 255) { hasTransparency = true; break; }
            }
            setLogoImageUrl(dataUrl);
            setLogoHasTransparency(hasTransparency);
            console.log('[ExportWindow] ✅ Logo chargé');
            console.log('[ExportWindow] 🔎 Test transparence logo:', { hasTransparency });
            if (!hasTransparency) {
              console.warn('[ExportWindow] ⚠️ Le fichier PNG ne contient pas d\'alpha détectable — tentative de suppression automatique du fond...');
              try {
                // Essayer d'identifier la couleur de fond en échantillonnant les coins
                const sampleSize = 6;
                const w = c.width;
                const h = c.height;
                const getPixel = (x, y) => {
                  const d = ctx.getImageData(x, y, 1, 1).data;
                  return [d[0], d[1], d[2], d[3]];
                };
                const corners = [
                  getPixel(0, 0),
                  getPixel(w - 1, 0),
                  getPixel(0, h - 1),
                  getPixel(w - 1, h - 1)
                ];
                // Moyenne des coins
                const bg = [0, 0, 0];
                corners.forEach(px => { bg[0] += px[0]; bg[1] += px[1]; bg[2] += px[2]; });
                bg[0] = Math.round(bg[0] / corners.length);
                bg[1] = Math.round(bg[1] / corners.length);
                bg[2] = Math.round(bg[2] / corners.length);
                // Seuil de similitude (ajustable)
                const threshold = 24; // 0-255
                const imgFull = ctx.getImageData(0, 0, w, h);
                const data = imgFull.data;
                let removed = 0;
                for (let i = 0; i < data.length; i += 4) {
                  const dr = data[i] - bg[0];
                  const dg = data[i + 1] - bg[1];
                  const db = data[i + 2] - bg[2];
                  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
                  if (dist <= threshold) {
                    data[i + 3] = 0; // rendre transparent
                    removed++;
                  }
                }
                ctx.putImageData(imgFull, 0, 0);
                const newDataUrl = c.toDataURL('image/png');
                setLogoImageUrl(newDataUrl);
                setLogoHasTransparency(true);
                console.log('[ExportWindow] ✅ Suppression automatique du fond appliquée, nouveaux pixels transparents:', removed);
              } catch (remErr) {
                console.warn('[ExportWindow] ⚠️ Échec suppression automatique du fond:', remErr.message);
              }
            }
          } catch (err) {
            // Si un problème survient (CORS, etc.), on sauvegarde quand même et logge l'erreur
            setLogoImageUrl(dataUrl);
            setLogoHasTransparency(null);
            console.warn('[ExportWindow] ⚠️ Impossible de tester la transparence du logo (CORS ou erreur):', err.message);
          }
        };
        testImg.onerror = () => {
          setLogoImageUrl(dataUrl);
          setLogoHasTransparency(null);
          console.warn('[ExportWindow] ⚠️ Erreur chargement image de test pour transparence');
        };
        testImg.src = dataUrl;
      }
    };
    reader.onerror = () => {
      alert('❌ Erreur lors de la lecture du fichier');
    };
    reader.readAsDataURL(file);
  }, []);

  /**
   * Ouvre la boîte de dialogue de sélection de fichier
   */
  const handleOpenLogoFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Supprime le logo sélectionné
   */
  const handleClearLogo = useCallback(() => {
    setLogoImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * Capture pixel-perfect du canvas: cache les icônes d'édition avant capture,
   * calcule une échelle basée sur la taille de feuille et DPI d'impression,
   * puis restaure les éléments.
   * @param {HTMLElement} captureElement - élément DOM à capturer
   * @param {Object} paperDims - {width (mm), height (mm)}
   * @param {string} format - format d'export (PNG/JPEG/PDF/SVG)
   * @returns {string} dataUrl PNG
   */
  const captureCanvasPixelPerfect = async (captureElement, paperDims, format) => {
    if (!captureElement) throw new Error('captureElement manquant');

    // Collecter et masquer les éléments à cacher (boutons d'édition, menus, etc.)
    const hiddenElements = [];
    
    // Cache les boutons à l'intérieur des blocs (couleur + suppression)
    const allButtons = captureElement.querySelectorAll('button');
    allButtons.forEach(btn => {
      const computed = window.getComputedStyle(btn);
      // Masquer les boutons qui sont positionnés en absolu dans les blocs (top: 2px, right: ...)
      if (computed.position === 'absolute' && (computed.right === '2px' || computed.right === '24px')) {
        hiddenElements.push({ el: btn, originalDisplay: btn.style.display, originalVisibility: btn.style.visibility });
        btn.style.visibility = 'hidden';
        btn.style.display = 'none';
      }
    });

    // Cache aussi les menus de couleur
    const colorMenus = captureElement.querySelectorAll('[style*="backgroundColor"][style*="position"][style*="fixed"]');
    colorMenus.forEach(menu => {
      if (window.getComputedStyle(menu).position === 'fixed') {
        hiddenElements.push({ el: menu, originalDisplay: menu.style.display, originalVisibility: menu.style.visibility });
        menu.style.visibility = 'hidden';
        menu.style.display = 'none';
      }
    });

    try {
      // Déterminer DPI cible pour qualité d'impression (utiliser EXPORT_DPI pour consistance)
      const TARGET_DPI = EXPORT_DPI;
      const pxPerMm = TARGET_DPI / 25.4;
      const targetWidthPx = Math.round(paperDims.width * pxPerMm);
      const targetHeightPx = Math.round(paperDims.height * pxPerMm);

      // Élément rendu taille
      const rect = captureElement.getBoundingClientRect();
      const elementWidth = Math.max(1, Math.round(rect.width));
      const elementHeight = Math.max(1, Math.round(rect.height));

      // scale pour html2canvas: viser la taille cible
      // éviter des scales déraisonnables
      const scaleX = targetWidthPx / elementWidth;
      const scaleY = targetHeightPx / elementHeight;
      const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 1), 4); // clamp 1..4

      console.log('[ExportWindow] 🔧 capture params:', { targetWidthPx, targetHeightPx, elementWidth, elementHeight, scale });

      const canvas = await html2canvas(captureElement, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 0,
        windowWidth: Math.max(elementWidth, 1200),
        windowHeight: Math.max(elementHeight, 800)
      });

      // Si la toile a une taille différente de la cible, redimensionner proprement
      if (canvas.width !== targetWidthPx || canvas.height !== targetHeightPx) {
        const off = document.createElement('canvas');
        off.width = targetWidthPx;
        off.height = targetHeightPx;
        const ctx = off.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, off.width, off.height);
        // Centrer l'image capturée
        const dx = Math.round((off.width - canvas.width) / 2);
        const dy = Math.round((off.height - canvas.height) / 2);
        ctx.drawImage(canvas, dx, dy, canvas.width, canvas.height);
        const dataUrl = off.toDataURL('image/png', 0.95);
        return dataUrl;
      }

      return canvas.toDataURL('image/png', 0.95);
    } finally {
      // Restaurer éléments masqués
      hiddenElements.forEach(({ el, originalDisplay, originalVisibility }) => {
        el.style.display = originalDisplay || '';
        el.style.visibility = originalVisibility || '';
      });
    }
  };

  /**
   * Capture le contenu du canvas en image avec haute qualité - basé sur le snapshot
   */
  const captureCanvasScreenshot = async () => {
    // Obtenir le snapshot depuis le canvas
    const snapshot = orgChartCanvasRef?.current?.getLayoutSnapshot?.();
    if (!snapshot) {
      throw new Error('Snapshot du layout non disponible');
    }

    // Valider le snapshot (pas d'accès DOM)
    const validation = SnapshotExportService.validateSnapshot(snapshot);
    if (!validation.valid) {
      throw new Error('Snapshot invalide: ' + validation.errors.join('; '));
    }

    try {
      console.log('[ExportWindow] 📸 Capture de l\'aperçu (ExportPreview - SVG pur sans UI controls)');

      // Capturer UNIQUEMENT l'élément SVG de l'aperçu qui est le rendu pur et contrôlé
      // sans les boutons d'édition du canvas
      const svgElement = previewRef.current?.querySelector('svg');
      if (!svgElement) {
        throw new Error('Élément SVG de l\'aperçu non trouvé');
      }

      // Calculer dimensions cibles (résolution export : EXPORT_DPI 600)
      const pxPerMm = EXPORT_DPI / 25.4;
      const targetWidthPx = Math.max(1, Math.round(paperDimensions.width * pxPerMm));
      const targetHeightPx = Math.max(1, Math.round(paperDimensions.height * pxPerMm));

      // Cloner le SVG et l'adapter à la résolution cible
      const svgClone = svgElement.cloneNode(true);
      svgClone.setAttribute('width', String(targetWidthPx));
      svgClone.setAttribute('height', String(targetHeightPx));
      svgClone.setAttribute('preserveAspectRatio', 'none'); // Utiliser tout l'espace sans ratio figé
      
      // Créer un conteneur temporaire pour rasteriser
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = targetWidthPx + 'px';
      tempContainer.style.height = targetHeightPx + 'px';
      tempContainer.appendChild(svgClone);
      document.body.appendChild(tempContainer);

      try {
        // Première tentative: rasteriser directement le SVG cloné en image via un Blob URL.
        // Cette méthode préserve généralement la transparence et évite les artefacts html2canvas.
        try {
          const serializer = new XMLSerializer();
          const svgString = serializer.serializeToString(svgClone);
          const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);

          const img = new Image();
          img.crossOrigin = 'anonymous';

          const capturedCanvas = await new Promise((resolve, reject) => {
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = targetWidthPx;
                canvas.height = targetHeightPx;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }
                URL.revokeObjectURL(url);
                resolve(canvas);
              } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
              }
            };
            img.onerror = (e) => {
              URL.revokeObjectURL(url);
              reject(new Error('Erreur chargement image SVG: ' + (e?.message || 'unknown')));
            };
            img.src = url;
          });

          // Retourner le dataURL depuis la canvas capturée
          const finalCanvas = capturedCanvas;
          const mime = format === 'JPEG' ? 'image/jpeg' : 'image/png';
          const dataUrl = finalCanvas.toDataURL(mime, 1.0);
          console.log('[ExportWindow] ✅ Aperçu capturé via SVG->Image:', dataUrl.length, 'bytes');
          return dataUrl;
        } catch (svgErr) {
          console.warn('[ExportWindow] ⚠️ Rasterisation SVG->Image a échoué, fallback html2canvas:', svgErr.message);

          // Fallback: utiliser html2canvas (conservons le fond blanc pour compatibilité)
          const scaleFactor = 2; // 2x supersampling
          const capturedCanvas = await html2canvas(tempContainer, {
            backgroundColor: '#ffffff',
            scale: scaleFactor,
            useCORS: true,
            allowTaint: true,
            logging: false,
            imageTimeout: 0,
            width: targetWidthPx,
            height: targetHeightPx,
            letterRendering: true,
            foreignObjectRendering: true,
            removeContainer: true,
            onclone: (clonedDoc) => {
              const svg = clonedDoc.querySelector('svg');
              if (svg) {
                svg.style.backgroundColor = 'white';
                svg.style.visibility = 'visible';
                svg.style.opacity = '1';
              }
              const container = clonedDoc.querySelector('div');
              if (container) {
                container.style.backgroundColor = 'white';
                container.style.visibility = 'visible';
              }
              const images = clonedDoc.querySelectorAll('image');
              images.forEach(img => {
                img.style.visibility = 'visible';
                img.style.opacity = '1';
              });
            }
          });

          // Downscale to target dimensions
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = targetWidthPx;
          finalCanvas.height = targetHeightPx;
          const fctx = finalCanvas.getContext('2d');
          if (fctx) {
            fctx.imageSmoothingEnabled = true;
            try { fctx.imageSmoothingQuality = 'high'; } catch (e) {}
            fctx.filter = 'none';
            fctx.drawImage(capturedCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
          }

          const mime = format === 'JPEG' ? 'image/jpeg' : 'image/png';
          const dataUrl = finalCanvas.toDataURL(mime, 1.0);
          console.log('[ExportWindow] ✅ Aperçu capturé via html2canvas fallback:', dataUrl.length, 'bytes');
          return dataUrl;
        }
      } finally {
        try { document.body.removeChild(tempContainer); } catch (e) {}
      }
    } catch (err) {
      console.error('[ExportWindow] ❌ Erreur capture:', err);
      throw err;
    }
  };

  /**
   * Sélectionner le dossier d'export
   */
  const handleSelectFolder = async () => {
    try {
      if (!window.electronAPI?.selectFolder) {
        console.warn('selectFolder non disponible');
        return;
      }

      const result = await window.electronAPI.selectFolder();
      if (result && result.filePaths && result.filePaths.length > 0) {
        setExportFolder(result.filePaths[0]);
      }
    } catch (err) {
      console.error('[ExportWindow] Erreur sélection dossier:', err);
    }
  };

  const handleExport = async () => {
    if (!fileName.trim()) {
      alert('❌ Veuillez entrer un nom de fichier');
      return;
    }

    setIsExporting(true);

    try {
      console.log('[ExportWindow] 📤 Capture du canvas...');
      
      // Capturer le contenu du canvas
      const canvasDataUrl = await captureCanvasScreenshot();
      
      console.log('[ExportWindow] ✅ Canvas capturé, taille:', canvasDataUrl.length);

      // Appeler le callback avec les options et le canvas
      await onExport({
        format,
        orientation,
        paperFormat,
        fileName,
        canvasDataUrl,
        exportFolder: exportFolder || null
      });

      console.log('[ExportWindow] ✅ Export terminé');
      setIsExporting(false);
      onClose();
    } catch (err) {
      console.error('[ExportWindow] ❌ Erreur export:', err);
      alert('❌ Erreur lors de l\'export: ' + err.message);
      setIsExporting(false);
    }
  };

  const getExtension = () => {
    switch (format) {
      case 'PNG': return '.png';
      case 'JPEG': return '.jpg';
      case 'SVG': return '.svg';
      case 'PDF': return '.pdf';
      default: return '.png';
    }
  };

  if (!isOpen) return null;

  console.log('[ExportWindow] 🎯 RENDER TIME - exportSnapshot state:', {
    exists: !!exportSnapshot,
    hasPositions: !!exportSnapshot?.positions,
    positionsSize: exportSnapshot?.positions?.size,
    hasConnections: !!exportSnapshot?.connections,
    connectionsLength: exportSnapshot?.connections?.length,
    connectionsIsArray: Array.isArray(exportSnapshot?.connections),
    firstConn: exportSnapshot?.connections?.[0]
  });

  return (
    <div className="export-window-overlay">
      <div className="export-window">
        <div className="export-header">
          <h2>Exporter l'organigramme</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="export-content">
          {/* Aperçu amélioré */}
          <div className="export-preview-section">
            <h3>Aperçu du rendu d'export 👁️</h3>
            <div className="export-preview" ref={previewRef} style={{ position: 'relative', width: '100%', height: '500px', backgroundColor: '#f0f0f0', overflow: 'auto' }}>
              {(() => {
                console.log('[ExportWindow] 📋 ABOUT TO RENDER ExportPreview with:', {
                  hasSnapshot: !!exportSnapshot,
                  connectionsLength: exportSnapshot?.connections?.length,
                  positionsSize: exportSnapshot?.positions?.size
                });
                return (
                  <ExportPreview
                    exportSnapshot={exportSnapshot}
                    orientation={orientation}
                    pageWidth={paperDimensions.width}
                    pageHeight={paperDimensions.height}
                    paperFormat={paperFormat}
                    allContacts={allContacts}
                    displayFields={displayFields}
                    blocks={blocks}
                    linkColorSource={orgChartCanvasRef?.current?.getLinkColorSource ? orgChartCanvasRef.current.getLinkColorSource() : {}}
                    logoImageUrl={logoImageUrl}
                    logoPosition={logoPosition}
                  />
                );
              })()}
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Cet aperçu montre comment l'organigramme sera rendu sur la taille de feuille sélectionnée.
              Le zoom se recalcule automatiquement pour adapter le contenu à la page.
            </p>
            
            {/* Zone de logs pour debugging */}
            <div style={{
              marginTop: '12px',
              padding: '8px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '11px',
              maxHeight: '300px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              color: '#333'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#0A4866' }}>📋 Logs:</div>
              {debugLogs.length === 0 ? (
                <div style={{ color: '#999' }}>En attente de logs...</div>
              ) : (
                debugLogs.map((log, idx) => (
                  <div key={idx} style={{ color: log.includes('❌') ? '#d32f2f' : log.includes('✅') ? '#388e3c' : '#666', marginBottom: '2px' }}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Options */}
          <div className="export-options">
            {/* Format */}
            <div className="option-group">
              <label>Format de sortie</label>
              <div className="option-buttons">
                {['PNG', 'JPEG', 'SVG', 'PDF'].map(fmt => (
                  <button
                    key={fmt}
                    className={`option-btn ${format === fmt ? 'active' : ''}`}
                    onClick={() => setFormat(fmt)}
                    disabled={isExporting}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Orientation */}
            <div className="option-group">
              <label>Orientation</label>
              <div className="option-buttons">
                <button
                  className={`option-btn ${orientation === 'portrait' ? 'active' : ''}`}
                  onClick={() => setOrientation('portrait')}
                  disabled={isExporting}
                >
                  Portrait
                </button>
                <button
                  className={`option-btn ${orientation === 'landscape' ? 'active' : ''}`}
                  onClick={() => setOrientation('landscape')}
                  disabled={isExporting}
                >
                  Paysage
                </button>
              </div>
            </div>

            {/* Format de papier */}
            <div className="option-group">
              <label>Format de feuille</label>
              <div className="option-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(PAPER_FORMATS).map(([key, value]) => (
                  <button
                    key={key}
                    className={`option-btn ${paperFormat === key ? 'active' : ''}`}
                    onClick={() => setPaperFormat(key)}
                    disabled={isExporting}
                    style={{ flex: '1 0 auto', minWidth: '60px' }}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nom du fichier */}
            <div className="option-group">
              <label>Nom du fichier</label>
              <div className="filename-input-group">
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Nom du fichier"
                  disabled={isExporting}
                  className="filename-input"
                />
                <span className="file-extension">{getExtension()}</span>
              </div>
            </div>

            {/* Dossier d'export */}
            <div className="option-group">
              <label>Dossier d'export</label>
              <div className="folder-selector">
                <input
                  type="text"
                  value={exportFolder || 'Téléchargements (défaut)'}
                  disabled={true}
                  className="folder-input"
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleSelectFolder}
                  disabled={isExporting}
                  style={{ marginLeft: '8px' }}
                >
                  📁 Parcourir
                </button>
              </div>
              <p className="help-text">
                Défaut: {exportFolder ? exportFolder : 'Dossier Téléchargements'}
              </p>
            </div>

            {/* Logo */}
            <div className="option-group">
              <label>Logo (optionnel)</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleOpenLogoFilePicker}
                  disabled={isExporting}
                >
                  📂 Sélectionner logo
                </button>
                {logoImageUrl && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleClearLogo}
                    disabled={isExporting}
                    style={{ backgroundColor: '#dc3545', color: '#fff' }}
                  >
                    ✕ Supprimer
                  </button>
                )}
              </div>
              {logoImageUrl && (
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>✅ Logo chargé</p>
                  {logoHasTransparency === true && (
                    <p style={{ fontSize: '12px', color: '#2b8a3e', marginTop: '4px' }}>✅ Transparence détectée (PNG avec alpha)</p>
                  )}
                  {logoHasTransparency === false && (
                    <p style={{ fontSize: '12px', color: '#b35b00', marginTop: '4px' }}>⚠️ Pas de transparence détectée — le fond est opaque</p>
                  )}
                  {logoHasTransparency === null && (
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>ℹ️ Statut transparence: non testé / bloqué par CORS</p>
                  )}
                  <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Position du logo</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { value: 'top-left', label: '↖️ Haut gauche' },
                      { value: 'top-right', label: '↗️ Haut droit' },
                      { value: 'bottom-left', label: '↙️ Bas gauche' },
                      { value: 'bottom-right', label: '↘️ Bas droit' }
                    ].map(pos => (
                      <label key={pos.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="logoPosition"
                          value={pos.value}
                          checked={logoPosition === pos.value}
                          onChange={(e) => setLogoPosition(e.target.value)}
                          disabled={isExporting}
                        />
                        {pos.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>

        <div className="export-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isExporting}
          >
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting || !fileName.trim()}
          >
            {isExporting ? '⏳ Export...' : '📥 Exporter'}
          </button>
        </div>
      </div>
    </div>
  );
}

ExportWindow.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedOrgChart: PropTypes.object,
  orgChartCanvasRef: PropTypes.object,
  onExport: PropTypes.func.isRequired
};

export default ExportWindow;
