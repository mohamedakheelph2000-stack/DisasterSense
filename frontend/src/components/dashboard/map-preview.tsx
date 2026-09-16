"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Map, Layers, Navigation, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import { SpatialRiskApi } from "@/lib/api/spatial-risk";
import { SpatialAggregationResponse } from "@/lib/api/types/spatial-risk";

export function MapPreview() {
  const [data, setData] = useState<SpatialAggregationResponse | null>(null);
  
  useEffect(() => {
    SpatialRiskApi.getAggregation({ time_range: "7d", record_type: "predictive" })
      .then(res => setData(res))
      .catch(console.error);
  }, []);

  const criticalCells = data ? data.cells.filter(c => c.risk_category === "Critical").length : 0;
  const highCells = data ? data.cells.filter(c => c.risk_category === "High").length : 0;

  return (
    <Card variant="glass" className="h-[400px] md:h-full relative overflow-hidden flex flex-col group border-white/10">
      <CardHeader className="absolute top-0 w-full z-10 bg-gradient-to-b from-surface/90 to-transparent pb-10">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center space-x-2 shadow-sm">
            <Map className="h-5 w-5 text-primary" />
            <span>Live Intelligence Map</span>
          </CardTitle>
          <div className="flex gap-2">
             <div className="bg-surface/80 backdrop-blur-sm border rounded px-2 py-1 flex items-center space-x-1 text-xs text-foreground/70">
                <Layers className="h-3 w-3" />
                <span>Grid Aggregation</span>
             </div>
          </div>
        </div>
      </CardHeader>
      
      <div className="flex-1 bg-surface-muted flex items-center justify-center relative overflow-hidden">
        {/* Map Background Placeholder */}
        <div className="absolute inset-0 opacity-20 transition-transform duration-700 group-hover:scale-105" 
          style={{
            backgroundImage: "radial-gradient(circle at center, rgba(var(--primary), 0.3) 0%, transparent 60%), linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 40px 40px, 40px 40px"
          }}
        />
        
        <div className="z-10 bg-surface/80 backdrop-blur-md p-6 rounded-xl border border-white/10 flex flex-col items-center shadow-xl w-64">
          <Navigation className="h-10 w-10 text-primary mb-2" />
          <h3 className="font-semibold text-lg uppercase tracking-wide mb-1">Spatial Grid</h3>
          
          {data ? (
            <div className="flex flex-col w-full space-y-2 mt-2 mb-4">
              <div className="flex justify-between text-sm bg-danger/20 text-danger px-2 py-1 rounded">
                <span>Critical Cells</span>
                <span className="font-bold">{criticalCells}</span>
              </div>
              <div className="flex justify-between text-sm bg-warning/20 text-warning px-2 py-1 rounded">
                <span>High Risk Cells</span>
                <span className="font-bold">{highCells}</span>
              </div>
              <div className="flex justify-between text-sm bg-surface-muted px-2 py-1 rounded">
                <span>Total Active Cells</span>
                <span className="font-bold">{data.aggregation_metadata.total_cells}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-foreground/50 text-sm mb-4">
              <span className="animate-pulse">Aggregating Risk...</span>
            </div>
          )}

          <Link href="/map" className="w-full">
            <Button variant="default" className="w-full">
              Open Map Engine
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
