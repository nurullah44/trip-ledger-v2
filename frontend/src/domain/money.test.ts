import { describe, expect, it } from "vitest";
import { formatMoney, minorToInput, parseAmountToMinor, splitEqually } from "./money";

describe("parseAmountToMinor", () => {
  it("parses decimals into minor units", () => {
    expect(parseAmountToMinor("10.25", "USD")).toBe(1025);
    expect(parseAmountToMinor("7", "USD")).toBe(700);
    expect(parseAmountToMinor("0.5", "EUR")).toBe(50);
    expect(parseAmountToMinor("10,25", "TRY")).toBe(1025);
  });

  it("respects zero-decimal currencies", () => {
    expect(parseAmountToMinor("1200", "JPY")).toBe(1200);
    expect(parseAmountToMinor("12.5", "JPY")).toBeNull();
  });

  it("rejects junk and over-precise input", () => {
    expect(parseAmountToMinor("", "USD")).toBeNull();
    expect(parseAmountToMinor("abc", "USD")).toBeNull();
    expect(parseAmountToMinor("-5", "USD")).toBeNull();
    expect(parseAmountToMinor("1.234", "USD")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats with symbol and fixed decimals", () => {
    expect(formatMoney(1025, "USD")).toBe("$10.25");
    expect(formatMoney(-4200, "EUR")).toBe("-€42.00");
    expect(formatMoney(1200, "JPY")).toBe("¥1200");
    expect(minorToInput(305, "USD")).toBe("3.05");
  });
});

describe("splitEqually", () => {
  it("distributes remainder deterministically and sums exactly", () => {
    expect(splitEqually(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEqually(9000, 3)).toEqual([3000, 3000, 3000]);
    expect(splitEqually(1001, 4)).toEqual([251, 250, 250, 250]);
  });

  it("always sums back to the total", () => {
    for (let total = 0; total < 200; total++) {
      for (let n = 1; n <= 7; n++) {
        const parts = splitEqually(total, n);
        expect(parts).toHaveLength(n);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it("returns nothing for zero people", () => {
    expect(splitEqually(500, 0)).toEqual([]);
  });
});
