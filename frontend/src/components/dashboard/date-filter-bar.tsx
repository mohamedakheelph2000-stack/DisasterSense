"use client";

import React, { useState, useEffect } from "react";
import { Calendar, RefreshCw, Clock } from "lucide-react";
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
  const [countdown, setCountdown] = useState(10);
  const isLive = !selectedDate;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 10-second countdown timer for auto-refresh in Live mode
  useEffect(() => {
    if (!isLive) return;

    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive, lastSyncTime]);

  const todayStr = mounted ? new Date().toISOString().split("T")[0] : "";
  const yesterdayStr = mounted ? new Date(Date.now() - 86400000).toISOString().split("T")[0] : "";

  return (
    <div className="bg-surface/80 border border-border/70 backdrop-blur-md rounded-2xl p-4 mb-6 shadow-lg transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Mode Title & Quick Date Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2 mr-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm text-foreground">Disaster Timeline:</span>
          </div>

          {/* Live Mode Toggle */}
          <Button
            size="sm"
            variant={isLive ? "default" : "outline"}
            onClick={() => onDateChange("")}
            className={`rounded-full px-3 text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isLive
                ? "bg-success hover:bg-success/90 text-success-foreground shadow-sm"
                : "border-border/80 hover:bg-surface-muted"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLive ? 'bg-white' : 'bg-success'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-white' : 'bg-success'}`}></span>
            </span>
            Real-Time Live
          </Button>

          {/* Today Button */}
          {todayStr && (
            <Button
              size="sm"
              variant={selectedDate === todayStr ? "secondary" : "ghost"}
              onClick={() => onDateChange(todayStr)}
              className="rounded-full px-3 text-xs"
            >
              Today ({todayStr})
            </Button>
          )}

          {/* Yesterday Button */}
          {yesterdayStr && (
            <Button
              size="sm"
              variant={selectedDate === yesterdayStr ? "secondary" : "ghost"}
              onClick={() => onDateChange(yesterdayStr)}
              className="rounded-full px-3 text-xs"
            >
              Yesterday
            </Button>
          )}

          {/* Custom Date Picker */}
          <div className="flex items-center space-x-1.5 bg-surface-muted/60 border border-border rounded-full px-3 py-1 text-xs">
            <span className="text-foreground/60">Pick Date:</span>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer font-mono"
            />
          </div>
        </div>

        {/* Right: Sync Status & Manual Refresh */}
        <div className="flex items-center space-x-3 self-end lg:self-center">
          {isLive ? (
            <div className="flex items-center space-x-2 text-xs bg-success/10 border border-success/30 px-3 py-1.5 rounded-full text-success">
              <Clock className="w-3.5 h-3.5" />
              <span>Next 10s sync in:</span>
              <span className="font-mono font-bold w-4 text-center">{countdown}s</span>
              {lastUpdated && (
                <span className="hidden font-mono text-[10px] text-foreground/50 sm:inline">
                  · fetch {new Date(lastUpdated).toLocaleTimeString("en-GB", { hour12: false })}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs bg-warning/10 border border-warning/30 px-3 py-1.5 rounded-full text-warning">
              <Clock className="w-3.5 h-3.5" />
              <span>Showing Archived Events for: <strong>{selectedDate}</strong></span>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onRefreshNow}
            disabled={isRefreshing}
            className="rounded-full px-3 text-xs border-border/80 hover:bg-surface-muted flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            <span>{isRefreshing ? "Syncing..." : "Sync Now"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
