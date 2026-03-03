/**
 * LayoutSnapshotService
 * 
 * Capture et gère un snapshot stable du layout de l'organigramme.
 * Cet objet est la source unique de vérité pour :
 * - Le recentrage (molette, actualiser)
 * - L'export (indépendant du DOM)
 * - L'aperçu (snapshot figé)
 * 
 * Découple complètement la logique de layout du DOM et du cycle de vie React.
 */

export class LayoutSnapshot {
  constructor(layoutResult, canvasDimensions, exportDimensions = null, positioning = 'center') {
    // État du layout calculé
    this.positions = layoutResult.positions; // Map<contactId, {x, y}>
    this.connections = layoutResult.connections;
    this.viewport = layoutResult.viewport; // {x, y, width, height}
    
    // Dimensions du canvas visible (par défaut)
    this.canvasWidth = canvasDimensions.width;
    this.canvasHeight = canvasDimensions.height;
    
    // Mode export: si dimensions de papier fournies, utiliser celles-ci pour centrage
    // Cela permet de calculer un zoom adapté au format de papier
    this.exportMode = exportDimensions !== null;
    if (this.exportMode) {
      this.canvasWidth = exportDimensions.width;
      this.canvasHeight = exportDimensions.height;
    }
    
    // Positionnement horizontal (pour export): 'left', 'center', 'right'
    this.positioning = positioning;
    
    // Calcul des valeurs de centrage (source unique de vérité)
    this.centeringValues = this._calculateCenteringValues();
  }

  /**
   * Calcule les valeurs de centrage + zoom adaptatif
   * Logique : tout rentre dans le canvas disponible, centré
   * 
   * @returns {Object} {zoom: calculé, panX: centré, panY: centré}
   */
  _calculateCenteringValues() {
    const viewport = this.viewport;
    
    // Si pas de contenu, retourner des valeurs par défaut
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
      return { zoom: 1, panX: 0, panY: 0 };
    }

    // Dimensions disponibles (zone de dessin ou papier d'export)
    const availableWidth = this.canvasWidth;
    const availableHeight = this.canvasHeight;
    
    // Dimensions brutes de l'organigramme
    const contentWidth = viewport.width;
    const contentHeight = viewport.height;

    // ==========================================
    // 1. CALCUL DU ZOOM - FIT-TO-VIEW ADAPTATIF
    // ==========================================
    // Laisser une petite marge (5%) pour que ça ne touche pas les bords
    const margin = 0.95;

    // Calculer les zooms pour chaque axe
    const zoomX = (availableWidth * margin) / contentWidth;
    const zoomY = (availableHeight * margin) / contentHeight;

    // Utiliser le plus petit pour que l'organigramme rentre entièrement
    // Pour l'export (exportMode=true), autoriser le zoom > 1 pour remplir la page
    // Pour l'affichage normal dans le canvas, limiter à 1 pour éviter zoomer au-delà
    const zoom = this.exportMode ? Math.min(zoomX, zoomY) : Math.min(zoomX, zoomY, 1.0);

    // ==========================================
    // 2. CALCUL DU CENTRAGE VERTICAL - AU ZOOM CALCULÉ
    // ==========================================
    // Après zoom, quel est l'espace utilisé?
    const scaledHeight = contentHeight * zoom;
    
    // Espace vertical disponible après zoom
    const availableSpaceY = availableHeight - scaledHeight;
    
    // Centrer verticalement: placer le contenu à (availableSpaceY / 2) du haut
    // Mais viewport.y décale l'origine visuelle du contenu
    const panY = (availableSpaceY / 2) - (viewport.y * zoom);

    // ==========================================
    // 3. CALCUL DU CENTRAGE HORIZONTAL - AU ZOOM CALCULÉ
    // ==========================================
    // Après zoom, quel est l'espace utilisé?
    const scaledWidth = contentWidth * zoom;
    
    // Espace horizontal disponible après zoom
    const availableSpaceX = availableWidth - scaledWidth;
    
    // Positionnement horizontal (left/center/right)
    let offsetX = 0; // Par défaut (center)
    
    if (this.positioning === 'left') {
      offsetX = 0;
    } else if (this.positioning === 'center') {
      offsetX = availableSpaceX / 2;
    } else if (this.positioning === 'right') {
      offsetX = availableSpaceX;
    }
    
    // Appliquer le pan avec le zoom calculé
    const panX = offsetX - (viewport.x * zoom);
    
    return { zoom, panX, panY };
  }

  /**
   * Obtenir les valeurs de centrage unifiées
   * Utilisé par : clic molette, bouton actualiser, export
   * 
   * @returns {Object} {zoom: calculé adaptatif, panX, panY}
   */
  getCenteringValues() {
    return { ...this.centeringValues };
  }

  /**
   * Exporter les données de layout pour l'export (sans dépendre du DOM)
   * 
   * @returns {Object} snapshot complet et stable
   */
  exportData() {
    return {
      positions: this.positions,
      connections: this.connections,
      viewport: this.viewport,
      canvasDimensions: {
        width: this.canvasWidth,
        height: this.canvasHeight
      },
      centeringValues: this.centeringValues
    };
  }
}

/**
 * Service d'export utilisant le snapshot
 * Complètement découplé du DOM et de React
 */
export class SnapshotExportService {
  /**
   * Valider qu'un snapshot est valide avant export
   * @param {LayoutSnapshot} snapshot - Snapshot à valider
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  static validateSnapshot(snapshot) {
    const errors = [];
    
    // Vérifications basiques
    if (!snapshot || typeof snapshot !== 'object') {
      errors.push('Snapshot invalide ou non défini');
      return { valid: false, errors };
    }
    
    // Vérifier que les données essentielles existent
    if (!snapshot.positions) {
      errors.push('Positions manquantes');
    } else if (!(snapshot.positions instanceof Map) || snapshot.positions.size === 0) {
      errors.push('Positions vides (Map)');
    }
    
    if (!snapshot.viewport) {
      errors.push('Viewport manquant');
    } else {
      if (typeof snapshot.viewport.width !== 'number' || snapshot.viewport.width <= 0) {
        errors.push('Viewport: width invalide');
      }
      if (typeof snapshot.viewport.height !== 'number' || snapshot.viewport.height <= 0) {
        errors.push('Viewport: height invalide');
      }
    }
    
    if (typeof snapshot.canvasWidth !== 'number' || snapshot.canvasWidth <= 0) {
      errors.push('Canvas width invalide');
    }
    if (typeof snapshot.canvasHeight !== 'number' || snapshot.canvasHeight <= 0) {
      errors.push('Canvas height invalide');
    }
    
    if (!snapshot.centeringValues || snapshot.centeringValues.zoom === undefined) {
      errors.push('Centring values manquantes');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Préparer les données d'export (sans aucune dépendance DOM)
   * @param {LayoutSnapshot} snapshot - Snapshot validé
   * @param {Object} options - Options d'export
   * @returns {Object} Données complètes pour l'export
   */
  static prepareExportData(snapshot, options = {}) {
    const validation = this.validateSnapshot(snapshot);
    if (!validation.valid) {
      throw new Error('Snapshot invalide: ' + validation.errors.join('; '));
    }

    return {
      layout: snapshot.exportData(),
      options: {
        format: options.format || 'PNG',
        orientation: options.orientation || 'landscape',
        positioning: options.positioning || 'center',
        fileName: options.fileName || 'organigramme'
      },
      timestamp: new Date().toISOString()
    };
  }
}
