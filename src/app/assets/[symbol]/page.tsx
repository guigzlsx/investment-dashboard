import { AppShell } from "../../../components/layout/app-shell";
import { AssetDetail } from "../../../components/assets/asset-detail";

export default async function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <AppShell description="Business, growth, valuation and risks in one readable view." title={symbol.toUpperCase()}><AssetDetail symbol={symbol.toUpperCase()} /></AppShell>;
}
