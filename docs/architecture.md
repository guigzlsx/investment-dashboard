# Architecture

## État initial

Le projet est initialisé avec Next.js, React, TypeScript, Tailwind CSS et l’App Router.

```text
investment-dashboard/
├── public/                 # ressources statiques
├── src/                    # code applicatif
│   └── app/                # routes et layout Next.js
├── docs/                   # documentation de conception
├── package.json            # scripts et dépendances
└── configuration Next.js  # TypeScript, ESLint, PostCSS
```

## Cible à préciser

- Interface utilisateur rendue par Next.js ;
- composants réutilisables organisés dans `src/` ;
- accès aux données via Supabase ;
- PostgreSQL comme base de persistance ;
- variables de configuration locales fournies via `.env.local` et documentées dans un futur `.env.example`.

Les frontières entre composants serveur, composants client et couche d’accès aux données seront précisées avant le développement des fonctionnalités métier.
