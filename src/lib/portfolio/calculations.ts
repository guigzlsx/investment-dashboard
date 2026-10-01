import type { Currency, PortfolioSummary, PortfolioTransaction, PositionSummary } from "./types";

export interface FxRate {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  asOfDate: string;
  timestamp: string;
  source: string;
}

export interface PositionQuote {
  symbol: string;
  providerSymbol?: string;
  price: number | null;
  currency: Currency | null;
  change1D: number | null;
  provenance?: {
    source: string;
    timestamp: string;
    asOfDate: string | null;
    freshness: "FRESH" | "STALE" | "UNKNOWN";
  };
}

type PositionAccumulator = PositionSummary & {
  averageCostInQuote: number;
  mixedTransactionCurrencies: boolean;
};

export class PortfolioCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfolioCalculationError";
  }
}

function transactionKey(transaction: PortfolioTransaction) {
  return transaction.assetId ?? transaction.symbol.trim().toUpperCase();
}

function requireTradeValue(transaction: PortfolioTransaction) {
  if (!transaction.quantity || transaction.quantity <= 0 || transaction.unitPrice === null || transaction.unitPrice < 0) {
    throw new PortfolioCalculationError(`Invalid quantity or price for ${transaction.symbol}`);
  }
  return { quantity: transaction.quantity, unitPrice: transaction.unitPrice };
}

function getFxRate(transaction: PortfolioTransaction, baseCurrency: Currency) {
  if (transaction.currency === baseCurrency) {
    return 1;
  }
  if (!transaction.fxRateToBase || transaction.fxRateToBase <= 0) {
    throw new PortfolioCalculationError(`Missing FX rate for ${transaction.symbol} ${transaction.currency}/${baseCurrency}`);
  }
  return transaction.fxRateToBase;
}

/**
 * Rebuilds long-only positions from immutable transactions using weighted-average cost.
 * Fees are included in the cost basis. A SELL removes the current average cost
 * of the quantity sold and does not change the average cost of the remaining units.
 */
export function calculatePositions(
  transactions: PortfolioTransaction[],
  options: { baseCurrency?: Currency } = {},
): PositionSummary[] {
  const baseCurrency = options.baseCurrency ?? "EUR";
  const positions = new Map<string, PositionAccumulator>();

  for (const transaction of [...transactions].sort((left, right) => left.executedAt.localeCompare(right.executedAt))) {
    const key = transactionKey(transaction);
    const current = positions.get(key) ?? {
      assetId: transaction.assetId,
      symbol: transaction.symbol.trim().toUpperCase(),
      providerSymbol: transaction.providerSymbol ?? transaction.symbol.trim().toUpperCase(),
      providerSymbols: transaction.providerSymbols,
      exchange: transaction.exchange,
      name: transaction.name,
      assetType: transaction.assetType,
      assetCurrency: transaction.assetCurrency,
      sector: transaction.sector,
      country: transaction.country,
      themes: transaction.themes,
      quantity: 0,
      averagePrice: null,
      averagePriceCurrency: null,
      quoteCurrency: transaction.quoteCurrency ?? transaction.currency,
      transactionCurrencies: [],
      costBasis: 0,
      realizedPnl: 0,
      averageCostInQuote: 0,
      mixedTransactionCurrencies: false,
    };

    if (!current.transactionCurrencies.includes(transaction.currency)) {
      current.transactionCurrencies.push(transaction.currency);
    }

    const fxRate = getFxRate(transaction, baseCurrency);
    const trade = transaction.type === "BUY" || transaction.type === "SELL" ? requireTradeValue(transaction) : null;

    if (transaction.type === "BUY" && trade) {
      const totalCostBase = (trade.quantity * trade.unitPrice + transaction.fees) * fxRate;
      const transactionCurrency = transaction.currency;
      const averageCurrency = current.averagePriceCurrency;
      const mixedCurrencies = Boolean(averageCurrency && averageCurrency !== transactionCurrency);

      positions.set(key, {
        ...current,
        providerSymbol: transaction.providerSymbol ?? current.providerSymbol,
        providerSymbols: transaction.providerSymbols ?? current.providerSymbols,
        exchange: transaction.exchange ?? current.exchange,
        name: transaction.name ?? current.name,
        assetType: transaction.assetType ?? current.assetType,
        assetCurrency: transaction.assetCurrency ?? current.assetCurrency,
        sector: transaction.sector ?? current.sector,
        country: transaction.country ?? current.country,
        themes: transaction.themes ?? current.themes,
        quantity: current.quantity + trade.quantity,
        averagePriceCurrency: mixedCurrencies ? null : transactionCurrency,
        averagePrice: mixedCurrencies ? null : (current.averageCostInQuote + trade.quantity * trade.unitPrice + transaction.fees) / (current.quantity + trade.quantity),
        costBasis: current.costBasis + totalCostBase,
        averageCostInQuote: mixedCurrencies ? 0 : current.averageCostInQuote + trade.quantity * trade.unitPrice + transaction.fees,
        mixedTransactionCurrencies: current.mixedTransactionCurrencies || mixedCurrencies,
      });
      continue;
    }

    if (transaction.type === "SELL" && trade) {
      if (trade.quantity > current.quantity) {
        throw new PortfolioCalculationError(`Cannot sell more ${current.symbol} than currently held`);
      }

      const soldShare = current.quantity === 0 ? 0 : trade.quantity / current.quantity;
      const costRemovedBase = current.costBasis * soldShare;
      const quoteCostRemoved = current.averagePrice === null ? 0 : current.averagePrice * trade.quantity;
      const proceedsBase = trade.quantity * trade.unitPrice * fxRate;
      const feesBase = transaction.fees * fxRate;
      const nextQuantity = current.quantity - trade.quantity;
      const nextAveragePrice = current.averagePrice === null || nextQuantity === 0 ? current.averagePrice : current.averagePrice;

      positions.set(key, {
        ...current,
        quantity: nextQuantity,
        averagePrice: nextAveragePrice,
        costBasis: Math.max(0, current.costBasis - costRemovedBase),
        realizedPnl: current.realizedPnl + proceedsBase - costRemovedBase - feesBase,
        averageCostInQuote: Math.max(0, current.averageCostInQuote - quoteCostRemoved),
      });
      continue;
    }

    if (transaction.type !== "DIVIDEND" && transaction.type !== "SPLIT" && transaction.type !== "DEPOSIT" && transaction.type !== "WITHDRAWAL") {
      throw new PortfolioCalculationError(`Unsupported transaction type ${transaction.type}`);
    }
  }

  return [...positions.values()]
    .filter((position) => position.quantity > 0)
    .map((position) => ({
      assetId: position.assetId,
      symbol: position.symbol,
      providerSymbol: position.providerSymbol,
      providerSymbols: position.providerSymbols,
      exchange: position.exchange,
      name: position.name,
      assetType: position.assetType,
      assetCurrency: position.assetCurrency,
      sector: position.sector,
      country: position.country,
      themes: position.themes,
      quantity: position.quantity,
      averagePrice: position.averagePrice,
      averagePriceCurrency: position.averagePriceCurrency,
      quoteCurrency: position.quoteCurrency,
      transactionCurrencies: position.transactionCurrencies,
      costBasis: position.costBasis,
      realizedPnl: position.realizedPnl,
      currentPrice: position.currentPrice,
      currentValue: position.currentValue,
      unrealizedPnl: position.unrealizedPnl,
      unrealizedPnlPercent: position.unrealizedPnlPercent,
      weight: position.weight,
    }));
}

