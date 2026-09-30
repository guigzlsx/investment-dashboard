import { HealthView } from "../../components/health/health-view";
import { AppShell } from "../../components/layout/app-shell";

export default function HealthPage() {
  return <AppShell description="Understand concentration, currency, sector and thematic dependencies." title="Portfolio Health"><HealthView /></AppShell>;
}
