import { describe, expect, it } from "vitest";
import { parseImportDate } from "./date";

describe("portfolio import dates", () => {
  it("supports ISO, unambiguous day-first and Excel serial dates", () => {
    expect(parseImportDate("2026-01-15").value).toBe("2026-01-15T00:00:00.000Z");
    expect(parseImportDate("24/01/2026").value).toBe("2026-01-24T00:00:00.000Z");
    expect(parseImportDate(46037).value).toBe("2026-01-15T00:00:00.000Z");
  });

  it("does not silently choose an interpretation for ambiguous dates", () => {
    expect(parseImportDate("01/02/2026")).toEqual({ value: null, ambiguous: true });
  });
});
