import { describe, expect, it } from "vitest";
import { resolveProviderSymbol } from "./symbols";

describe("provider symbol resolver", () => {
  it("prefers explicit provider symbols", () => {
    expect(resolveProviderSymbol({ symbol: "VUAA.DE", providerSymbols: { EODHD: "VUAA.XETRA", FMP: "VUAA.DE" } }, "EODHD")).toBe("VUAA.XETRA");
  });

  it("uses only validated VUAA listings", () => {
    expect(resolveProviderSymbol({ symbol: "VUAA.DE" }, "EODHD")).toBe("VUAA.XETRA");
    expect(resolveProviderSymbol({ symbol: "VUAA.L" }, "EODHD")).toBe("VUAA.LSE");
    expect(resolveProviderSymbol({ symbol: "VUAA.MI" }, "EODHD")).toBeNull();
  });

  it("adds the US suffix only for an explicitly identified US exchange", () => {
    expect(resolveProviderSymbol({ symbol: "NVDA", exchange: "NASDAQ" }, "EODHD")).toBe("NVDA.US");
    expect(resolveProviderSymbol({ symbol: "NVDA" }, "EODHD")).toBeNull();
    expect(resolveProviderSymbol({ symbol: "VUAA.MI", exchange: "MIL", currency: "EUR" }, "EODHD")).toBeNull();
  });
});
