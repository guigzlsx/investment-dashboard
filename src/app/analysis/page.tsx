import { AppShell } from "../../components/layout/app-shell";
import Link from "next/link";
import { SectionPlaceholder } from "../../components/shared/section-placeholder";

export default function AnalysisPage() {
  return <AppShell description="Ask questions about your portfolio, a position, or two companies side by side." title="Investment Assistant"><SectionPlaceholder description="The LLM is intentionally not enabled yet. Deterministic tools are available now for scenarios and portfolio health." primaryAction="Open scenario analysis" title="An analyst that shows its work" /><div className="analysis-links"><Link className="button button-primary" href="/analysis/scenarios">Open scenarios</Link><Link className="button" href="/health">Open Portfolio Health</Link></div></AppShell>;
}
