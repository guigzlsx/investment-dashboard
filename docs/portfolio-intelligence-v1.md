# Portfolio Intelligence v1

## Snapshots et performance

`portfolio_snapshots` conserve uniquement les agrégats nécessaires à l'historique : date de capture, valeur totale, capital investi, P/L latent, cash éventuel, devise et qualité des données. Les positions ne sont pas recopiées : elles restent reconstructibles depuis `transactions`.

La performance entre deux snapshots est calculée ainsi :

```text
retour = (valeur_fin - valeur_début - flux_net) / valeur_début
```

Les dépôts et retraits sont identifiés par les transactions `DEPOSIT` et `WITHDRAWAL`. Ils ne sont donc pas comptés comme de la performance de marché. Le stockage d'un snapshot est volontairement déclenché par l'application via `POST /api/portfolio/snapshots` ; une planification automatique pourra être ajoutée plus tard.

## Attribution

`/api/portfolio/attribution` estime la contribution de chaque position sur 1D, 1W et 1M. Le 1D utilise la variation fournie par le quote. Les horizons plus longs recherchent l'observation historique la plus récente antérieure à la date cible. Une position sans cours ou sans FX reste inconnue et n'est pas remplacée par zéro.

## Scénarios

Les scénarios sont des chocs mécaniques appliqués à la valeur courante connue d'une position :

```text
impact = valeur_position × choc
valeur_estimée = valeur_portefeuille + somme(impact)
```

Les scénarios ne modélisent pas les corrélations, les réactions en chaîne, les changements de poids, les frais, la fiscalité ou les mouvements de change sauf dans le scénario FX dédié. Les presets sont définis dans `src/lib/portfolio/scenario-presets.ts` et ne constituent pas des prédictions.

## Portfolio Health et thèmes

Les expositions sont calculées par valeur courante, ou par coût investi lorsque la valeur courante n'est pas disponible. Les thèmes sont une relation séparée `asset_themes(asset_id, theme, confidence, source)` afin d'éviter de cacher une classification d'entreprise dans un composant React. Les thèmes peuvent se chevaucher ; une exposition thématique peut donc dépasser 100 % par addition et doit être lue comme une exposition brute, pas comme une allocation exclusive.

Les coefficients de corrélation ne sont pas inventés. Tant que les classifications et historiques suffisants ne sont pas présents, l'interface indique que la corrélation est indisponible.

## Croissance et valorisation

La croissance est dérivée des états financiers normalisés. Pour chaque série, le taux récent est comparé au taux précédent : accélération si l'écart dépasse 2 points de pourcentage, décélération s'il est inférieur à -2 points, sinon stabilité. Avec moins de deux taux connus, l'état est `UNKNOWN`.

La valorisation affiche la métrique courante, la médiane, le minimum, le maximum et l'écart relatif à la médiane parmi les observations disponibles. Il ne s'agit ni d'un verdict `CHEAP/EXPENSIVE`, ni d'une comparaison sectorielle lorsque les données secteur/peers ne sont pas réellement disponibles.

## Journal et revue de thèse

Les notes d'investissement restent des données personnelles séparées des fondamentaux. La revue (`UNCHANGED`, `STRENGTHENED`, `WEAKENED`, `INVALIDATED`) est choisie par l'utilisateur ; l'application ne la déduit pas automatiquement.

## Cache persistant

Les réponses FMP normalisées passent d'abord par `market_data_cache`, avec les TTL définis dans `data-foundation-v1.md`. Les quotes utilisées pour valoriser le portefeuille sont historisées dans `market_quotes`. Les taux ECB sont lus et écrits dans `fx_rates`, tout en conservant un fallback mémoire lorsque Supabase n'est pas configuré.

## InvestmentContextService

`buildInvestmentContext` agrège les calculs sans produire d'interprétation libre. L'objet expose portefeuille, positions, allocations, insights, watchlist, fondamentaux, notes, scénarios fournis par l'appelant et provenance. Le futur assistant pourra consommer cet objet, mais ne devra pas recalculer les chiffres.
