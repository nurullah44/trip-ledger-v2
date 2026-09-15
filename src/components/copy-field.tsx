import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A read-only link with a copy-to-clipboard button. */
export function CopyField({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(label ? `${label} copied` : "Link copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select the link and copy manually.");
    }
  };

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="figure min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground"
      />
      <Button type="button" variant="secondary" size="sm" onClick={copy} className="shrink-0">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
