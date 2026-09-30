import { AppShell } from "../../components/layout/app-shell";
import { SectionPlaceholder } from "../../components/shared/section-placeholder";

export default function SettingsPage() {
  return <AppShell description="Control your base currency, data freshness and private workspace settings." title="Settings"><SectionPlaceholder description="The first setup step will connect a provider without exposing its API key to the browser, then let you choose how often data may be refreshed." primaryAction="Coming next" title="Your workspace, your rules" /></AppShell>;
}
