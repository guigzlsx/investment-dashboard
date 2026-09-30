import { DashboardLive } from "../../components/dashboard/dashboard-live";
import { AppShell } from "../../components/layout/app-shell";

export default function DashboardPage() {
  return <AppShell description="A calm overview of what you own, what changed, and what deserves your attention." title="Good morning, investor"><DashboardLive /></AppShell>;
}
