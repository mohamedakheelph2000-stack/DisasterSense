"use client";

import { useState, useEffect } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DateFilterBarProps {
  selectedDate: string; // YYYY-MM-DD or "" for live
  onDateChange: (date: string) => void;
  onRefreshNow: () => void;
  isRefreshing: boolean;
  lastSyncTime: string;
  /** ISO timestamp of the most recent successful dashboard fetch. */
  lastUpdated?: string;
}

export function DateFilterBar({
  selectedDate,
  onDateChange,
  onRefreshNow,
  isRefreshing,
  lastSyncTime,
  lastUpdated,
}: DateFilterBarProps) {
  const [mounted, setMounted] = useState(false);
  const isLive = !selectedDate;

  useEffect(() => {
    setMounted(true);
  }, []);

  const todayStr = mounted ? new Date().toISOString().split("T")[0] : "";
  const yesterdayStr = mounted ? new Date(Date.now() - 86400000).toISOString().split("T")[0] : "";

  const formattedUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : lastSyncTime
      ? new Date(lastSyncTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : null;

  return (
    <div className="mb-6 rounded-xl border border-border/70 bg-surface/50 p-3.5 backdrop-blur-sm transition-all">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Quick Date Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="h-4 w-4 text-foreground/60" />
            <span>Timeline:</span>
          </div>

          {/* Live Mode Toggle */}
          <Button
            size="sm"
            variant={isLive ? "default" : "outline"}
            onClick={() => onDateChange("")}
            className={`h-8 rounded-lg px-3 text-xs font-medium transition-all ${
              isLive
                ? "bg-primary text-primary-foreground shadow-none hover:bg-primary/90"
                : "border-border hover:bg-surface-muted text-foreground/75"
            }`}
          >
            Live
          </Button>

          {/* Today Button */}
          {todayStr && (
            <Button
              size="sm"
              variant={selectedDate === todayStr ? "secondary" : "ghost"}
              onClick={() => onDateChange(todayStr)}
              className="h-8 rounded-lg px-3 text-xs font-medium text-foreground/75 hover:text-foreground"
            >
              Today
            </Button>
          )}

          {/* Yesterday Button */}
          {yesterdayStr && (
            <Button
              size="sm"
              variant={selectedDate === yesterdayStr ? "secondary" : "ghost"}
              onClick={() => onDateChange(yesterdayStr)}
              className="h-8 rounded-lg px-3 text-xs font-medium text-foreground/75 hover:text-foreground"
            >
              Yesterday
            </Button>
          )}

          {/* Custom Date Picker */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-muted/50 px-2.5 text-xs text-foreground/70">
            <span className="text-[11px] text-muted-foreground">Date:</span>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => onDateChange(e.target.value)}
              className="cursor-pointer bg-transparent font-mono text-xs text-foreground focus:outline-none"
            />
          </div>
        </div>

        {/* Right: Subtle Last Updated Timestamp & Refresh Button */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          {isLive ? (
            formattedUpdated && (
              <span className="text-xs text-muted-foreground">
                Last updated: <span className="font-mono text-foreground/75">{formattedUpdated}</span>
              </span>
            )
          ) : (
            <span className="text-xs text-warning">
              Archived: <span className="font-mono font-medium">{selectedDate}</span>
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onRefreshNow}
            disabled={isRefreshing}
            className="h-8 gap-1.5 rounded-lg border-border px-3 text-xs font-medium hover:bg-surface-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
