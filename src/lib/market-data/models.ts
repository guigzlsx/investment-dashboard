import type { AssetType, Currency } from "../portfolio/types";

export type DataKind = "REALTIME" | "DELAYED" | "EOD" | "UNKNOWN";
export type DataFreshness = "FRESH" | "STALE" | "UNKNOWN";

export interface DataProvenance {
  source: string;
  sourceEndpoint: string;
  timestamp: string;
  asOfDate: string | null;
  dataKind: DataKind;
  freshness: DataFreshness;
}

export interface Asset {
  id?: string;
  symbol: string;
  name: string;
  exchange: string | null;
  exchangeName: string | null;
  currency: Currency | null;
  assetType: AssetType | null;
  country: string | null;
  sector: string | null;
  industry: string | null;
  logoUrl: string | null;
  provenance: DataProvenance;
}

export interface Quote {
  symbol: string;
  price: number | null;
  currency: Currency | null;
  change1D: number | null;
  change1DPercent: number | null;
  marketCap: number | null;
  volume: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  provenance: DataProvenance;
}

export interface HistoricalPrice {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  currency: Currency | null;
  provenance: DataProvenance;
}

export interface CompanyProfile {
  symbol: string;
  name: string | null;
  description: string | null;
  website: string | null;
  country: string | null;
  sector: string | null;
  industry: string | null;
  employees: number | null;
  provenance: DataProvenance;
}

export interface FinancialStatement {
  symbol: string;
  period: string;
  periodEnd: string | null;
  reportedCurrency: Currency | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  cash: number | null;
  provenance: DataProvenance;
}

export interface KeyMetrics {
  symbol: string;
  period: string | null;
  periodEnd: string | null;
  marketCap: number | null;
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  priceToSales: number | null;
  evToEbitda: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  fcfYield: number | null;
  roic: number | null;
  roe: number | null;
  provenance: DataProvenance;
}