export function hasFxRate(fromCurrency: Currency, toCurrency: Currency, fxRates: FxRate[]) {
  if (fromCurrency === toCurrency) {
    return true;
  }
  const direct = fxRates.find((rate) => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency);
  if (direct) {
    return direct.rate > 0;
  }
  const inverse = fxRates.find((rate) => rate.fromCurrency === toCurrency && rate.toCurrency === fromCurrency);
  return Boolean(inverse && inverse.rate > 0);
}

function findFxRate(fromCurrency: Currency, toCurrency: Currency, fxRates: FxRate[]) {
  if (fromCurrency === toCurrency) return 1;
  const direct = fxRates.find((rate) => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency);
  if (direct) return direct.rate;
  const inverse = fxRates.find((rate) => rate.fromCurrency === toCurrency && rate.toCurrency === fromCurrency);
  return inverse ? 1 / inverse.rate : null;
}

export function valuePositions(
  positions: PositionSummary[],
  quotes: Map<string, PositionQuote>,
  fxRates: FxRate[],
  baseCurrency: Currency,
): PortfolioSummary {
  const investedCost = positions.reduce((total, position) => total + position.costBasis, 0);
  let complete = true;
  let currentValue = 0;
  let dailyChange = 0;
  const valuedPositions = positions.map((position) => {
    const quote = quotes.get(position.assetId ?? position.symbol);
    const fxRate = quote?.currency ? findFxRate(quote.currency, baseCurrency, fxRates) : null;

    if (!quote || quote.price === null || !quote.currency || fxRate === null) {
      complete = false;
      return { ...position, currentPrice: quote?.price ?? null, currentValue: null, unrealizedPnl: null, unrealizedPnlPercent: null, weight: null };
    }

    const positionValue = position.quantity * quote.price * fxRate;
    const positionDailyChange = quote.change1D === null ? null : position.quantity * quote.change1D * fxRate;
    currentValue += positionValue;
    if (positionDailyChange !== null) {
      dailyChange += positionDailyChange;
    }
    const unrealizedPnl = positionValue - position.costBasis;

    return {
      ...position,
      currentPrice: quote.price,
      currentValue: positionValue,
      unrealizedPnl,
      unrealizedPnlPercent: position.costBasis === 0 ? null : unrealizedPnl / position.costBasis,
      weight: null,
    };
  });

  const withWeights = valuedPositions.map((position) => ({
    ...position,
    weight: complete && currentValue > 0 && position.currentValue !== null ? position.currentValue / currentValue : null,
  }));

  return {
    baseCurrency,
    investedCost,
    currentValue: complete ? currentValue : null,
    pnl: complete ? currentValue - investedCost : null,
    performance: complete && investedCost > 0 ? (currentValue - investedCost) / investedCost : null,
    dailyChange: complete ? dailyChange : null,
    dataQuality: complete ? "COMPLETE" : positions.length === 0 ? "UNKNOWN" : "PARTIAL",
    positions: withWeights,
  };
}

export function summarizePortfolio(transactions: PortfolioTransaction[], options: { baseCurrency?: Currency } = {}): PortfolioSummary {
  const baseCurrency = options.baseCurrency ?? "EUR";
  const positions = calculatePositions(transactions, { baseCurrency });
  return valuePositions(positions, new Map(), [], baseCurrency);
}
