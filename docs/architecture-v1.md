# Architecture applicative v1

## Vue d’ensemble

```text
UI Next.js
   |
   v
Server Components / Route Handlers
   |
   v
Services applicatifs
   |--------------------|
   v                    v
Supabase/PostgreSQL   MarketDataProvider(s)
   |                    |
   v                    v
Calculs portefeuille   Données normalisées + provenance
Moteur de risques      |
   |--------------------|
   v
Investment Assistant en lecture seule
```

## Stack cible

- Next.js App Router et TypeScript ;
- React Server Components pour les lectures initiales ;
- composants client uniquement pour graphiques, recherche, formulaires et interactions ;
- Tailwind CSS pour les tokens visuels ;
- Supabase Auth + PostgreSQL ;
- Recharts ou Lightweight Charts, à choisir lors du premier écran graphique ;
- une couche d’adaptation fournisseur indépendante de l’interface ;
- un modèle de langage appelé uniquement côté serveur.

Next.js Route Handlers sont adaptés à la couche Backend-for-Frontend : ils vivent dans `app`, exposent les méthodes HTTP nécessaires et évitent de placer les clés financières dans le navigateur. Voir la documentation officielle : <https://nextjs.org/docs/app/getting-started/route-handlers>.

## Organisation proposée de `src/`

```text
src/
├── app/
│   ├── (app)/dashboard/
│   ├── (app)/portfolio/
│   ├── (app)/watchlist/
│   ├── (app)/discover/
│   ├── (app)/analysis/
│   ├── (app)/assets/[symbol]/
│   └── api/
├── components/
│   ├── layout/
│   ├── dashboard/
│   ├── portfolio/
│   ├── watchlist/
│   ├── asset/
│   ├── assistant/
│   └── primitives/
├── domain/
│   ├── portfolio/
│   ├── valuation/
│   ├── risk/
│   ├── scenarios/
│   └── insights/
├── lib/
│   ├── db/
│   ├── providers/
│   ├── assistant/
│   ├── validation/
│   └── observability/
└── types/
```

## Responsabilités

### Domaine

Les fonctions de calcul sont pures et testables sans Next.js ni fournisseur externe : position à partir des transactions, prix moyen, P/L réalisé et latent, poids, conversion FX, exposition et scénarios.

### Fournisseurs

Chaque fournisseur implémente des interfaces communes :

```text
MarketDataProvider
├── searchInstruments(query)
├── getQuote(instrument)
├── getHistoricalPrices(instrument, range)
├── getFundamentals(instrument)
├── getEstimates(instrument)
├── getEvents(instrument, range)
└── getNews(instrument, range)
```

Les adaptateurs renvoient un format interne commun et conservent `source`, `source_endpoint`, `fetched_at`, `as_of`, `freshness` et `data_kind`.

### Stockage et cache

- les transactions et notes utilisateur sont la source de vérité ;
- les positions sont dérivées des transactions ;
- les cours et états financiers normalisés sont mis en cache avec leur provenance ;
- le dernier cours affichable ne remplace jamais la date d’observation ;
- une lecture peut utiliser le cache si la donnée respecte une politique de fraîcheur explicite ;
- le rafraîchissement manuel est prévu avant d’ajouter des jobs récurrents.

## Rafraîchissement des données

Pour le MVP, une récupération à la demande et un cache en base suffisent. Ensuite, une Edge Function Supabase déclenchée par `pg_cron` pourra rafraîchir les cours, événements et snapshots. Les secrets de fournisseur doivent rester dans Supabase Vault ou dans le gestionnaire de secrets de l’environnement serveur.

## Sécurité

- authentification Supabase dès que les données réelles seront branchées ;
- RLS activé sur chaque table exposée ;
- toutes les tables personnelles filtrées par `user_id` ou par un portefeuille appartenant à l’utilisateur ;
- clé publique Supabase dans le client, clé secrète jamais envoyée au navigateur ;
- clés de marché et clé du modèle de langage uniquement côté serveur ;
- logs sans contenu financier sensible ni secrets ;
- sauvegarde et export des transactions avant toute migration destructive.

Supabase recommande de combiner les grants PostgreSQL et les politiques RLS ; les tables exposées sans RLS ne doivent pas être considérées comme privées. Références : <https://supabase.com/docs/guides/database/postgres/row-level-security> et <https://supabase.com/docs/guides/api/securing-your-api>.

## Gestion des erreurs

Chaque carte de donnée doit pouvoir afficher : chargement, donnée indisponible, donnée ancienne, fournisseur limité et dernière valeur connue. Une panne du fournisseur ne doit pas effacer les transactions ni afficher un zéro trompeur.
