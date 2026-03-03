# Orga PRO

Application desktop Windows de génération et maintenance d'organigrammes professionnels pour les entreprises et les chantiers.

## Architecture

- **Frontend** : React + CSS
- **Desktop** : Electron
- **Backend** : Node.js
- **Données** : Excel (source de vérité) + JSON (stockage interne)

## Structure du Projet

```
orga-pro/
├── public/           # Electron main process
├── src/
│   ├── components/   # Composants React (UI)
│   ├── pages/        # Pages principales
│   ├── modules/      # Logique métier modulaire
│   ├── models/       # Modèles de données
│   ├── styles/       # Feuilles de style
│   ├── utils/        # Utilitaires
│   └── store/        # Gestion d'état (Context/Reducer)
├── assets/           # Ressources graphiques
├── data/             # Données persistantes
└── tests/            # Tests unitaires et intégration
```

## Modules Principaux

1. **Module Données** - Import/Export Excel, stockage JSON
2. **Module Diff** - Comparaison versions Excel
3. **Module Organigrammes** - Création et gestion des organigrammes
4. **Module Graphiques** - Gestion des ressources (photos, icônes, logos)
5. **Module Rendu** - Rendu graphique (couleurs, typographie, mise en page)
6. **Module Export** - Export en PDF, SVG, PNG, JPEG

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Documentation

Voir le dossier `docs/` pour la documentation complète de l'architecture.
