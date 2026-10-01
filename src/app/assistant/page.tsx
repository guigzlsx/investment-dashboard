import { AssistantView } from "../../components/assistant/assistant-view";
import { AppShell } from "../../components/layout/app-shell";

export default function AssistantPage() {
  return <AppShell description="Query your portfolio and market context through deterministic, source-backed tools." title="Investment Assistant"><AssistantView /></AppShell>;
}
