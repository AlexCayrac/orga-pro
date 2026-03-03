# Plan de test : ID Remapping lors d'Accept Updates

## Problème résolu
Les contacts importés la première fois recevaient des IDs basés sur timestamp (ex: `contact_1770935167795_0`). Après une mise à jour Excel avec "Accept Updates", les nouveaux contacts recevaient des IDs stables (ex: `contact_011`), causant l'orphanaison des blocs dans les organigrammes.

## Solution implémentée
La fonction `handleApplyDifferences` dans App.jsx a été modifiée pour :

1. **Réimporter les NEW contacts du fichier Excel** pour obtenir les IDs stables générés par excelImporter
2. **Créer un mapping** entre les vieux IDs (timestamp-based) et les nouveaux IDs (excelId-based)
3. **Appliquer le remapping** à tous les blocs des organigrammes avant de sauveguarder les changements

## Étapes du test manual

### Prérequis
- Avoir un fichier Excel valide avec au moins 5 contacts (Prénom, Nom, obligatoires + optionnels : ID, Matricule)
- L'application configurée correctement

### Test 1 : Import initial et création d'organigramme
- [ ] Importer le fichier Excel
- [ ] Vérifier que 5+ contacts sont importés
- [ ] Noter les IDs générés (devraient être timestamp-based : `contact_TIMESTAMP_0..N`)
- [ ] Créer un nouvel organigramme
- [ ] Glisser 3 contacts du panneau de gauche vers l'organigramme
- [ ] Sauvegarder l'organigramme

### Test 2 : Modification du fichier Excel
- [ ] Modifier le fichier Excel (ex: ajouter une colonne "ID" avec des valeurs comme "011", "012", etc.)
- [ ] Changer le nom d'un contact existant (ex: "Jean" → "Jean-Pierre")
- [ ] Sauvegarder le fichier Excel

### Test 3 : Check Excel Updates
- [ ] Dans l'app, cliquer "Check Excel Updates" (ou attendre l'auto-check)
- [ ] Vérifier que le dialog "Differences" s'affiche avec les changements détectés
- [ ] Accepter tous les changements

### Test 4 : Vérification du remapping
- [ ] Vérifier les logs console pour voir le mapping ("ID Mapping: contact_TIMESTAMP_X → contact_011")
- [ ] Vérifier que le dialog "Differences" s'est fermé
- [ ] Ouvrir l'organigramme créé
- [ ] **CRITIQUE**: Vérifier qu'AUCUN bloc n'est marqué invalid 
- [ ] Vérifier que les 3 contacts glissés sont toujours visibles et liés correctement

## Vérifications techniques

### Logs attendus dans la console
```
[App] 🔥 APPLY DIFFERENCES - START
[App] 🔄 ÉTAPE 1: Réimport Excel pour créer ID mapping...
[App] ✅ Réimport réussi: X lignes Excel
[App] 📍 ÉTAPE 2: Création du mapping old→new IDs...
[App]    🔗 ID Mapping: contact_TIMESTAMP_0 → contact_011 (Jean Dupont)
[App]    🔗 ID Mapping: contact_TIMESTAMP_1 → contact_012 (Marie Martin)
[App]    ...
[App] ✅ Mapping créé: N mappings
[App] 📝 ÉTAPE 3: Application des modifications...
[App] 🔗 ÉTAPE 4: Remapping des IDs dans les organigrammes...
[App]    ✅ Block block_xxx: contact_TIMESTAMP_0 → contact_011
[App]    ✅ Block block_yyy: contact_TIMESTAMP_1 → contact_012
[App] ✅ N blocs remappés
[App] 🔥 APPLY DIFFERENCES - END
```

### Vérifications dans layoutEngine
- Aucun "bloc invalide" (comme avant le fix: "contactId introuvable")
- Tous les blocs devraient avoir leurs contactId mappés avec succès

## État attendu après le test

- ✅ Organigramme préservé avec tous les contacts
- ✅ Aucun orphan block
- ✅ Les 3 contacts glissés initialement restent visibles et correctement liés
- ✅ Les modifications du fichier Excel (changement de nom) sont reflétées dans les contacts
- ✅ Les logs montrent les mappings créés et appliqués

## Signaux d'alerte

- ❌ Dialog "Differences" qui restevisible longtemps
- ❌ Logs montrant "Impossible de réimporter Excel pour mapping"
- ❌ Blocs marqués invalides dans l'organigramme après l'update
- ❌ Nombre de mappings = 0 alors qu'il devrait y avoir plusieurs
