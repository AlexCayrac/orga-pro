# Test d'Aperçu Export - Guide Utilisateur

## 🎯 Objectif
Vérifier que l'aperçu d'export affiche maintenant:
- ✅ Les connexions entre les blocs
- ✅ Les détails de contact (position, age, email, etc.)
- ✅ Les blocs avec les bonnes tailles et positions

## 📋 Étapes de Test

### Étape 1: Ouvrir l'Organigramme Existant
1. L'app Electron est déjà en cours d'exécution
2. Vous devriez voir 2 organigrammes existants (según les données)
3. **Cliquez sur un organigramme** (la deuxième image que vous m'avez montrée)
   - Celui avec Noel Barjon en haut
   - Cédric Boyer et Manuel Culebras dessous
   - René-Marc Muniente au bas

### Étape 2: Vérifier le Canvas Principal
**Avant d'ouvrir l'Export, assurez-vous que:**
- ✓ Les blocs sont visibles avec les bonnes couleurs
- ✓ Les connexions relient les blocs (liens verticaux)
- ✓ Les détails s'affichent (position, téléphone, email, etc.)
- ✓ Les icônes de suppression (X) et couleur sont visibles sur les blocs

### Étape 3: Ouvrir le Dialogue Export
1. **File → Export** (ou le bouton Export dans le menu)
2. Une fenêtre devrait s'ouvrir avec:
   - Un espace gris pour l'aperçu (à gauche)
   - Des options d'export (format, orientation, taille, etc.)

### Étape 4: Ouvrir DevTools
1. Appuyez sur **F12**
2. Allez à **Console**
3. **Cherchez les logs contenant:**
   - `[ExportWindow]`
   - `[ExportPreview]`

### Étape 5: Vérifier l'Aperçu

#### ✅ Si l'aperçu ressemble à cela, c'est CORRECT:
- Les 4 blocs sont visibles
- Ils ont les bonnes couleurs (bleu pour Noel/Manuel/René, vert pour Cédric)
- Les connexions relient les blocs
- Les noms s'affichent (Noel Barjon, Cédric Boyer, etc.)
- Certains détails s'affichent (position, âge, etc.)

#### ❌ Si l'aperçu est blanc ou pareil qu'avant:
- Exception: toujours blanc/vide

#### 📊 Logs Attendus

**Dans la console, vous devriez voir:**

```
[ExportWindow] 🟢 Dialog ouverte - Démarrage du polling
[ExportWindow] 📍 Polling immédiat #1
[ExportWindow] 🔍 Poll #1: {
  mainSnapshotExists: true,
  positionsSize: 4,              ← Nombre de blocs
  connectionsLength: 3           ← Nombre de connexions
}
[ExportWindow] 📍 Positions du snapshot: noel: (400, 100), cedric: (200, 300), ...
[ExportWindow] ✅ Export snapshot créé avec 4 positions
[ExportPreview] 🔍 effectiveSnapshot useMemo: {
  exportSnapshotExists: true,
  positionsSize: 4,
  blocksCount: 4,
  contactsCount: 10
}
[ExportPreview] ✅ Snapshot fourni valide avec 4 positions
```

**Important:** Si vous voyez `positionsSize: 0`, c'est le problème!

## 🔍 Informations à Collecter

Si l'aperçu **ne montre toujours rien**, copiez-collez:

1. **Tous les logs** contenant `[ExportWindow]` ou `[ExportPreview]`
2. **Un screenshot** du:
   - Canvas principal (pour voir l'organigramme attendu)
   - Aperçu export (pour voir ce qui s'affiche)
   - Console F12 (pour voir les logs)

3. **La réponse à ces questions:**
   - L'organigramme s'affiche-t-il correctement dans le canvas principal?
   - Y a-t-il des erreurs rouges dans la console?
   - Le log `[ExportWindow] 🔍 Poll #1:` montre-t-il `positionsSize: 4` (ou le bon nombre)?

## 📝 Code Modifié

Les fichiers suivants ont été corrigés:

### 1. **ExportWindow.jsx** ✅
- Suppression de la capture PNG inutile
- Amélioration du polling avec logs détaillés
- Meilleure gestion des fallbacks

### 2. **ExportPreview.jsx** ✅
- ✅ Affichage de TOUS les champs (position, age, email, phone, address)
- ✅ Dynamique `blockLines` au lieu de limité à 3 champs
- ✅ Blocs redimensionnés automatiquement selon le contenu
- ✅ Connexions affichées avec meilleur logging
- ❌ Quelques warnings ESLint (variables inutilisées) - non bloquants

## 🆘 Troubleshooting

### L'aperçu est toujours blanc?

**Vérifiez dans la console:**

```javascript
// Copier-coller dans la console F12:
const svg = document.querySelector('svg[viewBox]');
if (svg) {
  console.log('SVG trouvé');
  console.log('Nombre de g (groupe):', svg.querySelectorAll('g').length);
  console.log('Nombre de rect (blocs):', svg.querySelectorAll('rect').length);
  console.log('Nombre de path (connexions):', svg.querySelectorAll('path').length);
  console.log('Nombre de text (texte):', svg.querySelectorAll('text').length);
} else {
  console.log('SVG non trouvé!');
}
```

**Si cela montre:**
- `rect: 0` → Les blocs ne se rendent pas
- `path: 0` → Les connexions ne se rendent pas
- `text: 0` → Le texte ne se rend pas

**Solution:** Le snapshot ne contient pas de données

### Les blocs n'ont pas les bonnes tailles?

**Le problème peut être:**
1. Les tailles dans le snapshot ne correspondent pas aux vraies tailles de blocs
2. Le calcul du centrage est incorrect

**À vérifier dans la console:**
```javascript
// Voir la structure du snapshot
console.log('Snapshot:', window.__DEBUG_SNAPSHOT__);
// (devrait être ajouté en dev)
```

## ⚡ Prochaines Étapes

1. **Testez maintenant** avec les données affichées
2. **Partagez:**
   - Screenshot de l'aperçu
   - Les logs console (copier-coller tout)
   - La réponse aux questions ci-dessus
3. Je ferai les corrections finales

## 📞 Support

Logs à partager si ça ne marche pas (copy-paste de tout ce qui commence par `[`):
```
[ExportWindow] ...
[ExportPreview] ...
[CANVAS] ...
[LAYOUT-ENGINE] ...
```

---

**Dernière compilation:** Ajouter les logs de centrage pour mieux voir le calcul
