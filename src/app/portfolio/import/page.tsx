import { AppShell } from "../../../components/layout/app-shell";
import { PortfolioImportView } from "../../../components/portfolio/portfolio-import-view";

export default function PortfolioImportPage() {
  return <AppShell description="Bring an existing broker export into the same auditable transaction ledger." title="Import portfolio"><PortfolioImportView /></AppShell>;
}
