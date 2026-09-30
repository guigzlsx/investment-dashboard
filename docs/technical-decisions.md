# Choix techniques et décisions

## Décisions prises à l’initialisation

| Sujet | Décision | Motif |
| --- | --- | --- |
| Framework | Next.js avec App Router | Socle React moderne pour l’interface et les routes applicatives |
| Langage | TypeScript | Typage statique et meilleure maintenabilité |
| Styles | Tailwind CSS | Système de styles utilitaires intégré au socle |
| Qualité | ESLint | Détection précoce des problèmes de code |
| Données | Supabase / PostgreSQL prévu, non installé à cette étape | Éviter d’ajouter des dépendances avant la conception du modèle de données |
| Documentation | Dossier `docs/` versionné | Conserver les décisions et le contexte du projet au même endroit |

## Décisions à prendre

- stratégie d’authentification et de gestion des utilisateurs ;
- périmètre du suivi de portefeuille ;
- sources des données de marché et fréquence de mise à jour ;
- règles de calcul des performances ;
- politique de sécurité et de conservation des données.
