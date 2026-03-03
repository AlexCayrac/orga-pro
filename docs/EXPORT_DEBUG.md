# Vérification du Problème d'Aperçu Export

## Vue d'ensemble
L'aperçu de l'export montre une page blanche alors qu'il devrait afficher l'organigramme du canvas.

## Corrections Apportées

### 1. **Suppression de la capture PNG inutile**
- ❌ **Ancien:** `generatePreview()` essayait de capturer une image PNG du DOM
- ✅ **Nouveau:** ExportPreview rend directement les données du snapshot en SVG

### 2. **Amélioration du Polling**
- ✅ Ajout de logs détaillés pour voir les positions du snapshot
- ✅ Meilleure gestion des fallbacks si createExportSnapshot échoue

### 3. **Amélioration du Logging ExportPreview**
- ✅ Logs pour voir si exportSnapshot est reçu
- ✅ Logs pour voir si effectiveSnapshot a du contenu
- ✅ Logs pour voir les blocs et contacts disponibles

## Checklist de Diagnostic

### Étape 1: Lancer l'app
```
npm run dev
```
L'app devrait ouvrir automatiquement après ~10 secondes

### Étape 2: Charger/Créer un organigramme
1. Cliquez sur "Create Organization" ou charger une existante
2. Ajoutez au moins **3-5 blocs** avec des contacts valides
3. Vous devez voir l'organigramme dans le canvas principal

### Étape 3: Ouvrir l'Export
1. Cliquez sur **File → Export** (ou le bouton Export)
2. La fenêtre d'export devrait s'ouvrir
3. Vous devrez voir un espace gris pour l'aperçu (mais probablement vide pour l'instant)

### Étape 4: Ouvrir DevTools et regarder les Logs
1. Appuyez sur **F12** pour ouvrir DevTools
2. Allez à l'onglet **Console**
3. **Cherchez les logs `[ExportWindow]` et `[ExportPreview]`**

### Étape 5: Analyser les Logs

#### Logs Attendus - ExportWindow
```
[ExportWindow] 🟢 Dialog ouverte - Démarrage du polling
[ExportWindow] 📍 Polling immédiat #1
[ExportWindow] 🔍 Poll #1: {
  mainSnapshotExists: true,
  positionsExists: true,
  positionsSize: 3,        // Devrait être > 0
  connectionsLength: 2     // Devrait être >= 0
}
[ExportWindow] 📍 Positions du snapshot: contact-1: (400, 100), ...
[ExportWindow] ✅ Export snapshot créé avec 3 positions
```

#### Logs Attendus - ExportPreview
```
[ExportPreview] 🔍 effectiveSnapshot useMemo: {
  exportSnapshotExists: true,
  positionsSize: 3,         // Devrait être > 0
  blocksCount: 3,           // Devrait être > 0
  contactsCount: 10         // Ou votre nombre de contacts
}
[ExportPreview] ✅ Snapshot fourni valide avec 3 positions
```

## ⚠️ Problèmes Possibles et Solutions

### Problème 1: `positionsSize: 0`
**Cause:** Le snapshot ou le canvas n'a pas de positions calculées
**Vérifier:**
1. Le canvas affiche-t-il des blocs dans la fenêtre principale?
2. Les blocs sont-ils associés à des contacts valides?
3. `layoutResult` dans OrgChartCanvas.jsx a des positions?

**Solution:**
- Assurez-vous d'avoir ajouté des contacts à l'organigramme
- Cliquez sur "Recentrer" dans le canvas pour recalculer le layout

### Problème 2: `mainSnapshotExists: false`
**Cause:** `getLayoutSnapshot()` retourne null ou undefined
**Vérifier:**
1. OrgChartCanvas a-t-il un snapshot?
2. Le `useImperativeHandle` expose-t-il correctement `getLayoutSnapshot`?

**Solution:**
- Rechargez l'app complètement (F5)
- Attendez que le layout se calcule (quelques secondes)

### Problème 3: `positionsSize: 3` mais l'aperçu est blanc
**Cause:** ExportPreview rend le SVG mais les blocs ne sont pas visibles
**Vérifier:**
1. Les connexions sont-elles présentes?
2. Les blocs ont-ils les bonnes positions?
3. Y a-t-il un problème de transform SVG?

**Solution dans la console:**
```javascript
// Vérifier ce que reçoit ExportPreview
const el = document.querySelector('svg[viewBox]');
if (el) {
  console.log('SVG trouvé:', el);
  console.log('Nombre de g:', el.querySelectorAll('g').length);
  console.log('Nombre de rect:', el.querySelectorAll('rect').length);
}
```

## Données à Collecter

Si l'aperçu ne s'affiche toujours pas correctement, copie-colle dans un rappo**tous les logs de la console** contenant:
- `[ExportWindow]`
- `[ExportPreview]`
- Tout message d'erreur

## Code Modifié

### ExportWindow.jsx
- ✅ Suppression du `useState previewUrl`
- ✅ Suppression de la fonction `generatePreview()` 
- ✅ Amélioration du polling avec logs détaillés
- ✅ Meilleure gestion des fallbacks

### ExportPreview.jsx
- ✅ Ajout de logs pour déboguer le rendu
- ✅ Vérification des positions reçues
- ✅ Vérification des blocs et contacts

## Prochaines Étapes

1. **Tester immédiatement** après le démarrage de l'app
2. **Copier les logs complets** de la console
3. **Signaler le problème exact** avec:
   - Screenshot de l'aperçu
   - Screenshot des logs console
   - Description de ce que vous voyez vs ce que vous attendiez

## Questions à se Poser

- ✓ L'organigramme s'affiche-t-il correctement dans le canvas principal?
- ✓ Y a-t-il des erreurs rouges dans la console déjà avant d'ouvrir Export?
- ✓ Les logs `[ExportWindow] 🟢 Dialog ouverte` apparaissent-ils?
- ✓ `positionsSize` est-il > 0?
- ✓ Y a-t-il des logs `✅` (succès) ou seulement `⚠️` (avertissements)?

---

**Testé avec:**
- React 18.2.0
- html2canvas 1.4.1
- Electron 27.0.0
- Node.js (latest)

