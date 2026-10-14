"use client";

import * as React from "react";
import Link from "next/link";
import { AlertOctagon, Inbox, Lock, RefreshCw, WifiOff, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ApiError, errorMessage } from "@/lib/api/client";

/* ------------------------------------------------------------------ loading */

export function LoadingGrid({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="panel p-5" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-4 h-7 w-40" />
          <div className="skeleton mt-3 h-3 w-full max-w-md" />
        </div>
      ))}
    </div>
  );
}

export function LoadingPanel({ label = "Loading feed…" }: { label?: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-4 p-10 text-center">
      <span className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="h-2 w-2 rounded-full bg-primary" />
      </span>
      <p className="eyebrow">{label}</p>
    </div>
  );
}

export function SkeletonBlocks({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel p-4">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton mt-3 h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- empty */

export function EmptyState({
  title = "No records",
  description,
  icon,
  action,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <p className="text-sm font-medium text-foreground/85">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------- error */

export function ErrorState({
  error,
  onRetry,
  title,
  compact,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
  className?: string;
}) {
  const isNetwork = error instanceof ApiError && error.isNetworkError;
  const isForbidden = error instanceof ApiError && error.isForbidden;
  const isAuth = error instanceof ApiError && error.isUnauthorized;
  const message = errorMessage(error);

  const heading =
    title ??
    (isNetwork
      ? "API unreachable"
      : isForbidden
        ? "Access denied"
        : isAuth
          ? "Session expired"
          : "Request failed");

  const Icon = isNetwork ? WifiOff : isAuth || isForbidden ? Lock : AlertOctagon;
  const tone = isNetwork || isAuth || isForbidden ? "warning" : "danger";

  return (
    <div
      role="alert"
      className={cn(
        "panel relative overflow-hidden",
        compact ? "flex items-start gap-3 p-4" : "flex flex-col items-center gap-3 px-6 py-10 text-center",
        tone === "danger" ? "border-danger/30" : "border-warning/30",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          tone === "danger" ? "bg-danger/70" : "bg-warning/70"
        )}
      />
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          tone === "danger"
            ? "border-danger/25 bg-danger/10 text-danger"
            : "border-warning/25 bg-warning/10 text-warning"
        )}
      >
        <Icon className={cn("h-4 w-4", !compact && "animate-pulse")} />
      </span>

      <div className={compact ? "min-w-0 flex-1" : "flex flex-col items-center gap-1"}>
        <p className="text-sm font-semibold text-foreground/90">{heading}</p>
        <p className={cn("font-mono text-xs leading-relaxed text-muted-foreground", compact ? "mt-1 break-words" : "max-w-md")}>
          {message}
        </p>
        {!compact && isNetwork && (
          <p className="mt-3 max-w-md text-[11px] text-muted-foreground/80">
            The command centre only renders live data — nothing here is simulated or cached
            from a previous session.
          </p>
        )}
        {onRetry && (
          <div className={cn("mt-4", compact && "mt-2")}>
            <Button size="sm" variant="outline" onClick={onRetry} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Inline banner variant for pages that can still render partial data. */
export function ErrorBanner({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <ErrorState error={error} onRetry={onRetry} compact className={className} />
  );
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={<Lock className="h-5 w-5" />}
      title="Restricted area"
      description={
        message ??
        "Your current role does not grant access to this console. Switch accounts or ask an administrator for clearance."
      }
      action={
        <Link
          href="/"
          className="group mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Return to dashboard
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      }
    />
  );
}
