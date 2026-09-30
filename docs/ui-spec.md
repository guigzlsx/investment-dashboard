# Spécification UI v1

## Direction visuelle

- dark mode uniquement au départ ;
- fond `#0B0D10`, surface `#11151A`, carte `#151A21`, bordure `#242B35` ;
- texte principal `#F5F7FA`, secondaire `#8B95A5` ;
- vert réservé aux performances positives ;
- rouge réservé aux performances négatives ;
- bleu/violet discret pour liens, focus et actions ;
- rayons modérés, ombres discrètes, peu de bordures ;
- grands espaces et largeur de lecture contrôlée.

## Shell

Desktop : sidebar compacte à gauche, contenu central, barre supérieure avec recherche globale et fraîcheur des données.

Mobile : header compact, recherche accessible, navigation basse ou drawer ; les tableaux deviennent des cartes lisibles plutôt qu’un tableau horizontal illisible.

## Composants réutilisables

### Layout

`AppShell`, `Sidebar`, `MobileNav`, `TopBar`, `GlobalSearch`, `PageHeader`, `SectionHeader`.

### Données

`MetricTile`, `MoneyValue`, `PerformanceValue`, `FreshnessBadge`, `SourcePopover`, `TooltipMetric`, `Sparkline`, `PortfolioChart`, `DataTable`, `EmptyState`, `Skeleton`.

### Portefeuille

`PositionsTable`, `PositionRow`, `AllocationBreakdown`, `RiskSummary`, `InsightCard`, `ScenarioCard`, `HealthScoreBreakdown`.

### Actif

`AssetHeader`, `PriceChart`, `MetricGrid`, `MetricExplainer`, `ValuationPanel`, `GrowthPanel`, `BusinessSummary`, `RiskList`, `MoatList`, `CatalystList`.

### Assistant

`AssistantPanel`, `QuestionSuggestions`, `AnalysisBlock`, `ArgumentList`, `AssumptionList`, `SourceList`, `UncertaintyBadge`.

## Règles de lisibilité

- une carte ne présente qu’une idée principale ;
- les chiffres importants sont alignés et utilisent la même précision ;
- une variation positive ou négative est accompagnée d’un signe et d’un libellé ;
- les tooltips donnent d’abord une phrase simple, puis une définition plus précise ;
- le vert et le rouge ne sont jamais les seuls moyens de comprendre un état ;
- les états de chargement conservent la géométrie de la page ;
- les erreurs expliquent quoi faire et ne remplacent pas les données par zéro ;
- focus clavier et contrastes vérifiés avant l’ajout d’animations.

## Micro-interactions

- transition courte lors du changement de période ;
- survol subtil sur une ligne de position ;
- apparition progressive des insights ;
- confirmation discrète après ajout d’un favori ou d’une transaction ;
- aucun mouvement permanent ni animation décorative sur les données financières.
