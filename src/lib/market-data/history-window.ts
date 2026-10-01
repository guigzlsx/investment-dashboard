import type { HistoricalPriceQuery } from "./provider";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Converts legacy limit-only callers into a bounded network window. */
export function boundedHistoryQuery(query: HistoricalPriceQuery = {}): HistoricalPriceQuery {
  if (query.from || query.to) return query;
  if (!query.limit) return query;
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - Math.max(query.limit * 2, query.limit + 30));
  return { from: isoDate(from), to: isoDate(to), limit: query.limit };
}
