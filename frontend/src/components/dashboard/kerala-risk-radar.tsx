"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Droplets,
  Mountain,
  Newspaper,
  ExternalLink,
  Search,
  Filter,
  Activity,
  Wind,
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

  const filteredLocations = locations.filter((loc) => {
    const matchesSearch =
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.district.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === "high") {
      return (
        loc.risk_level.toLowerCase() === "high" ||
        loc.risk_level.toLowerCase() === "critical" ||
        loc.risk_score >= 40
      );
    }
    if (selectedFilter === "flood") return loc.hazard_type === "flood";
    if (selectedFilter === "landslide") return loc.hazard_type === "landslide";
    return true;
  });

  const getRiskBadge = (level: string) => {
    switch (level.toLowerCase()) {
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
      <div className="bg-gradient-to-r from-surface/90 to-surface-muted/60 border border-primary/20 rounded-2xl p-6 backdrop-blur-xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <ShieldAlert className="w-32 h-32 text-primary" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="p-2 rounded-xl bg-primary/20 border border-primary/30 text-primary">
                <Compass className="w-5 h-5" />
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Kerala Real-Time Disaster Radar
              </h2>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold px-2 py-0.5 text-xs">
                10s LIVE STREAM
              </Badge>
            </div>
            <p className="text-foreground/70 text-sm max-w-2xl">
              Streaming real-time weather sensors, KSDMA government bulletins, online news wires,
              and AI risk scoring across all 14 Kerala districts every 10 seconds.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="bg-surface-muted/80 border border-border/80 px-4 py-2.5 rounded-xl text-center">
              <span className="text-[11px] uppercase text-foreground/50 font-semibold block">Zones Monitored</span>
              <span className="text-lg font-bold font-mono text-foreground">{locations.length || 14} Districts</span>
            </div>
            <div className="bg-surface-muted/80 border border-border/80 px-4 py-2.5 rounded-xl text-center">
              <span className="text-[11px] uppercase text-foreground/50 font-semibold block">Sync Cadence</span>
              <span className="text-lg font-bold font-mono text-emerald-400">10 Seconds</span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-border/50">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by district (e.g. Wayanad, Idukki)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-muted/80 border border-border rounded-xl pl-9 pr-4 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex items-center space-x-1.5 self-start sm:self-center">
            <Button
              size="sm"
              variant={selectedFilter === "all" ? "default" : "ghost"}
              onClick={() => setSelectedFilter("all")}
              className="text-xs rounded-full px-3"
            >
              All Zones ({locations.length})
            </Button>
            <Button
              size="sm"
              variant={selectedFilter === "high" ? "secondary" : "ghost"}
              onClick={() => setSelectedFilter("high")}
              className="text-xs rounded-full px-3 text-orange-400"
            >
              Elevated Risk
            </Button>
            <Button
              size="sm"
              variant={selectedFilter === "flood" ? "secondary" : "ghost"}
              onClick={() => setSelectedFilter("flood")}
              className="text-xs rounded-full px-3"
            >
              Floods
            </Button>
            <Button
              size="sm"
              variant={selectedFilter === "landslide" ? "secondary" : "ghost"}
              onClick={() => setSelectedFilter("landslide")}
              className="text-xs rounded-full px-3"
            >
              Landslides
            </Button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid: Kerala Risk Places (Left) & Live News/Bulletins (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Kerala District Risk Cards (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Live Kerala Risk Zones ({filteredLocations.length} active)
            </span>
            <span className="text-[11px] text-foreground/40 font-mono">
              Last Ingested: {lastSync ? new Date(lastSync).toLocaleTimeString() : "Just now"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLocations.map((loc) => {
              const isLandslide = loc.hazard_type === "landslide";
              return (
                <FadeIn key={loc.id}>
                  <div
                    onClick={() => onSelectLocation?.(loc)}
                    className="bg-surface/70 border border-border/70 hover:border-primary/50 transition-all rounded-2xl p-4 cursor-pointer hover:shadow-lg relative overflow-hidden group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center space-x-1.5 mb-1">
                          <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            {loc.district}
                          </span>
                          <span className="text-foreground/30">•</span>
                          <span className="text-[11px] text-foreground/60 flex items-center gap-1">
                            {isLandslide ? (
                              <Mountain className="w-3 h-3 text-amber-400" />
                            ) : (
                              <Droplets className="w-3 h-3 text-cyan-400" />
                            )}
                            {isLandslide ? "Landslide" : "River/Flood"}
                          </span>
                        </div>
                        <h4 className="text-xs text-foreground/80 font-medium line-clamp-1">
                          {loc.name}
                        </h4>
                      </div>
                      <div>{getRiskBadge(loc.risk_level)}</div>
                    </div>

                    {/* Sensor Telemetry Stats */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-surface-muted/60 rounded-xl mb-3 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-foreground/40 block">Rain 24h</span>
                        <span className="font-mono font-bold text-primary">
                          {loc.rainfall_24h_mm} mm
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-foreground/40 block">Intensity</span>
                        <span className="font-mono font-semibold text-foreground/80">
                          {loc.rainfall_intensity_mm_h} mm/h
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-foreground/40 block">Elevation</span>
                        <span className="font-mono font-semibold text-foreground/80">
                          {Math.round(loc.elevation_m)} m
                        </span>
                      </div>
                    </div>

                    {/* Associated Live News Bulletin */}
                    {loc.matched_news && (
                      <div className="pt-2 border-t border-border/40">
                        <div className="flex items-center space-x-1 text-[10px] text-foreground/40 mb-1">
                          <Newspaper className="w-2.5 h-2.5 text-primary" />
                          <span className="font-semibold text-foreground/60 truncate">
                            {loc.matched_news.source}
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground/80 line-clamp-1 italic">
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

        {/* Right Column: Live Online News & Government Bulletins Feed (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60 flex items-center gap-1.5">
              <Newspaper className="w-3.5 h-3.5 text-primary" />
              Live News &amp; KSDMA Wire
            </span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0.2">
              REAL-TIME
            </Badge>
          </div>

          <div className="bg-surface/80 border border-border/70 rounded-2xl p-4 backdrop-blur-md shadow-lg space-y-3 max-h-[640px] overflow-y-auto">
            {newsFeed.length === 0 ? (
              <div className="text-center py-8 text-foreground/50 text-xs">
                Connecting to KSDMA and online news wire...
              </div>
            ) : (
              newsFeed.map((news, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-surface-muted/50 border border-border/50 hover:border-primary/40 transition-all text-xs space-y-1.5 group"
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] text-foreground/50">
                    <span className="font-semibold text-primary truncate max-w-[170px]">
                      {news.source}
                    </span>
                    <span className="font-mono text-[9px]">
                      {news.pubDate ? news.pubDate.slice(0, 16) : "Live"}
                    </span>
                  </div>

                  <a
                    href={news.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2 block group-hover:underline flex items-start gap-1"
                  >
                    <span>{news.title}</span>
                    <ExternalLink className="w-3 h-3 text-foreground/40 shrink-0 mt-0.5" />
                  </a>

                  {news.district && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                        📍 {news.district}
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
