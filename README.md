# Investment Dashboard

## Lot 2 — Data Foundation

The data foundation is now implemented behind the existing dark UI:

- server-only FMP adapter through `MarketDataProvider`;
- normalized market models with provenance and cache TTLs;
- Supabase migration with RLS, authenticated portfolio/watchlist data and server-only asset upserts;
- weighted-average portfolio calculations, SELL handling, EUR/USD/CHF/GBP conversion and ECB daily FX;
- global asset search, asset pages, watchlist persistence, transactions, dashboard values and deterministic insights.

Copy `.env.example` to `.env.local`, apply the migration in `supabase/migrations/`, and configure the required variables before expecting real provider data. No financial values are bundled in the application.

Base technique d’une application de suivi et d’analyse d’investissements.

## Stack prévue

- Next.js et React
- TypeScript
- Tailwind CSS
- Supabase / PostgreSQL (à intégrer lors d’une prochaine étape)

## Démarrage local

```bash
npm install
npm run dev
```

L’application sera disponible sur [http://localhost:3000](http://localhost:3000).

## Vérifications

```bash
npm run lint
npm run build
```

## Documentation

Le dossier [`docs/`](./docs) centralise l’architecture, les choix techniques, le modèle de données, la roadmap et les décisions importantes du projet.

Cette première tranche contient le shell dark responsive, les routes principales, les états vides honnêtes et les fonctions TypeScript de calcul du coût moyen pondéré. Les données financières réelles, Supabase, les fournisseurs de marché et la persistance seront ajoutés dans les prochaines étapes.
