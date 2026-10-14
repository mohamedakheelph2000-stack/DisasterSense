"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Menu,
  User,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useConfig } from "@/lib/api/config";
import { useAuth } from "@/lib/auth/auth-context";
import { useApi } from "@/hooks/use-api";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";


export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { isDemoMode } = useConfig();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDropdownOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  const { data: health, error: healthError } = useApi(
    () => apiClient<{ status: string; timestamp?: string }>("/health"),
    [],
    { refreshMs: 30_000, keepPreviousData: true }
  );

  const { data: alertFeed } = useApi(
    () =>
      apiClient<{ total: number }>("/alerts?status=active&page_size=1"),
    [user?.id],
    { refreshMs: 30_000, enabled: !!user }
  );

  const openAlerts = alertFeed?.total ?? 0;
  const apiOnline = !!health && !healthError;

  const dateLabel = now
    ? now.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
  const timeLabel = now
    ? now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "";

  const initials = (user?.full_name || user?.email || "OP")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/70 px-4 backdrop-blur-xl md:px-6">
      {/* Left cluster */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {isDemoMode && (
          <span className="rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
            Demo Mode
          </span>
        )}

        {now && (
          <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
            <span>{dateLabel}</span>
            <span className="text-foreground/25">·</span>
            <span className="font-mono text-foreground/60 tabular-nums">{timeLabel}</span>
          </div>
        )}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2 md:gap-3">
        <Link
          href="/alerts"
          className="group relative flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-foreground/70 transition-colors hover:border-danger/40 hover:text-foreground"
        >
          <Bell className="h-4 w-4 transition-transform group-hover:-rotate-12" />
          <span className="hidden font-mono text-[11px] tabular-nums sm:inline">
            {openAlerts}
          </span>
          {openAlerts > 0 && (
            <motion.span
              key={openAlerts}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[9px] font-bold leading-none text-white shadow-[0_0_10px_hsl(var(--critical)/0.7)]"
            >
              {openAlerts > 99 ? "99+" : openAlerts}
            </motion.span>
          )}
        </Link>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-muted/60 pl-1.5 pr-2 transition-colors hover:border-primary/40"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 font-mono text-[10px] font-bold text-primary">
              {initials || <User className="h-3.5 w-3.5" />}
            </span>
            <span className="hidden max-w-[9rem] truncate text-xs text-foreground/75 md:inline">
              {user?.full_name || user?.email}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-foreground/50 transition-transform duration-300",
                dropdownOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="panel absolute right-0 mt-2 w-64 origin-top-right overflow-hidden p-0"
              >
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user?.full_name || "Operator"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      {user?.role || "citizen"}
                    </Badge>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      ACTIVE
                    </span>
                  </div>
                </div>

                <div className="p-1.5">
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground/75 transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Preferences
                  </Link>
                </div>

                <div className="border-t border-border p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

