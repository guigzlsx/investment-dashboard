# Architecture de l’Investment Assistant

## Objectif

L’assistant n’est pas un moteur de prédiction. C’est une interface de raisonnement qui met en contexte des calculs, des données financières et des sources datées.

## Pipeline de réponse

```text
Question utilisateur
        |
        v
Classification de l’intention et du périmètre
        |
        v
Récupération des outils autorisés
        |
        v
Calculs déterministes et contrôle de fraîcheur
        |
        v
Contexte structuré avec sources
        |
        v
Génération d’une réponse structurée
        |
        v
Validation : chiffres, sources, incertitude, sécurité
        |
        v
Réponse pédagogique dans l’interface
```

## Outils de l’assistant

- `getPortfolioSummary(portfolioId)` ;
- `getPositionBreakdown(instrumentId)` ;
- `getAllocation(portfolioId, dimension)` ;
- `calculateScenario(portfolioId, shock)` ;
- `compareInstruments(left, right)` ;
- `getFundamentals(instrumentId, period)` ;
- `getValuationContext(instrumentId)` ;
- `getCompanyEvents(instrumentId, range)` ;
- `getInvestmentNotes(instrumentId)` ;
- `getDataFreshness(scope)`.

Le modèle ne reçoit jamais une requête SQL libre ni une clé de fournisseur. Il appelle une liste d’outils typés et limités.

## Structure de réponse

Chaque réponse sauvegardable suit une forme équivalente à :

```text
summary
what_is_observed[]
arguments_for[]
arguments_against[]
valuation_context
portfolio_impact
risks[]
assumptions[]
data_used[] { label, source, as_of, fetched_at }
uncertainty { level, reasons[] }
next_things_to_watch[]
not_personalized_advice: true
```

Les données chiffrées affichées dans la prose doivent être issues du contexte structuré, et non recalculées de mémoire par le modèle.

## Règles de comportement

- distinguer les faits observés des interprétations ;
- ne jamais présenter une prédiction comme certaine ;
- ne pas inventer un chiffre absent ou ancien ;
- signaler explicitement les données retardées ou manquantes ;
- expliquer le raisonnement en quelques étapes vérifiables ;
- montrer les arguments favorables et défavorables ;
- rappeler quand un résultat dépend d’une hypothèse ;
- éviter les sorties BUY/SELL/HOLD comme résumé ;
- proposer une question de suivi ou une donnée à surveiller plutôt qu’un ordre d’action.

## Niveaux d’incertitude

Le niveau d’incertitude ne mesure pas une probabilité de hausse. Il décrit la qualité de l’analyse :

- **faible** : données récentes, complètes, cohérentes et calcul transparent ;
- **moyenne** : données utilisables mais retards, couverture partielle ou hypothèses notables ;
- **élevée** : données incomplètes, entreprise difficile à comparer, événement récent ou hypothèse dominante.

## Portfolio Insights sans LLM

Les insights de dashboard sont d’abord des règles déterministes :

- poids d’un actif supérieur à un seuil configurable ;
- top 2 ou top 3 représentant une part élevée ;
- faible diversification ETF ;
- forte exposition à une devise ;
- chevauchement sectoriel ou thématique ;
- hausse de corrélation sur une fenêtre historique ;
- donnée de valorisation ou de résultat devenue trop ancienne.

Le LLM peut reformuler et relier ces faits, mais ne décide pas qu’un risque existe à partir d’un chiffre non vérifié.

## Comparaison et scénario

Une comparaison sépare : croissance, marges, génération de cash, bilan, valorisation et risques. Un scénario `NVDA -20 %` applique un choc à la position concernée et calcule l’impact mécanique sur le portefeuille. Il ne prétend pas modéliser les réactions en chaîne, les changements de corrélation ou les effets de change.

## Évaluation

Avant d’autoriser des analyses libres, préparer un jeu de questions de référence : portefeuille concentré, devise USD, action chère, action sans données récentes, comparaison de deux entreprises et scénario de baisse. Vérifier les chiffres, la présence des sources, la mention de l’incertitude et l’absence de recommandation catégorique.
