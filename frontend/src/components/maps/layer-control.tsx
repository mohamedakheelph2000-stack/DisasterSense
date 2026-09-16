import { Card } from "../ui/card";
import { Layers, Clock } from "lucide-react";

interface LayerControlProps {
  layers: { flood: boolean; landslide: boolean; events: boolean; historical: boolean; demo: boolean; predictive: boolean; clusters?: boolean; resources: boolean };
  onChange: (key: keyof LayerControlProps["layers"]) => void;
  timeWindow?: string;
  onTimeWindowChange?: (val: string) => void;
}

export function LayerControl({ layers, onChange, timeWindow, onTimeWindowChange }: LayerControlProps) {
  return (
    <Card variant="glass" className="p-4 w-56 shadow-xl">
      {timeWindow && onTimeWindowChange && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 text-foreground/80 font-semibold mb-2 border-b border-border/50 pb-2">
            <Clock className="h-4 w-4" />
            <span>Time Window</span>
          </div>
          <select 
            value={timeWindow} 
            onChange={(e) => onTimeWindowChange(e.target.value)}
            className="w-full bg-surface-muted text-sm rounded border border-border/50 p-1"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      )}

      <div className="flex items-center space-x-2 text-foreground/80 font-semibold mb-3 border-b border-border/50 pb-2">
        <Layers className="h-4 w-4" />
        <span>Map Layers</span>
      </div>
      <div className="space-y-3 text-sm">
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-foreground/80 group-hover:text-foreground transition-colors">Flood Risk</span>
          <input 
            type="checkbox" 
            checked={layers.flood} 
            onChange={() => onChange("flood")}
            className="accent-info h-4 w-4 rounded border-border bg-surface"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-foreground/80 group-hover:text-foreground transition-colors">Landslide Risk</span>
          <input 
            type="checkbox" 
            checked={layers.landslide} 
            onChange={() => onChange("landslide")}
            className="accent-warning h-4 w-4 rounded border-border bg-surface"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-foreground/80 group-hover:text-foreground transition-colors text-success">Resources (Unavailable)</span>
          <input 
            type="checkbox" 
            checked={layers.resources} 
            onChange={() => onChange("resources")}
            className="accent-success h-4 w-4 rounded border-border bg-surface opacity-50"
          />
        </label>
        <div className="border-t border-border/30 pt-2 mt-2">
          <div className="text-xs text-foreground/50 mb-2 uppercase">Record Types</div>
          <label className="flex items-center justify-between cursor-pointer group mb-2">
            <span className="text-foreground/80 group-hover:text-foreground transition-colors">Regional Clusters</span>
            <input 
              type="checkbox" 
              checked={layers.clusters} 
              onChange={() => onChange("clusters")}
              className="accent-primary h-4 w-4 rounded border-border bg-surface"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer group mb-2">
            <span className="text-foreground/80 group-hover:text-foreground transition-colors">Predictive Grid</span>
            <input 
              type="checkbox" 
              checked={layers.predictive} 
              onChange={() => onChange("predictive")}
              className="accent-danger h-4 w-4 rounded border-border bg-surface"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer group mb-2">
            <span className="text-foreground/80 group-hover:text-foreground transition-colors">Historical Events</span>
            <input 
              type="checkbox" 
              checked={layers.historical} 
              onChange={() => onChange("historical")}
              className="accent-purple-500 h-4 w-4 rounded border-border bg-surface"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer group mb-2">
            <span className="text-foreground/80 group-hover:text-foreground transition-colors">Demo Data</span>
            <input 
              type="checkbox" 
              checked={layers.demo} 
              onChange={() => onChange("demo")}
              className="accent-gray-500 h-4 w-4 rounded border-border bg-surface"
            />
          </label>
        </div>
      </div>
    </Card>
  );
}
