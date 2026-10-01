import { describe, expect, it } from "vitest";
import { detectColumnMapping } from "./column-detector";
import { normalizeImportRows } from "./normalizer";

describe("portfolio import normalization", () => {
  it("detects French and English columns and preserves fractional shares", () => {
    const mapping = detectColumnMapping(["Date", "Action", "Instrument", "Qté", "Prix", "Devise", "Frais"]);
    const rows = normalizeImportRows([{ Date: "2026-01-15", Action: "Achat", Instrument: "NVIDIA", "Qté": "0,004", Prix: "180,50", Devise: "USD", Frais: "1,25" }], mapping);
    expect(rows[0]).toMatchObject({ transactionType: "BUY", quantity: 0.004, price: 180.5, fees: 1.25, currency: "USD", name: "NVIDIA" });
    expect(rows[0].status).toBe("READY");
  });

  it("marks unsupported operations explicitly", () => {
    const mapping = detectColumnMapping(["Date", "Type", "Ticker", "Quantity", "Price", "Currency"]);
    const [row] = normalizeImportRows([{ Date: "2026-01-15", Type: "DIVIDEND", Ticker: "NVDA", Quantity: "1", Price: "2", Currency: "USD" }], mapping);
    expect(row.status).toBe("UNSUPPORTED");
    expect(row.errors[0]).toContain("not supported");
  });
});
