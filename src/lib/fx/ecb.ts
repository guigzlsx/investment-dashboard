import { withMemoryCache } from "../market-data/cache";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { Currency } from "../portfolio/types";
import type { FxRate } from "../portfolio/calculations";

const ECB_BASE_URL = "https://data-api.ecb.europa.eu/service/data/EXR/";

class EcbFxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EcbFxError";
  }
}

function parseCsvRow(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new EcbFxError("ECB returned no FX observation");
  const headers = lines[0].split(",");
  const values = lines[lines.length - 1].split(",");
  return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
}

async function fetchEurRate(currency: Exclude<Currency, "EUR">) {
  const url = new URL(`D.${currency}.EUR.SP00.A`, ECB_BASE_URL);
  url.searchParams.set("lastNObservations", "1");
  url.searchParams.set("format", "csvdata");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new EcbFxError(`ECB returned HTTP ${response.status}`);
  const row = parseCsvRow(await response.text());
  const value = Number(row.OBS_VALUE);
  if (!Number.isFinite(value) || value <= 0 || !row.TIME_PERIOD) throw new EcbFxError(`ECB returned an invalid ${currency}/EUR rate`);
  return { ratePerEur: value, asOfDate: row.TIME_PERIOD };
}

async function readPersistentEurRate(currency: Exclude<Currency, "EUR">) {
  try {
    const admin = createSupabaseAdminClient();
    const result = await admin.from("fx_rates").select("rate, as_of_date, fetched_at").eq("from_currency", currency).eq("to_currency", "EUR").eq("source", "ECB").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error || !result.data || Date.now() - new Date(String(result.data.fetched_at)).getTime() > 24 * 60 * 60_000) return null;
    const rate = Number(result.data.rate);
    return Number.isFinite(rate) && rate > 0 ? { ratePerEur: rate, asOfDate: String(result.data.as_of_date) } : null;
  } catch {
    return null;
  }
}

export class EcbFxRateProvider {
  async getRates(currencies: Currency[], baseCurrency: Currency): Promise<FxRate[]> {
    const uniqueCurrencies = [...new Set([...currencies, baseCurrency])].filter((currency) => currency !== "EUR");
    const toEur = new Map<Currency, { ratePerEur: number; asOfDate: string }>();
    for (const currency of uniqueCurrencies) {
      const value = await withMemoryCache(`ecb:${currency}:EUR`, 24 * 60 * 60_000, async () => (await readPersistentEurRate(currency)) ?? fetchEurRate(currency));
      toEur.set(currency, value);
    }

    return [...new Set(currencies)].flatMap((fromCurrency) => {
      const rate = this.convertRate(fromCurrency, baseCurrency, toEur);
      return rate ? [{ fromCurrency, toCurrency: baseCurrency, rate: rate.rate, asOfDate: rate.asOfDate, timestamp: new Date().toISOString(), source: "ECB" }] : [];
    });
  }

  private convertRate(fromCurrency: Currency, toCurrency: Currency, toEur: Map<Currency, { ratePerEur: number; asOfDate: string }>) {
    if (fromCurrency === toCurrency) return { rate: 1, asOfDate: new Date().toISOString().slice(0, 10) };
    const from = fromCurrency === "EUR" ? { ratePerEur: 1, asOfDate: new Date().toISOString().slice(0, 10) } : toEur.get(fromCurrency);
    const to = toCurrency === "EUR" ? { ratePerEur: 1, asOfDate: new Date().toISOString().slice(0, 10) } : toEur.get(toCurrency);
    if (!from || !to) return null;
    return { rate: from.ratePerEur / to.ratePerEur, asOfDate: from.asOfDate < to.asOfDate ? from.asOfDate : to.asOfDate };
  }
}

let provider: EcbFxRateProvider | undefined;

export function getEcbFxRateProvider() {
  provider ??= new EcbFxRateProvider();
  return provider;
}
