# Data Foundation v1

## Décisions principales

- `transactions` est le registre immuable du portefeuille.
- Les positions ne sont pas stockées : elles sont reconstruites à la lecture avec le coût moyen pondéré.
- Un `SELL` retire le coût moyen courant de la quantité vendue. Il ne modifie donc pas le prix moyen des unités restantes et calcule le P/L réalisé séparément.
- Les frais sont inclus dans le coût de revient pour un achat et dans le P/L réalisé pour une vente.
- La devise de transaction, la devise de cotation et la devise de base du portefeuille restent distinctes.
- Une conversion FX est acceptée uniquement si son taux, sa date et sa source sont connus.

Cette méthode est volontairement long-only pour le MVP. Les types de transaction `DIVIDEND`, `SPLIT`, `DEPOSIT` et `WITHDRAWAL` sont déjà réservés dans le modèle afin d'étendre le ledger sans modifier sa structure principale.

## Schéma Supabase

La migration `supabase/migrations/20260930120000_data_foundation.sql` crée les tables personnelles et de référence :

- `profiles`, `portfolios`, `transactions` ;
- `assets`, `watchlists`, `watchlist_items` ;
- `investment_notes`, `price_alerts`, `portfolio_snapshots` ;
- `fx_rates`, `market_quotes`, `market_data_cache`.

Les tables personnelles sont protégées par RLS. Les actifs et données de marché sont lisibles par un utilisateur authentifié, mais les actifs partagés sont écrits uniquement par les route handlers via `SUPABASE_SERVICE_ROLE_KEY`. Cette clé n'est jamais importée dans un composant client.

## Fournisseur de marché

Les composants ne consomment jamais un objet FMP directement :

```text
UI -> route handler -> MarketDataProvider -> FmpMarketDataProvider -> modèles normalisés
```

Les modèles internes sont `Asset`, `Quote`, `HistoricalPrice`, `CompanyProfile`, `FinancialStatement` et `KeyMetrics`. Chaque réponse porte `source`, `sourceEndpoint`, `timestamp`, `asOfDate`, `dataKind` et `freshness`.

Les méthodes déjà disponibles sont `searchAssets`, `getQuote`, `getHistoricalPrices`, `getCompanyProfile`, `getFinancials` et `getKeyMetrics`. FMP est joignable uniquement côté serveur via `FMP_API_KEY`.

## Cache applicatif

Le cache persistant `market_data_cache` est utilisé en priorité pour les réponses normalisées du fournisseur. Un fallback mémoire reste disponible lorsque Supabase n'est pas configuré, afin que l'interface puisse continuer à fonctionner en mode de configuration locale.

| Donnée | TTL v1 | Raison |
| --- | ---: | --- |
| Recherche | 5 min | Les résultats de recherche changent peu |
| Quote | 60 s | Réduire les appels tout en gardant une vue fraîche |
| Historique | 15 min | Les observations historiques sont stables |
| Profil entreprise | 7 jours | Donnée descriptive lente à changer |
| États financiers | 24 h | Mise à jour périodique |
| Ratios / métriques | 24 h | Recalcul moins fréquent que le cours |
| FX ECB | 24 h | Taux de référence EUR quotidien |

Le cache n'altère jamais la provenance : la date de récupération et la date d'observation restent affichées séparément. Si le fournisseur ne garantit pas le statut, `FMP_DATA_KIND` reste `UNKNOWN` et l'interface n'affiche pas « temps réel ».

## FX et valorisation

Les taux ECB sont chargés quotidiennement via l'API Data ECB, puis convertis autour de l'EUR pour les couples EUR/USD/CHF/GBP. Les valeurs calculées distinguent :

- le mouvement du titre (`change1D`) ;
- la conversion de la valeur dans la devise de base ;
- l'absence de taux, qui produit une valeur inconnue et non zéro.

Le formulaire de transaction demande explicitement un taux historique pour une transaction non EUR dans le portefeuille MVP en EUR. Les taux ECB sont utilisés pour la valorisation courante.

## Gestion des erreurs

Les route handlers normalisent les erreurs de configuration, authentification, quota, ticker inconnu, fournisseur indisponible et réponse invalide. Une absence de cours ou de FX laisse les métriques à `null`, l'UI affichant `—` et la qualité `PARTIAL`.

## Configuration manuelle

Copier `.env.example` vers `.env.local`, renseigner `FMP_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou l'ancien anon key) et `SUPABASE_SERVICE_ROLE_KEY`, puis appliquer la migration Supabase. Le provider FMP et les droits d'affichage doivent être validés selon le plan choisi avant toute publication.
