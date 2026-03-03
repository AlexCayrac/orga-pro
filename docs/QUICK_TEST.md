# Quick Test Guide : Vérifier le fix ID Remapping

## La Solution En Un Nutshell 🎯
- **Avant** : Accept Updates perdait les blocs dans l'organigramme (orphans) 
- **Après** : Les IDs sont automatiquement remappés, l'organigramme est préservé
- **Test** : 2 tests unitaires ✅, prêt pour validation manuelle

## Tester en 5 minutes ⏱️

### Étape 1 : Préparer Excel
1. Créez/modifiez `data/Organigramme_Entreprise.xlsx` avec:
   - Colonne "Prénom" : Jean, Marie, Pierre
   - Colonne "Nom" : Dupont, Martin, Bernard
   - **Nouveau** Colonne "ID" : 011, 012, 013 (ceci force IDs stables)

### Étape 2 : Tester Import Initial
```bash
npm start  # Lancer l'app
```
- Cliquer "Import Excel"
- Vérifier dans console : `Contacts IDs: contact_011, contact_012, contact_013`
- Vérifier dans console : `📸 Nouvelles colonnes` logs

### Étape 3 : Créer Organigramme
- Créer organigramme "Test Update"
- Glisser 2 contacts (ex: Jean Dupont, Marie Martin)
- Sauvegarder

### Étape 4 : Modifier Excel
- Ouvrir `Organigramme_Entreprise.xlsx`
- Changer "Jean" → "Jean-Pierre" (colonne Prénom)
- Ajouter une agence/département (nouvelle colonne)
- Sauvegarder

### Étape 5 : Accept Updates ✅
- App : Click "Check Excel Updates" (ou attendre auto-check)
- Dialog "Differences" s'affiche
- Click "✓ Accept" sur le changement "Jean-Pierre"
- **REGARDER LA CONSOLE** pour:
  ```
  [App] 🔗 ID Mapping: contact_011 → contact_011 (Jean-Pierre Dupont)
  [App] 🔗 ÉTAPE 4: Remapping des IDs...
  [App]    ✅ Block block_XXX: contact_011 → contact_011
  [App] ✅ 2 blocs remappés
  ```

### Étape 6 : Vérifier Résultat ✅
- Dialog "Differences" se ferme
- Alert: "✅ Changements appliqués ✓ Organigrammes et structures préservés ✓ Références de contacts mises à jour"
- Ouvrir l'organigramme "Test Update"
- **CRITIQUE** : Les 2 contacts glissés doivent être visibles et bien liés
- **JAMAIS** de message "bloc invalid" ou "contactId introuvable"

## Signaux de Succès ✅

| Condition | Status |
|-----------|--------|
| L'organigramme ne perd pas ses contacts | ✅ |
| Les logs montrent le mapping | ✅ |
| Aucun erreur "contactId introuvable" | ✅ |
| Prénom changé en "Jean-Pierre" reflété | ✅ |
| Dialog "Differences" se ferme | ✅ |
| Alert "Changements appliqués" apparaît | ✅ |

## Signaux de Problème ❌

- ❌ "❌ [LAYOUT] blocs invalides"
- ❌ Logs vides (pas de ÉTAPE 1, 2, 4)
- ❌ "Impossible de réimporter Excel"
- ❌ Dialog "Differences" reste visible indéfiniment
- ❌ Mapping count = 0

## Autres Tests

### Test Unit (sans UI)
```bash
cd orga-pro
node tests/idMappingTest.js
# Résultat attendu: 2 tests ✅, 0 errors
```

### Build Test
```bash
npm run build
# Résultat attendu: Compiled with warnings (ok, ce sont des vieilles warnings)
```

---

## Questions?

- Cherchez dans console : `[App] 🔄 ÉTAPE 1` ou `[App] 🔗 ID Mapping`
- Vérifiez le fichier `src/components/App.jsx` ligne 736+
- Consultez `SOLUTION_SUMMARY.md` pour la doc complet
