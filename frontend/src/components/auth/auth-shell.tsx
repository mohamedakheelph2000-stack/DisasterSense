"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldAlert, WifiOff, Activity } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api/client";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

/**
 * Shared immersive shell for /login and /register: a mission panel on the left,
 * the form on the right, and a live backend status probe so an unreachable API
 * is visible before anyone tries to sign in.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const { data: health, error } = useApi(
    () => apiClient<{ status: string; app_name?: string }>("/health"),
    [],
    { refreshMs: 15_000 }
  );

  const online = !!health && !error;
  const unreachable = error instanceof ApiError && error.isNetworkError;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute -bottom-52 right-[-10%] h-[480px] w-[480px] rounded-full bg-accent/20 blur-[150px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--grid)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--grid)/0.5)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* Mission panel */}
        <motion.section
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:block"
        >
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
              <ShieldAlert className="h-6 w-6 text-primary" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-blink rounded-full bg-success shadow-[0_0_10px_hsl(var(--success))]" />
            </span>
            <span>
              <span className="block text-base font-semibold tracking-[0.18em] text-foreground">
                DISASTERSENSE
              </span>
              <span className="hud-label">Operations Console</span>
            </span>
          </Link>

          <h1 className="mt-10 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground xl:text-5xl">
            Flood and landslide intelligence,
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              running 24/7.
            </span>
          </h1>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            KSDMA and IMD bulletins ingested every 10 seconds, real Open-Meteo telemetry
            scored by trained models, and alerts dispatched with full feature-level
            explanations.
          </p>

          {/* Live radar */}
          <div className="mt-10 flex items-center gap-5">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-primary/30 bg-surface/70">
              <span className="absolute inset-0 bg-radar-sweep animate-sweep" />
              <span className="absolute inset-3 rounded-full border border-primary/20" />
              <span className="absolute inset-7 rounded-full border border-primary/25" />
              <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
            </div>
            <div className="space-y-2">
              <Legend dot="bg-success" label="Live telemetry ingest" value="10s cadence" />
              <Legend dot="bg-primary" label="Model inference" value="real trained weights" />
              <Legend dot="bg-accent" label="Alert dispatch" value="email + SMS channels" />
            </div>
          </div>

          <div
            className={cn(
              "mt-10 inline-flex items-center gap-2.5 rounded-lg border px-3.5 py-2",
              online
                ? "border-success/30 bg-success/10"
                : unreachable
                  ? "border-warning/30 bg-warning/10"
                  : "border-border bg-surface/70"
            )}
          >
            {online ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
            ) : unreachable ? (
              <WifiOff className="h-3.5 w-3.5 text-warning" />
            ) : (
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/75">
              {online
                ? "API linked · backend healthy"
                : unreachable
                  ? "API unreachable · start backend"
                  : "API status unavailable"}
            </span>
          </div>
        </motion.section>

        {/* Form panel */}
        <motion.section
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          <div className="panel panel-accent relative mx-auto w-full max-w-md overflow-hidden p-7 sm:p-9">
            <div className="mb-7 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
                <ShieldAlert className="h-5 w-5 text-primary" />
              </span>
            </div>

            <p className="eyebrow mb-2">Secure access</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

            <div className="mt-7">{children}</div>
          </div>

          {footer && (
            <div className="mx-auto mt-5 max-w-md text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

function Legend({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
      <span className="text-xs text-foreground/70">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
    >
      {message}
    </motion.p>
  );
}
