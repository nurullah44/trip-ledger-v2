import { Link } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Warm, centered page frame used by every screen. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-screen">
      <div className={cn("mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10", className)}>
        {children}
      </div>
    </div>
  );
}

/** The Trip Ledger wordmark. Links home unless told otherwise. */
export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 text-foreground">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow">
        <Receipt className="size-5" />
      </span>
      <span className="text-lg font-bold tracking-tight">Trip Ledger</span>
    </Link>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}
