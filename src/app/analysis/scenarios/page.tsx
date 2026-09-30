import { ScenarioView } from "../../../components/analysis/scenario-view";
import { AppShell } from "../../../components/layout/app-shell";

export default function ScenariosPage() {
  return <AppShell description="Explore mechanical portfolio impacts without turning them into predictions." title="Scenario Analysis"><ScenarioView /></AppShell>;
}
