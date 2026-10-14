"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Droplets,
  Mountain,
  Newspaper,
  ExternalLink,
  Search,
  Compass,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/animations/fade-in";

export interface KeralaLocationState {
  id: number;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  description: string;
  hazard_type: string;
  risk_score: number;
  risk_level: string;
  rainfall_24h_mm: number;
  rainfall_intensity_mm_h: number;
  temperature_c: number;
  humidity_pct: number;
  wind_speed_kmh?: number;
  matched_news?: {
    title: string;
    source: string;
    link: string;
    pubDate: string;
  };
  last_updated: string;
}

export interface KeralaNewsItem {
  title: string;
  source: string;
  link: string;
  pubDate: string;
  district?: string;
  hazard?: string;
}

interface KeralaRiskRadarProps {
  locations: KeralaLocationState[];
  newsFeed: KeralaNewsItem[];
  overallRisk: { score: number; level: string };
  lastSync: string;
  loading: boolean;
  onSelectLocation?: (loc: KeralaLocationState) => void;
}

export function KeralaRiskRadar({
  locations,
  newsFeed,
  overallRisk,
  lastSync,
  loading,
  onSelectLocation,
}: KeralaRiskRadarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "high" | "flood" | "landslide">("all");

  const safeLocations = Array.isArray(locations) ? locations : [];
  const safeNewsFeed = Array.isArray(newsFeed) ? newsFeed : [];

  const filteredLocations = safeLocations.filter((loc) => {
    if (!loc) return false;
    const name = String(loc.name || "").toLowerCase();
    const district = String(loc.district || "").toLowerCase();
    const term = (searchTerm || "").toLowerCase();
    const matchesSearch = name.includes(term) || district.includes(term);

    if (!matchesSearch) return false;

    const level = String(loc.risk_level || "").toLowerCase();
    if (selectedFilter === "high") {
      return (
        level === "high" ||
        level === "critical" ||
        (Number(loc.risk_score) || 0) >= 40
      );
    }
    if (selectedFilter === "flood") return loc.hazard_type === "flood";
    if (selectedFilter === "landslide") return loc.hazard_type === "landslide";
    return true;
  });

  const getRiskBadge = (level?: string) => {
    switch (String(level || "").toLowerCase()) {
      case "critical":
        return <Badge variant="critical">CRITICAL</Badge>;
      case "high":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/40">HIGH</Badge>;
      case "moderate":
        return <Badge variant="warning">MODERATE</Badge>;
      default:
        return <Badge variant="success">LOW</Badge>;
    }
  };

  return (
    <div className="space-y-6 mb-8">
      {/* Section Header */}
      <div className="rounded-xl border border-border/70 bg-surface/50 p-5 backdrop-blur-sm shadow-sm transition-all">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Compass className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Regional Risk Radar
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Automated hazard assessments and environmental indicators across Kerala districts.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-border bg-surface-muted/40 px-3.5 py-2 text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">Overall Risk</span>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <span className="text-base font-semibold font-mono text-foreground tabular-nums">
                  {typeof overallRisk?.score === "number" ? Math.round(overallRisk.score) : "—"}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  ({overallRisk?.level ? String(overallRisk.level) : "Low"})
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-muted/40 px-3.5 py-2 text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">Monitored Zones</span>
              <span className="text-base font-semibold font-mono text-foreground mt-0.5 block">
                {safeLocations.length || 14} Districts
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3.5 border-t border-border/50">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by district (e.g. Wayanad, Idukki)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-muted/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
            <Button
              size="sm"
              variant={selectedFilter === "all" ? "default" : "ghost"}
              onClick={() => setSelectedFilter("all")}
              className="h-7 text-xs rounded-lg px-2.5"
            >
              All ({safeLocations.length})
            </Button>
            <Button
              size="sm"
              variant={selectedFilter === "high" ? "secondary" : "ghost"}
              onClick={() => setSelectedFilter("high")}
              className="h-7 text-xs rounded-lg px-2.5 text-orange-400"
            >
              Elevated Risk
            </Button>
            <Button
              size="sm"
              variant={selectedFilter === "flood" ? "secondary" : "ghost"}
              onClick={() => setSelectedFilter("flood")}
              className="h-7 text-xs rounded-lg px-2.5"
            >
              Floods
            </Button>
            <Button
              size="sm"
              variant={selectedFilter === "landslide" ? "secondary" : "ghost"}
              onClick={() => setSelectedFilter("landslide")}
              className="h-7 text-xs rounded-lg px-2.5"
            >
              Landslides
            </Button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid: Kerala Risk Places (Left) & News Bulletins (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Kerala District Risk Cards (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground/75">
              Monitored Districts &amp; Risk Zones ({filteredLocations.length})
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {lastSync ? `Updated: ${new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Current"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredLocations.map((loc) => {
              const isLandslide = loc.hazard_type === "landslide";
              return (
                <FadeIn key={loc.id}>
                  <div
                    onClick={() => onSelectLocation?.(loc)}
                    className="rounded-xl border border-border/80 bg-surface/60 p-4 transition-colors hover:border-primary/40 cursor-pointer relative overflow-hidden group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {loc.district}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {isLandslide ? (
                              <Mountain className="w-3 h-3 text-amber-400" />
                            ) : (
                              <Droplets className="w-3 h-3 text-cyan-400" />
                            )}
                            {isLandslide ? "Landslide" : "Flood"}
                          </span>
                        </div>
                        <h4 className="text-xs text-foreground/70 font-medium truncate">
                          {loc.name}
                        </h4>
                      </div>
                      <div className="shrink-0">{getRiskBadge(loc.risk_level)}</div>
                    </div>

                    {/* Sensor Telemetry Stats */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-surface-muted/40 rounded-lg mb-2.5 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">24h Rain</span>
                        <span className="font-mono font-medium text-foreground">
                          {loc.rainfall_24h_mm} mm
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Intensity</span>
                        <span className="font-mono font-medium text-foreground">
                          {loc.rainfall_intensity_mm_h} mm/h
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Elevation</span>
                        <span className="font-mono font-medium text-foreground">
                          {Math.round(loc.elevation_m)} m
                        </span>
                      </div>
                    </div>

                    {/* Associated News Bulletin */}
                    {loc.matched_news && (
                      <div className="pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                          <Newspaper className="w-2.5 h-2.5 text-foreground/50" />
                          <span className="font-medium text-foreground/60 truncate">
                            {loc.matched_news.source}
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground/75 truncate italic">
                          &ldquo;{loc.matched_news.title}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>

        {/* Right Column: News & Government Bulletins Feed (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground/75 flex items-center gap-1.5">
              <Newspaper className="w-3.5 h-3.5 text-primary" />
              News &amp; Bulletins
            </span>
          </div>

          <div className="rounded-xl border border-border/70 bg-surface/50 p-3.5 space-y-2.5 max-h-[600px] overflow-y-auto">
            {safeNewsFeed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No recent disaster bulletins reported
              </div>
            ) : (
              safeNewsFeed.map((news, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-surface-muted/30 border border-border/40 hover:border-border transition-colors text-xs space-y-1 group"
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                    <span className="font-medium text-foreground/70 truncate max-w-[170px]">
                      {news.source || "Official Bulletin"}
                    </span>
                    <span className="font-mono text-[10px]">
                      {news.pubDate ? String(news.pubDate).slice(0, 16) : ""}
                    </span>
                  </div>

                  <a
                    href={news.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2 group-hover:underline flex items-start gap-1"
                  >
                    <span>{news.title}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground/60 shrink-0 mt-0.5" />
                  </a>

                  {news.district && (
                    <div className="pt-0.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-muted text-muted-foreground font-medium">
                        {news.district}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
