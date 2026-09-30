# Recherche des fournisseurs de données

État de la comparaison : 30 septembre 2026. Les offres, quotas et droits d’affichage évoluent ; ils doivent être revérifiés avant souscription.

## Recommandation

Pour le MVP personnel :

1. **FMP comme fournisseur applicatif principal à tester** pour recherche, cours, historique, profils, états financiers, ratios, calendrier et actualités.
2. **SEC EDGAR comme source de contrôle pour les sociétés américaines** et pour les documents réglementaires, pas comme fournisseur de cours.
3. **ECB comme source officielle de taux EUR** pour une conversion quotidienne cohérente ; prévoir un fournisseur FX de marché si l’affichage intraday devient important.
4. **Twelve Data en alternative** si la couverture géographique ou le temps réel requis par le MVP ne sont pas satisfaisants, après validation des droits d’usage personnel et d’affichage.

Le MVP ne promet pas le temps réel. Une donnée EOD ou retardée, clairement étiquetée, est préférable à une donnée pseudo-temps-réel non fiable.

## Comparaison

| Fournisseur | Accès gratuit constaté | Apport | Limites / vigilance | Décision |
| --- | --- | --- | --- | --- |
| Financial Modeling Prep | Basic : 250 appels/jour, données EOD, profils et références | Très bon candidat pour regrouper marché, fondamentaux et événements | Les plans, datasets et droits d’affichage varient ; la page de prix indique qu’un accord de display peut être nécessaire | Tester en premier pour le MVP |
| SEC EDGAR | APIs publiques sans clé, données Submissions et XBRL | Source primaire pour filings et company facts US, mise à jour rapide | Pas de cours ; couverture principalement sociétés déposantes US ; pas de CORS, User-Agent requis | Ajouter comme source de vérification |
| Twelve Data | Basic : crédits limités, 800 appels/jour annoncés et accès de test aux marchés US | Bonne couverture unifiée, FX, ETF et données de marché | Système de crédits pondérés, couverture progressive, droits d’usage distincts selon plan | Alternative si besoin de couverture/temps réel |
| Alpha Vantage | Limite standard annoncée de 25 requêtes/jour | Large catalogue et endpoint de recherche simple | Trop limité pour alimenter confortablement dashboard, watchlist et fiches ; historique complet et temps réel premium | Fallback de prototype seulement |
| Massive / Polygon | Stocks Basic gratuit : 5 appels/minute et EOD ; plans payants pour plus de profondeur | Excellente option marché US, historiques et streaming selon plan | Financials/ratios et temps réel nécessitent des niveaux payants ; coût disproportionné pour le MVP personnel | Garder pour une phase temps réel |

## Détails utiles

### Financial Modeling Prep

La documentation officielle expose notamment recherche, quote, historique EOD, profil et états financiers. La page de prix publiée indique un Basic gratuit à 250 appels par jour et des plans payants avec davantage d’appels, de couverture et de fondamentaux. La même page précise que l’affichage ou la redistribution peut nécessiter un accord de licence dédié.

Sources : <https://site.financialmodelingprep.com/developer/docs/pricing> et <https://site.financialmodelingprep.com/developer/docs/quickstart>.

### SEC EDGAR

Les APIs `data.sec.gov` ne demandent pas de clé et exposent notamment les historiques de dépôts et les données XBRL Company Facts. La SEC indique que les APIs ne supportent pas CORS et que les accès automatisés doivent respecter sa politique de sécurité. Cela impose un appel côté serveur, avec un User-Agent identifiable.

Source : <https://www.sec.gov/search-filings/edgar-application-programming-interfaces>.

### Taux de change

L’ECB publie des taux de référence EUR, adaptés à une valorisation quotidienne et à une conversion historisée. Ces taux ne constituent pas un flux intraday ; le statut de fraîcheur doit le préciser.

Source : <https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html>.

### Risque de quotas

Le backend doit dédupliquer les demandes, limiter les rafraîchissements, stocker le dernier résultat et afficher un statut de données plutôt que de multiplier les appels à chaque rendu React. Un budget de requêtes par fournisseur doit être suivi dans `provider_sync_runs` ou dans l’observabilité.

### Risque de licence

« Donnée disponible via API » ne signifie pas automatiquement « droit d’afficher la donnée dans une interface ». Le projet reste personnel, mais les conditions du fournisseur doivent être relues avant de publier, partager ou ouvrir l’application à d’autres utilisateurs.
