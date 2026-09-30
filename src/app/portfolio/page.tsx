import { AppShell } from "../../components/layout/app-shell";
import { PortfolioView } from "../../components/portfolio/portfolio-view";

export default function PortfolioPage() {
  return <AppShell description="See your positions through cost basis, allocation and risk context." title="Portfolio"><PortfolioView /></AppShell>;
}
