"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/animations/motion";

interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Small monospace label rendered above the title, e.g. "RISK INDEX". */
  label?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Thin animated accent line along the top edge. */
  accent?: boolean;
  hoverGlow?: boolean;
  /** Wrap content in a staggered reveal. */
  reveal?: boolean;
  bodyClassName?: string;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      label,
      title,
      description,
      actions,
      accent,
      hoverGlow,
      reveal = true,
      className,
      bodyClassName,
      children,
      ...props
    },
    ref
  ) => {
    const header = label || title || description || actions;
    const body = (
      <div
        ref={ref}
        className={cn(
          "panel relative overflow-hidden",
          accent && "panel-accent",
          hoverGlow && "panel-glow",
          className
        )}
        {...props}
      >
        {header && (
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div className="min-w-0">
              {label && <p className="eyebrow mb-1.5">{label}</p>}
              {title && (
                <h3 className="truncate text-sm font-semibold tracking-tight text-foreground/90">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )}
        <div className={cn("p-5", bodyClassName)}>{children}</div>
      </div>
    );

    return reveal ? <Reveal>{body}</Reveal> : body;
  }
);
Panel.displayName = "Panel";

/** Full-bleed panel variant: no internal padding, children own the layout. */
export function FlushPanel({ children, ...props }: PanelProps) {
  return <Panel bodyClassName="p-0" {...props}>{children}</Panel>;
}
