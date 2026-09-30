import { AppShell } from "../../components/layout/app-shell";
import { WatchlistIntelligenceView } from "../../components/watchlist/watchlist-intelligence-view";

export default function WatchlistPage() {
  return <AppShell description="Follow the companies and ETFs you are still trying to understand." title="Watchlist"><WatchlistIntelligenceView /></AppShell>;
}
