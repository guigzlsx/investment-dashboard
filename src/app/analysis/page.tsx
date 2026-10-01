import { AppShell } from "../../components/layout/app-shell";
import Link from "next/link";
import { SectionPlaceholder } from "../../components/shared/section-placeholder";

export default function AnalysisPage() {
  return <AppShell description="Ask questions about your portfolio, a position, or two companies side by side." title="Analysis"><SectionPlaceholder description="The deterministic Investment Assistant core is available now. The language model layer is intentionally not enabled yet." primaryAction="Open Assistant" title="An analyst that shows its work" /><div className="analysis-links"><Link className="button button-primary" href="/assistant">Open Assistant</Link><Link className="button" href="/analysis/scenarios">Open scenarios</Link><Link className="button" href="/health">Open Portfolio Health</Link></div></AppShell>;
}
