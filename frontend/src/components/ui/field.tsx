import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
