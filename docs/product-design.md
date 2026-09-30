# Conception produit v1

## Positionnement

Investment Dashboard est un outil personnel de compréhension de portefeuille. Il ne doit pas ressembler à un terminal de trading et ne doit pas transformer une donnée isolée en conseil automatique.

La promesse du produit est :

> Transformer des données financières complexes en informations simples, sourcées et actionnables pour aider l’utilisateur à réfléchir.

## Principes produit

1. **Comprendre avant d’agir** : chaque métrique importante possède une explication simple.
2. **Le contexte avant le verdict** : une valorisation est comparée à son historique, son secteur et les hypothèses de croissance.
3. **Les calculs avant le langage** : les positions, performances, scénarios et risques sont calculés par du code déterministe.
4. **La provenance est visible** : source, date de marché, heure de collecte et statut retardé sont affichés.
5. **L’incertitude est explicite** : l’assistant distingue faits, hypothèses, interprétations et inconnues.
6. **La simplicité est une fonctionnalité** : le dashboard donne d’abord les quelques informations qui changent la compréhension du portefeuille.

## MVP retenu

Le MVP comprend :

- un portefeuille personnel en EUR ;
- l’ajout manuel de transactions BUY/SELL ;
- le calcul du prix moyen, des positions, de la valeur et du P/L ;
- la recherche d’actions et d’ETF ;
- une watchlist avec notes, objectifs et alertes simples ;
- une fiche action avec cours, historique, fondamentaux et contexte de valorisation ;
- des insights déterministes sur concentration, secteurs, devises et corrélations approximatives ;
- un assistant en lecture seule qui explique les données et cite leur provenance ;
- une simulation simple de baisse d’un actif ou d’un indice ;
- une interface dark mode responsive.

## Hors périmètre MVP

- connexion automatique à un courtier ;
- passage d’ordres ;
- conseil réglementé, scoring prédictif ou signal d’achat/vente ;
- temps réel tick par tick ;
- fiscalité par lot et règles fiscales multi-pays ;
- opérations sur titres complexes ;
- couverture exhaustive de toutes les places mondiales ;
- recommandations autonomes envoyées sans demande de l’utilisateur.

## Pages et parcours

| Page | Objectif | Contenu prioritaire |
| --- | --- | --- |
| `/dashboard` | Comprendre l’état du portefeuille en moins de 10 secondes | valeur, investi, P/L, courbe, positions principales, allocation, 3 insights, événements importants |
| `/portfolio` | Examiner les positions et les risques | tableau des positions, allocation, santé, scénarios |
| `/watchlist` | Suivre les entreprises à étudier | cours, variations, valorisation, croissance, note et objectif personnel |
| `/discover` | Explorer des thèmes sans recommandations automatiques | catégories, filtres, raisons d’apparition, données et risques |
| `/analysis` | Poser une question contextualisée | assistant, comparaison, sources, hypothèses et incertitude |
| `/assets/[symbol]` | Comprendre une entreprise ou un ETF | identité, graphique, métriques, valorisation, croissance, business, risques, moat, catalyseurs |
| `/settings` | Gérer le compte et les sources | devise de référence, fournisseurs, fraîcheur, préférences d’alertes |

## Dashboard : ordre de lecture

1. **Portfolio value** avec valeur actuelle, montant investi, P/L en EUR et pourcentage.
2. **Courbe** avec périodes 1D, 1W, 1M, 3M, 1Y, ALL et une indication de fraîcheur.
3. **Positions** avec poids, valeur, P/L, mouvement du jour et accès direct à la fiche actif.
4. **Allocation** par entreprise, secteur, géographie, devise et type d’actif.
5. **Insights** formulés en langage naturel, avec le calcul sous-jacent accessible.
6. **Events** pour résultats, guidance, actualités importantes ou données devenues obsolètes.

## Règles de lecture des analyses

Une analyse doit répondre à quatre questions :

- qu’est-ce qui est observé ;
- quelle interprétation est raisonnable ;
- quels éléments peuvent invalider cette interprétation ;
- quelle donnée ou quel événement mérite d’être surveillé ensuite.

Le produit emploie des formulations comme « implique », « suggère », « dépend de » ou « à surveiller ». Il n’emploie pas « certain », « garanti » ou un verdict BUY/SELL/HOLD comme sortie principale.
