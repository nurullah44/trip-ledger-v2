import { formatMoney, type CurrencyCode } from "@/domain/money";
import { cn } from "@/lib/utils";

/**
 * Money in the receipt's tabular monospace. `signed` colours the value by
 * balance semantics: positive = owed money (success), negative = owes (danger).
 */
export function Money({
  minor,
  currency,
  signed = false,
  showPlus = false,
  className,
}: {
  minor: number;
  currency: CurrencyCode;
  signed?: boolean;
  showPlus?: boolean;
  className?: string;
}) {
  const tone = signed
    ? minor > 0
      ? "text-success"
      : minor < 0
        ? "text-destructive"
        : "text-muted-foreground"
    : undefined;
  const prefix = showPlus && minor > 0 ? "+" : "";
  return (
    <span className={cn("figure tabular-nums", tone, className)}>
      {prefix}
      {formatMoney(minor, currency)}
    </span>
  );
}
