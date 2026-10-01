import { describe, expect, it } from "vitest";
import { parseImportNumber } from "./number";

describe("portfolio import numbers", () => {
  it.each([["1,234.56", 1234.56], ["1 234,56", 1234.56], ["1234,56", 1234.56], ["1234.56", 1234.56], ["1,25", 1.25], ["0.004", 0.004]])("parses %s as %s", (input, expected) => {
    expect(parseImportNumber(input).value).toBe(expected);
  });

  it("keeps invalid values unknown", () => {
    expect(parseImportNumber("not a number").value).toBeNull();
  });
});
