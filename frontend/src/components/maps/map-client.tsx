"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Rectangle, useMap, Popup } from "react-leaflet";
import L from "leaflet";

// Leaflet icon fix for Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Semantic Markers
const createPulseIcon = (colorHex: string) => L.divIcon({
  className: "custom-pulse-icon",
  html: `<div style="background-color: ${colorHex}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${colorHex};"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const floodIcon = createPulseIcon("#0070f3"); // Info/Blue
const landslideIcon = createPulseIcon("#f5a623"); // Warning/Orange
const criticalIcon = createPulseIcon("#ff0000"); // Critical/Red

const createClusterIcon = (colorHex: string) => L.divIcon({
  className: "custom-cluster-icon",
  html: `<div style="background-color: transparent; width: 32px; height: 32px; border-radius: 4px; border: 3px dashed ${colorHex}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px ${colorHex};">
    <div style="background-color: ${colorHex}; width: 8px; height: 8px; border-radius: 50%;"></div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

interface MapClientProps {
  center: [number, number];
  zoom: number;
  riskZones: any[];
  events: any[];
  spatialCells?: any[];
  clusters?: any[];
  resources?: any[];
  layers: { flood: boolean; landslide: boolean; events: boolean; historical: boolean; demo: boolean; predictive: boolean; clusters?: boolean; resources: boolean };
  onLocationSelect: (loc: any) => void;
  onMapClick?: (lat: number, lng: number) => void;
  searchedLocation: [number, number] | null;
}

import { useMapEvents } from "react-leaflet";

function MapController({ center, zoom, searchedLocation }: { center: [number, number], zoom: number, searchedLocation: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (searchedLocation) {
      map.flyTo(searchedLocation, 12, { duration: 1.5 });
    } else {
      map.setView(center, zoom);
    }
  }, [center, zoom, searchedLocation, map]);
  return null;
}

function MapEventsHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function MapClient({ center, zoom, riskZones, events, spatialCells, clusters, resources, layers, onLocationSelect, onMapClick, searchedLocation }: MapClientProps) {
  
  const getRiskColor = (level: string) => {
    switch(level.toLowerCase()) {
      case "critical": return "#ff0000";
      case "high": return "#f5a623";
      case "moderate": return "#f5e623";
      default: return "#00ff00";
    }
  };

  return (
    <MapContainer 
      center={center} 
      zoom={zoom} 
      className="h-full w-full bg-[#1a1a1a]"
      zoomControl={false} // We will use custom or just default at bottom right later
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      <MapController center={center} zoom={zoom} searchedLocation={searchedLocation} />

      <MapEventsHandler onMapClick={onMapClick} />

      {/* Render Risk Zones (Left empty as real continuous spatial prediction is not available) */}
      {riskZones.map((zone) => {
        // We will only render this for Demo zones, as requested
        if (!layers.demo) return null;
        if (zone.type === "flood" && !layers.flood) return null;
        if (zone.type === "landslide" && !layers.landslide) return null;
        
        return (
          <Circle
            key={zone.id}
            center={[zone.lat, zone.lng]}
            pathOptions={{ 
              color: getRiskColor(zone.riskLevel), 
              fillColor: getRiskColor(zone.riskLevel), 
              fillOpacity: 0.2, 
              weight: 1 
            }}
            radius={zone.radius}
            eventHandlers={{
              click: () => onLocationSelect(zone)
            }}
          >
            <Popup className="dark-popup">
              <div className="font-semibold">{zone.type.toUpperCase()} RISK (DEMO)</div>
              <div>Level: <span style={{color: getRiskColor(zone.riskLevel)}}>{zone.riskLevel}</span></div>
            </Popup>
          </Circle>
        );
      })}

      {/* Render Events */}
      {events.map((ev) => {
        const recordType = ev.record_type?.toLowerCase() || "predictive";
        const isHistorical = recordType === "historical";
        const isDemo = recordType === "demo";
        const isPredictive = recordType === "predictive";
        
        // Filter based on layer settings
        if (isHistorical && !layers.historical) return null;
        if (isPredictive) return null; // We use spatial grid cells for predictive data now
        if (isDemo && !layers.demo) return null;

        // Base hazard type filter
        if (ev.type === "flood" && !layers.flood) return null;
        if (ev.type === "landslide" && !layers.landslide) return null;

        let currentIcon = landslideIcon;
        if (isHistorical) {
          currentIcon = createPulseIcon("#9c27b0"); // Purple for historical
        } else if (isDemo) {
          currentIcon = createPulseIcon("#555555"); // Grey for demo
        } else if (ev.severity === 'critical') {
          currentIcon = criticalIcon;
        } else if (ev.type === 'flood') {
          currentIcon = floodIcon;
        }

        return (
          <Marker 
            key={ev.id} 
            position={[ev.lat, ev.lng]}
            icon={currentIcon}
            eventHandlers={{
              click: () => onLocationSelect(ev)
            }}
          >
            <Popup>
              <div className="font-semibold text-sm">
                {isHistorical ? "HISTORICAL EVENT" : isDemo ? "DEMO DATA" : "PREDICTIVE RISK"}
              </div>
              <div className="text-xs text-foreground/80">{ev.location}</div>
            </Popup>
          </Marker>
        );
      })}

      {/* Render Spatial Grid Cells */}
      {layers.predictive && spatialCells && spatialCells.map((cell) => {
        if (cell.hazard_type === "flood" && !layers.flood) return null;
        if (cell.hazard_type === "landslide" && !layers.landslide) return null;
        
        // Compute cell bounds (0.05 degree grid = +/- 0.025 from center)
        const offset = 0.025;
        const bounds: [[number, number], [number, number]] = [
          [cell.center_lat - offset, cell.center_lon - offset],
          [cell.center_lat + offset, cell.center_lon + offset]
        ];

        return (
          <Rectangle
            key={cell.cell_id}
            bounds={bounds}
            pathOptions={{
              color: getRiskColor(cell.risk_category),
              fillColor: getRiskColor(cell.risk_category),
              fillOpacity: 0.35,
              weight: 2,
              opacity: 0.8
            }}
            eventHandlers={{
              click: () => onLocationSelect({ ...cell, isGridCell: true })
            }}
          >
            <Popup className="dark-popup">
              <div className="font-semibold text-sm uppercase">{cell.hazard_type} GRID CELL</div>
              <div className="text-xs text-foreground/80 mt-1">Center: {cell.center_lat.toFixed(3)}, {cell.center_lon.toFixed(3)}</div>
              <div className="text-xs mt-1">Average Risk: <span style={{color: getRiskColor(cell.risk_category)}} className="font-bold">{cell.average_risk}</span></div>
              <div className="text-xs">Max Risk: {cell.max_risk}</div>
              <div className="text-xs mt-1">Assessments: {cell.assessment_count}</div>
              <div className="text-xs text-foreground/60 italic mt-1 text-center w-full block">Click for detailed provenance</div>
            </Popup>
          </Rectangle>
        );
      })}

      {/* Render Clusters */}
      {layers.clusters && clusters && clusters.map((cluster) => {
        if (cluster.hazard_type === "flood" && !layers.flood) return null;
        if (cluster.hazard_type === "landslide" && !layers.landslide) return null;
        
        let color = cluster.hazard_type === "flood" ? "#0070f3" : "#f5a623";
        let qualityText = "Low Data";
        if (cluster.quality_indicator === "WELL_SUPPORTED") qualityText = "Well Supported";
        if (cluster.quality_indicator === "MODERATE_DATA") qualityText = "Moderate Data";

        return (
          <Marker
            key={cluster.cluster_id}
            position={[cluster.centroid_lat, cluster.centroid_lon]}
            icon={createClusterIcon(color)}
            eventHandlers={{
              click: () => onLocationSelect({ ...cluster, isCluster: true })
            }}
          >
            <Popup className="dark-popup">
              <div className="font-semibold text-sm uppercase">{cluster.hazard_type} SPATIAL-TEMPORAL CLUSTER</div>
              <div className="text-xs text-foreground/80 mt-1">Quality: {qualityText}</div>
              <div className="text-xs mt-1">Members: {cluster.member_count}</div>
              <div className="text-xs">Avg Risk: {cluster.average_risk}</div>
              <div className="text-xs text-foreground/60 italic mt-1 text-center w-full block">Click for cluster details</div>
            </Popup>
          </Marker>
        );
      })}

      {/* Render Resources */}
      {layers.resources && (resources || []).map((res: any) => {
        return (
          <Marker 
            key={`res-${res.id}`} 
            position={[res.latitude, res.longitude]}
            icon={createPulseIcon("#10b981")} // Success/Green
            eventHandlers={{
              click: () => onLocationSelect({ ...res, isResource: true })
            }}
          >
            <Popup>
              <div className="font-semibold text-sm text-success">VERIFIED RESOURCE</div>
              <div className="text-xs text-foreground/80 capitalize">{res.resource_type.replace('_', ' ')}</div>
              <div className="text-xs text-foreground/80">{res.name}</div>
            </Popup>
          </Marker>
        );
      })}

      {/* Selected Coordinate Pin */}
      {searchedLocation && (
        <Marker 
          position={searchedLocation}
          icon={createPulseIcon("#ffffff")}
        >
          <Popup>
             <div className="font-semibold text-sm">Selected Point</div>
             <div className="text-xs text-foreground/80">{searchedLocation[0].toFixed(4)}, {searchedLocation[1].toFixed(4)}</div>
          </Popup>
        </Marker>
      )}

    </MapContainer>
  );
}
