# Investment Assistant Core v1

## Périmètre

Le Lot 4A construit le moteur déterministe de l'assistant sans LLM et sans appel OpenAI. La réponse produite par `/api/assistant/analyze` est un matériau structuré : elle expose l'intention, les métriques, les observations, les scénarios, les preuves, les données manquantes et les questions de suivi.

```text
Question
  -> AssistantIntentRouter
  -> Entity Resolution via MarketDataProvider.searchAssets
  -> AssistantQueryPlan
  -> Investment Tool Registry
  -> moteurs portfolio / market / analysis existants
  -> AssistantAnalysis structurée
```

## Tools

Le registre central est `src/lib/assistant/tools/registry.ts`. Chaque tool possède un nom, une description, un schéma d'entrée et une sortie `ToolResult<T>` avec `success`, `data`, `error`, `generatedAt`, `missingData` et `provenance`.

Tools disponibles :

- portefeuille : `getPortfolioSummary`, `getPositions`, `getPosition`, `getPortfolioHealth`, `getPortfolioExposures`, `getPerformanceAttribution` ;
- suivi : `getWatchlist`, `getInvestmentThesis` ;
- actif : `getAssetOverview`, `getAssetFundamentals`, `getAssetGrowth`, `getAssetValuation`, `getAssetRisks` ;
- comparaison : `compareAssets` ;
- scénarios : `runAssetScenario`, `runMultiAssetScenario`, `runFxScenario`.

Les tools utilisent `getPortfolioValuation`, `buildPortfolioHealth`, `calculateScenario`, `calculateFxScenario`, `analyzeGrowth`, `analyzeValuation`, `analyzeRiskCoverage` et `calculateAttribution`. Ils ne recréent pas les formules financières.

## Intent Router

`routeAssistantIntent()` reconnaît les intentions suivantes :

`PORTFOLIO_OVERVIEW`, `PORTFOLIO_RISK`, `POSITION_ANALYSIS`, `ASSET_ANALYSIS`, `WATCHLIST_ANALYSIS`, `COMPARISON`, `SCENARIO`, `PERFORMANCE`, `VALUATION`, `GROWTH`, `INVESTMENT_THESIS`, `EDUCATION` et `UNKNOWN`.

Les règles sont explicites et testables. Par exemple, `falls 20%` devient `changePercent: -20`, tandis que `rises 20%` devient `20`.

## Entity Resolution

Les noms et tickers sont résolus par `MarketDataProvider.searchAssets()`. Aucun catalogue d'entreprises n'est hardcodé. Une correspondance exacte de symbole ou de nom est retenue ; plusieurs résultats non distinctifs restent ambigus et ne déclenchent pas de calcul sur un symbole arbitraire.

## Query Planning et Context Selection

`buildAssistantQueryPlan()` transforme une question en étapes de tools typées. `selectAssistantTools()` limite les données chargées à l'intention :

- portefeuille : résumé ou santé/expositions ;
- actif : overview, fondamentaux, croissance, valorisation, risques et thèse ;
- comparaison : métriques comparables des symboles résolus ;
- scénario : outil de scénario existant avec les paramètres extraits ;
- watchlist : données de la watchlist de l'utilisateur.

Le contexte de tools contient une mémoire de promesses afin de dédupliquer la valorisation portfolio et les lectures d'un même actif dans une requête.

## AssistantAnalysis

Le résultat intermédiaire contient :

- `intent` et `subject` ;
- `summaryMetrics` ;
- `observations` avec `rule`, `evidence` et `values` ;
- `risks` structurés ;
- `scenarios` mécaniques et leurs hypothèses ;
- `evidence` avec provenance ;
- `missingData` explicite ;
- `suggestedFollowUps`.

Les comparaisons retournent uniquement des valeurs et des différences. Elles ne produisent ni gagnant, ni score, ni recommandation.

## Provenance et données manquantes

Les sources exposées sont `FMP`, `ECB`, `Your Portfolio` et `Calculated`. Les objets provider conservent `asOfDate`, `retrievedAt` et `freshness`. Une absence reste `null` et est ajoutée à `missingData`; elle n'est jamais transformée en zéro.

La préférence `default_analysis_depth` contrôle le nombre d'observations rendues (`QUICK` ou `DETAILED`). `base_currency` est conservée dans le contexte pour préparer l'affichage futur ; les calculs portfolio restent sur la devise du portefeuille, conformément à la limitation documentée du Lot 3.5.

## Sécurité

`POST /api/assistant/analyze` exige `getAuthenticatedSupabase()`. L'identité vient de la session Supabase et aucun `userId` n'est accepté dans le payload. Les tools reçoivent uniquement le client Supabase authentifié et l'utilisateur de session ; les notes et watchlists passent par les requêtes personnelles existantes et leur RLS.

Le mode debug est disponible uniquement hors production avec `?debug=true`. Il expose intention, entités, plan, tools appelés, latence et données manquantes, jamais de secret.

## Interface

`/assistant` est une interface de test de l'Assistant Core. Elle propose les questions de référence, affiche les résultats structurés et rappelle qu'aucun LLM n'est connecté. La navigation inclut `Assistant` ; `/analysis` reste une page d'accès aux analyses existantes.

## Limitations v1

- l'intention `EDUCATION` est détectée mais ne génère pas encore d'explication pédagogique ;
- les données provider et les classifications restent limitées par FMP et leur fraîcheur ;
- la comparaison affiche une différence numérique lorsque plusieurs valeurs existent, sans normalisation sectorielle ;
- le scénario reste mécanique et ne modélise ni corrélation, ni réaction en chaîne, ni fiscalité ;
- aucun historique `analysis_runs` n'est écrit dans ce lot ;
- aucune couche LLM n'est configurée.
