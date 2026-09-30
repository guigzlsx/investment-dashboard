# Roadmap de développement v1

## Étape 0 — fondation produit

- valider le vocabulaire : investi, coût moyen, P/L réalisé, P/L latent ;
- poser le système de design dark ;
- créer le shell et les routes sans données réelles ;
- décider de la politique de fraîcheur et des états d’erreur.

## Étape 1 — portefeuille local

- ajouter Supabase Auth et les migrations PostgreSQL ;
- créer un portefeuille et saisir une transaction ;
- calculer positions, prix moyen, valeur, P/L et poids ;
- gérer EUR, USD, CHF et GBP avec un taux historisé ;
- ajouter des tests unitaires des calculs.

## Étape 2 — marché et watchlist

- implémenter `MarketDataProvider` ;
- connecter un fournisseur choisi après validation de licence ;
- rechercher un instrument ;
- ajouter et retirer des favoris ;
- afficher cours, variation, market cap, P/E et croissance avec source et date ;
- stocker notes, prix cible et alertes sans spam.

## Étape 3 — fiche actif

- ajouter historique et périodes ;
- afficher états financiers et métriques normalisées ;
- comparer valorisation à l’historique, secteur et concurrents lorsque les données existent ;
- écrire les synthèses business, croissance, risques, moat et catalyseurs ;
- rendre les données manquantes visibles.

## Étape 4 — dashboard et Portfolio Health

- construire le dashboard prioritaire ;
- ajouter allocations par entreprise, secteur, géographie, devise et actif ;
- produire les insights déterministes ;
- ajouter corrélations approximatives et scénarios simples ;
- créer les snapshots de portefeuille.

## Étape 5 — Investment Assistant

- exposer les outils de lecture et de calcul ;
- produire une réponse structurée avec sources et incertitude ;
- autoriser les questions portefeuille, actif, comparaison et scénario ;
- journaliser les analyses et leur date de données ;
- ajouter tests d’évaluation et garde-fous.

## Étape 6 — qualité et exploitation

- tests de bout en bout des parcours critiques ;
- monitoring des quotas et des erreurs fournisseurs ;
- sauvegarde/export des transactions ;
- amélioration mobile et accessibilité ;
- ajout d’un rafraîchissement planifié uniquement si le besoin est démontré.

## Critère de passage entre étapes

Une étape n’est terminée que si les calculs sont testés, les états sans données sont compréhensibles, la fraîcheur est visible et l’interface reste lisible sur desktop et mobile.
