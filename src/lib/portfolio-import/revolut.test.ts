import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectColumnMapping } from "./column-detector";
import { parseImportFile } from "./parser";
import { detectImportPreset } from "./presets";
import { normalizeImportRows } from "./normalizer";
import { parseImportMoney } from "./number";
import { markImportDuplicates } from "./validator";
import type { PortfolioTransaction } from "../portfolio/types";

const fixture = readFileSync(new URL("./fixtures/revolut-brokerage.csv", import.meta.url));

describe("Revolut Brokerage preset", () => {
  it("detects the real export shape and keeps only security transactions in preview", async () => {
    const parsed = await parseImportFile("revolut-brokerage.csv", fixture);
    const sheet = parsed.sheets[0];
    const preset = detectImportPreset(sheet.columns);
    const mapping = detectColumnMapping(sheet.columns, preset);
    const rows = normalizeImportRows(sheet.rows, mapping, { preset });

    expect(preset?.label).toBe("Revolut Brokerage");
    expect(mapping["Price per share"]).toBe("price");
    expect(mapping["FX Rate"]).toBe("fxRateToBase");
    expect(rows.filter((row) => row.status === "IGNORED")).toHaveLength(3);
    expect(rows.filter((row) => row.status !== "IGNORED")).toHaveLength(7);
    expect(rows.filter((row) => row.status !== "IGNORED").every((row) => row.status === "READY")).toBe(true);
  });

  it("normalizes Revolut order types, money prefixes, fractional shares and FX", async () => {
    const parsed = await parseImportFile("revolut-brokerage.csv", fixture);
    const sheet = parsed.sheets[0];
    const preset = detectImportPreset(sheet.columns);
    const rows = normalizeImportRows(sheet.rows, detectColumnMapping(sheet.columns, preset), { preset }).filter((row) => row.status !== "IGNORED");
    const nvda = rows.find((row) => row.symbol === "NVDA");

    expect(nvda).toMatchObject({ transactionType: "BUY", quantity: 0.42945265, price: 230.2, currency: "USD", fxRateToBase: 1.1355, status: "READY" });
    expect(rows.find((row) => row.transactionType === "SELL")).toMatchObject({ symbol: "NVDA", transactionType: "SELL", status: "READY" });
    expect(parseImportMoney("USD 230.20")).toEqual({ value: 230.2, ambiguous: false, currency: "USD" });
    expect(rows.find((row) => row.symbol === "VUAA")?.currency).toBe("EUR");
  });

  it("still protects against importing the same Revolut row twice", async () => {
    const parsed = await parseImportFile("revolut-brokerage.csv", fixture);
    const sheet = parsed.sheets[0];
    const preset = detectImportPreset(sheet.columns);
    const rows = normalizeImportRows(sheet.rows, detectColumnMapping(sheet.columns, preset), { preset }).filter((row) => row.status !== "IGNORED");
    rows.forEach((row, index) => { row.assetId = `asset-${index}`; row.name = row.symbol; });
    const existing = rows.map((row) => ({ assetId: row.assetId, symbol: row.symbol ?? "", type: row.transactionType, quantity: row.quantity, unitPrice: row.price, currency: row.currency, executedAt: row.transactionDate } as PortfolioTransaction));
    markImportDuplicates(rows, existing);
    expect(rows.every((row) => row.possibleDuplicate)).toBe(true);
  });
});
