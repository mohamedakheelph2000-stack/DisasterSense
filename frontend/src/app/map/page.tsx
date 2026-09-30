"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DisasterMap } from "@/components/maps/disaster-map";
import { MapLegend } from "@/components/maps/map-legend";
import { LayerControl } from "@/components/maps/layer-control";
import { MapSearch } from "@/components/maps/map-search";
import { SelectedLocationPanel } from "@/components/maps/selected-location-panel";
import { apiClient } from "@/lib/api/client";
import { API_CONFIG } from "@/lib/api/config";
import { buildMapData } from "@/lib/api/adapters";
import { FadeIn } from "@/components/animations/fade-in";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

export default function MapPage() {
  const { user } = useAuth();
  const [mapData, setMapData] = useState<any>({
    center: [11.552, 76.124],
    zoom: 9,
    riskZones: [],
    resources: []
  });
  const [events, setEvents] = useState<any[]>([]);
  const [spatialCells, setSpatialCells] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [timeWindow, setTimeWindow] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [layers, setLayers] = useState({
    flood: true,
    landslide: true,
    events: true,
    historical: true,
    predictive: true,
    clusters: true,
    resources: true
  });

  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [searchedCoords, setSearchedCoords] = useState<[number, number] | null>(null);
  const [baseMap, setBaseMap] = useState<"google_hybrid" | "google_terrain" | "google_streets" | "osm">("google_hybrid");

  const fetchMapData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [locationsRes, eventsRes, resourcesRes, spatialRes, clustersRes] = await Promise.all([
        apiClient<any>("/locations?page_size=100").catch(() => ({ items: [] })),
        apiClient<any>("/disaster-events?page_size=100").catch(() => ({ items: [] })),
        apiClient<any>("/resources?page_size=100").catch(() => ({ items: [] })),
        apiClient<any>(`/spatial-risk/aggregation?time_range=${timeWindow}&record_type=predictive`).catch(() => ({ cells: [] })),
        apiClient<any>(`/spatial-risk/clusters?time_range=${timeWindow}&record_type=predictive`).catch(() => ({ clusters: [] }))
      ]);
      const transformed = buildMapData(locationsRes.items || [], eventsRes.items || []);
      setMapData({ center: transformed.center, zoom: transformed.zoom, riskZones: transformed.riskZones, resources: resourcesRes.items || [] });
      setEvents(transformed.events);
      setSpatialCells(spatialRes.cells || []);
      setClusters(clustersRes.clusters || []);
    } catch (err: any) {
      setError(err.message || "Failed to load map data.");
    } finally {
      setLoading(false);
    }
  }, [timeWindow]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  const handleLayerChange = (layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleSearch = (coords: [number, number]) => {
    setSearchedCoords(coords);
    setSelectedLocation(null); // Close panel on new search
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSearchedCoords([lat, lng]);
    setSelectedLocation({
      isCoordinateOnly: true,
      lat,
      lng,
      location: "Selected Coordinate",
    });
  };

  const handleRunAssessment = async (hazard: "flood" | "landslide") => {
    if (!selectedLocation || !selectedLocation.isCoordinateOnly) return;
    setAssessing(true);
    try {
      const response = await apiClient<any>(`/risk-assessments/${hazard}?mode=automatic`, {
        method: "POST",
        body: JSON.stringify({
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
        })
      });
      // The API returns the assessment. Add it to our events list as a PREDICTIVE event.
      const newEvent = {
        id: `temp-${Date.now()}`,
        type: hazard,
        severity: response.severity,
        title: `${hazard.toUpperCase()} RISK`,
        location: `Assessment at ${selectedLocation.lat.toFixed(2)}, ${selectedLocation.lng.toFixed(2)}`,
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        record_type: "PREDICTIVE",
        risk_score: response.risk_score,
      };
      setEvents(prev => [...prev, newEvent]);
      setSelectedLocation(newEvent);
      setSearchedCoords(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to run risk assessment.");
    } finally {
      setAssessing(false);
    }
  };

  const handleEscalateCluster = async (cluster: any, severity: string, note: string) => {
    if (!cluster.cluster_id || !cluster.member_ids) return;
    
    // We send member_ids as that is the stable provenance needed by the backend
    await apiClient(`/spatial-risk/clusters/${cluster.cluster_id}/escalate`, {
      method: "POST",
      body: JSON.stringify({
        member_ids: cluster.member_ids,
        severity,
        operational_note: note,
        hazard_type: cluster.hazard_type,
        record_type: cluster.record_type,
        time_window: timeWindow
      })
    });
  };

  if (error) {
    return (
      <AppShell>
        <div className="h-[80vh] flex flex-col items-center justify-center text-center">
          <AlertTriangle className="h-16 w-16 text-danger mb-4" />
          <h2 className="text-2xl font-bold tracking-tight mb-2">MAP DATA UNAVAILABLE</h2>
          <p className="text-foreground/60 mb-6">{error}</p>
          <Button onClick={fetchMapData}>Retry Connection</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <FadeIn className="h-[calc(100vh-6rem)] relative -mx-4 md:-mx-8 -mt-4 md:-mt-8 rounded-none md:rounded-tl-2xl overflow-hidden border-t border-l border-white/5 shadow-2xl">
        
        {/* The Leaflet Map - always mounted */}
        <DisasterMap 
          center={mapData.center}
          zoom={mapData.zoom}
          riskZones={mapData.riskZones}
          events={events}
          spatialCells={spatialCells}
          clusters={clusters}
          resources={mapData.resources || []}
          layers={layers}
          onLocationSelect={setSelectedLocation}
          onMapClick={handleMapClick}
          searchedLocation={searchedCoords}
          baseMap={baseMap}
          onBaseMapChange={setBaseMap}
        />

        {/* Syncing / Assessing indicator (non-destructive) */}
        {(loading || assessing) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[450] pointer-events-none">
            <div className="px-4 py-1.5 glass rounded-full flex items-center gap-2 text-xs font-semibold text-primary shadow-xl border border-primary/30 animate-pulse bg-surface/80 backdrop-blur-md">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>{assessing ? "RUNNING AI PREDICTION..." : "SYNCING GIS TELEMETRY..."}</span>
            </div>
          </div>
        )}

        {/* Floating Controls Overlay */}
        <div className="absolute top-4 left-4 z-[400]">
           <MapSearch onSearch={handleSearch} />
        </div>

        <div className="absolute top-4 right-4 z-[400]">
           <LayerControl 
             layers={layers} 
             onChange={handleLayerChange} 
             timeWindow={timeWindow} 
             onTimeWindowChange={setTimeWindow} 
             baseMap={baseMap}
             onBaseMapChange={setBaseMap}
           />
        </div>

        {/* Floating Quick Basemap Selector Bar on Map */}
        <div className="absolute bottom-6 left-6 z-[400] hidden sm:flex items-center bg-surface/90 backdrop-blur-md border border-border/80 rounded-xl p-1.5 shadow-2xl space-x-1">
          <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider px-2">Live Map:</span>
          <button
            type="button"
            onClick={() => setBaseMap("google_hybrid")}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${baseMap === "google_hybrid" ? "bg-primary text-primary-foreground shadow" : "text-foreground/70 hover:text-foreground hover:bg-surface-muted"}`}
          >
            🛰️ Google Satellite
          </button>
          <button
            type="button"
            onClick={() => setBaseMap("google_terrain")}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${baseMap === "google_terrain" ? "bg-primary text-primary-foreground shadow" : "text-foreground/70 hover:text-foreground hover:bg-surface-muted"}`}
          >
            🏔️ Google Terrain
          </button>
          <button
            type="button"
            onClick={() => setBaseMap("google_streets")}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${baseMap === "google_streets" ? "bg-primary text-primary-foreground shadow" : "text-foreground/70 hover:text-foreground hover:bg-surface-muted"}`}
          >
            🗺️ Google Roadmap
          </button>
          <button
            type="button"
            onClick={() => setBaseMap("osm")}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${baseMap === "osm" ? "bg-primary text-primary-foreground shadow" : "text-foreground/70 hover:text-foreground hover:bg-surface-muted"}`}
          >
            🌐 OpenStreetMap
          </button>
        </div>

        <div className="absolute bottom-4 right-4 z-[400] hidden md:block">
           <MapLegend />
        </div>

        {/* Selected Location Sidebar/Panel */}
        {selectedLocation && (
          <div className="absolute top-0 left-0 bottom-0 z-[500] w-full md:w-auto h-[50vh] md:h-full mt-auto md:mt-0 transition-transform">
             <SelectedLocationPanel 
               data={selectedLocation} 
               onClose={() => setSelectedLocation(null)} 
               onAssessRisk={handleRunAssessment} 
               onEscalateCluster={handleEscalateCluster}
               userRole={user?.role}
             />
          </div>
        )}

      </FadeIn>
    </AppShell>
  );
}
