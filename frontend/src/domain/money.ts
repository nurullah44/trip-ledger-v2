/**
 * Money is always handled as integer minor units (cents) — never floats.
 */

export type CurrencyCode = "USD" | "EUR" | "TRY" | "GBP" | "JPY";

export interface CurrencyDef {
  code: CurrencyCode;
  symbol: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  USD: { code: "USD", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", decimals: 2 },
  TRY: { code: "TRY", symbol: "₺", decimals: 2 },
  GBP: { code: "GBP", symbol: "£", decimals: 2 },
  JPY: { code: "JPY", symbol: "¥", decimals: 0 },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

export function currencyDef(code: CurrencyCode): CurrencyDef {
  return CURRENCIES[code] ?? CURRENCIES.USD;
}

function pow10(n: number): number {
  let r = 1;
  for (let i = 0; i < n; i++) r *= 10;
  return r;
}

/** Parse user input ("10.25", "10,25", " 7 ") into minor units. Returns null when invalid. */
export function parseAmountToMinor(raw: string, code: CurrencyCode): number | null {
  const decimals = currencyDef(code).decimals;
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  if (!/^\d*(\.\d*)?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  if (frac.length > decimals) return null;
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const minor = Number(whole || "0") * pow10(decimals) + Number(padded || "0");
  if (!Number.isFinite(minor)) return null;
  return minor;
}

/** Render minor units for an input field, without the currency symbol. */
export function minorToInput(minor: number, code: CurrencyCode): string {
  const decimals = currencyDef(code).decimals;
  if (decimals === 0) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const div = pow10(decimals);
  return `${sign}${Math.floor(abs / div)}.${String(abs % div).padStart(decimals, "0")}`;
}

/** Render minor units with currency symbol, e.g. "$10.25". */
export function formatMoney(minor: number, code: CurrencyCode): string {
  const def = currencyDef(code);
  const sign = minor < 0 ? "-" : "";
  return `${sign}${def.symbol}${minorToInput(Math.abs(minor), code)}`;
}

/**
 * Divide a total into `count` shares as evenly as possible.
 * Remainder minor units are handed out deterministically to the first shares,
 * so the result always sums back to `total`.
 */
export function splitEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.trunc(total / count);
  let remainder = total - base * count;
  const step = remainder >= 0 ? 1 : -1;
  remainder = Math.abs(remainder);
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? step : 0));
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
