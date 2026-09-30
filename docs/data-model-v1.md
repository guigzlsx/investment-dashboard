# Modèle de données v1

## Principes

1. Les transactions sont immuables et constituent la source de vérité du portefeuille.
2. Les positions, prix moyens et P/L sont dérivés par des fonctions versionnées.
3. Les données de marché sont séparées des données personnelles.
4. Chaque valeur externe possède sa provenance et son horodatage.
5. Toutes les valeurs financières utilisent `numeric`, jamais `float`.

## Tables principales

### `profiles`

Profil applicatif lié à `auth.users` : `id`, `display_name`, `base_currency`, `created_at`, `updated_at`.

### `portfolios`

`id`, `user_id`, `name`, `base_currency`, `created_at`, `updated_at`.

Le MVP prévoit un portefeuille principal, mais le modèle permet d’en ajouter plusieurs.

### `instruments`

Référentiel d’actions et ETF : `id`, `symbol`, `exchange`, `isin`, `name`, `asset_type`, `quote_currency`, `country`, `sector`, `industry`, `provider_symbols`, `created_at`, `updated_at`.

Le ticker seul n’est pas une clé suffisante : le même symbole peut exister sur plusieurs places.

### `transactions`

`id`, `portfolio_id`, `instrument_id`, `type`, `quantity`, `unit_price`, `currency`, `fees`, `traded_at`, `fx_rate_to_base`, `note`, `created_at`.

Types MVP : `BUY` et `SELL`. Les dividendes, dépôts, retraits, splits et fusions sont prévus dans une extension ultérieure.

### `watchlists` et `watchlist_items`

Une watchlist appartient à un utilisateur. Un item référence un instrument et peut contenir `personal_note`, `target_price`, `target_currency`, `created_at`, `updated_at`.

### `price_alerts`

`id`, `user_id`, `instrument_id`, `condition_type`, `threshold`, `currency`, `enabled`, `cooldown_hours`, `last_triggered_at`, `created_at`.

Le MVP déclenche les alertes seulement lorsqu’une synchronisation observe une condition ; il n’envoie pas d’alerte à chaque rafraîchissement.

### `investment_notes`

`id`, `user_id`, `instrument_id`, `portfolio_id`, `thesis`, `horizon`, `risks`, `invalidation_conditions`, `status`, `created_at`, `updated_at`.

Une note est une opinion personnelle datée, pas une vérité générée par l’assistant.

### `market_quotes`

`id`, `instrument_id`, `price`, `currency`, `change_1d`, `volume`, `data_kind`, `as_of`, `fetched_at`, `source`, `source_endpoint`, `raw_hash`.

`data_kind` distingue au minimum `REALTIME`, `DELAYED`, `EOD` et `STALE`.

### `price_bars`

Historique OHLCV normalisé : `instrument_id`, `interval`, `open`, `high`, `low`, `close`, `volume`, `currency`, `bar_time`, `source`, `fetched_at`, avec une contrainte d’unicité sur instrument, intervalle, date et source.

### `fundamental_periods` et `fundamental_metrics`

Les états financiers sont stockés par période : `instrument_id`, `fiscal_period`, `period_end`, `reported_at`, `metric`, `value`, `unit`, `currency`, `source`, `source_document`, `fetched_at`.

Les ratios dérivés comme P/E, PEG ou EV/EBITDA doivent aussi conserver la date de calcul et les valeurs de référence utilisées.

### `portfolio_snapshots`

`id`, `portfolio_id`, `captured_at`, `total_value_base`, `invested_cost_base`, `pnl_base`, `cash_base`, `fx_source`, `data_quality`.

Ces snapshots permettent la courbe du portefeuille sans recalculer toute l’histoire à chaque affichage.

### `company_events` et `news_items`

Événements et actualités normalisés avec `instrument_id`, `event_type`, `title`, `summary`, `published_at`, `source`, `url`, `fetched_at`, `relevance`, `raw_payload_hash`.

### `analysis_runs`

Traçabilité de l’assistant : `id`, `user_id`, `scope_type`, `scope_id`, `question`, `data_as_of`, `provider_versions`, `structured_result`, `uncertainty_level`, `created_at`.

## Relations

```text
auth.users -> profiles -> portfolios -> transactions -> instruments
                           |             |
                           |             -> portfolio_snapshots
                           -> investment_notes
watchlists -> watchlist_items -> instruments
price_alerts -> instruments
market_quotes / price_bars / fundamentals / events -> instruments
analysis_runs -> user + portefeuille ou instrument
```

## Calculs du portefeuille

Le MVP est long-only et utilise un coût moyen pondéré :

- achat : quantité et coût total augmentent ;
- vente : la quantité diminue et le coût moyen de la position reste le coût moyen courant ;
- P/L réalisé : produit de vente moins coût historique de la quantité vendue et frais ;
- P/L latent : valeur actuelle moins coût restant ;
- valeur actuelle : quantité restante multipliée par le dernier cours accepté, puis convertie en EUR ;
- poids : valeur de la position divisée par la valeur totale non nulle.

Le taux de change de la transaction est conservé pour rendre le calcul historique reproductible. Les opérations sur titres et la fiscalité ne doivent pas être simulées silencieusement.

## Devise

Chaque transaction conserve sa devise d’origine. Le portefeuille conserve une devise de référence, EUR par défaut. Le système affiche à la fois le prix d’origine et la valeur convertie ; il sépare la performance de l’actif de l’effet de change lorsque les données disponibles le permettent.

## Sécurité des données

Les tables personnelles utilisent RLS par `user_id` ou par appartenance au portefeuille. Les tables de référence de marché peuvent être partagées, mais leurs droits de lecture et les éventuelles restrictions de licence doivent être vérifiés avant exposition.
