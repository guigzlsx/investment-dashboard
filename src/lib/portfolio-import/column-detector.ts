import type { ImportColumnField, ImportColumnMapping } from "./types";

const synonyms: Record<Exclude<ImportColumnField, "ignore">, string[]> = {
  ticker: ["ticker", "symbol", "instrument ticker", "code", "valeur"],
  isin: ["isin", "isin code", "security isin"],
  name: ["instrument", "asset", "security", "security name", "name", "asset name", "nom", "libelle", "libellé", "designation", "désignation"],
  exchange: ["exchange", "market", "venue", "place", "marche", "marché"],
  transactionType: ["type", "side", "action", "transaction type", "operation", "opération", "sens"],
  quantity: ["quantity", "qty", "qte", "shares", "units", "amount", "quantite", "quantité", "titres", "unites", "unités"],
  price: ["price", "unit price", "execution price", "trade price", "prix", "prix unitaire", "cours"],
  currency: ["currency", "ccy", "currency code", "devise", "monnaie"],
  fxRateToBase: ["fx rate", "fx rate to base", "exchange rate", "conversion rate", "taux de change", "taux fx"],
  fees: ["fees", "fee", "commission", "commissions", "costs", "frais", "commission"],
  date: ["date", "execution date", "transaction date", "trade date", "settlement date", "date operation", "date opération"],
};

function clean(value: string) {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function detectColumnMapping(columns: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = Object.fromEntries(columns.map((column) => [column, "ignore"]));
  const used = new Set<ImportColumnField>();
  for (const column of columns) {
    const normalized = clean(column);
    const match = (Object.entries(synonyms) as Array<[Exclude<ImportColumnField, "ignore">, string[]]>).find(([field, values]) => !used.has(field) && values.some((value) => normalized === clean(value) || normalized.includes(clean(value))));
    if (match) { mapping[column] = match[0]; used.add(match[0]); }
  }
  return mapping;
}

export function normalizeColumnField(value: string) {
  return clean(value);
}
