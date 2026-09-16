/**
 * Utility functions for transforming backend API responses
 * into the shapes expected by existing frontend components.
 *
 * Used in REAL API MODE to bridge backend schemas and component props.
 * Demo mode continues to use pre-shaped mock data from client.ts.
 */

/**
 * Parse severity level from an auto-generated alert title.
 * Backend generates titles like "CRITICAL Flood Risk Detected".
 */
export function parseSeverityFromTitle(title: string): string {
  const match = title.match(/^(CRITICAL|HIGH|MODERATE|LOW)\s/i);
  return match ? match[1].toLowerCase() : "info";
}

/**
 * Parse hazard type from an auto-generated alert title.
 */
export function parseHazardFromTitle(title: string): string {
  const match = title.match(/^(?:CRITICAL|HIGH|MODERATE|LOW)\s+(Flood|Landslide)/i);
  return match ? match[1].toLowerCase() : "unknown";
}

/**
 * Transform a DisasterEventRead from the backend into the shape
 * expected by the DetailedRiskCard dashboard component.
 */
export function eventToRiskCardData(event: any): any {
  // Parse feature_snapshot JSON for feature impacts
  let featureImpacts: any[] = [];
  if (event.feature_snapshot) {
    try {
      const snapshot = JSON.parse(event.feature_snapshot);
      featureImpacts = (snapshot.explanation || []).map((exp: any) => ({
        feature: exp.feature,
        value: exp.value,
        importance: exp.importance,
        impact_level: exp.impact || exp.impact_level || "low",
      }));
    } catch {
      // feature_snapshot is not valid JSON, skip
    }
  }

  // Map severity to risk_level display string
  const severityToLevel: Record<string, string> = {
    critical: "Critical",
    high: "High",
    moderate: "Moderate",
    low: "Low",
  };

  return {
    risk_score: Math.round(event.risk_score * 100),
    risk_level: severityToLevel[event.severity] || "Low",
    model_version: event.model_version,
    feature_impacts: featureImpacts,
    hazard_type: event.hazard_type,
    assessed_at: event.event_time,
  };
}

/**
 * Transform a DisasterEventRead into the shape expected by
 * the RecentEventsList dashboard component.
 */
export function eventToRecentEvent(event: any, locationName?: string): any {
  return {
    id: event.id,
    type: event.hazard_type,
    severity: event.severity,
    location: locationName || `Location #${event.location_id}`,
    time: event.event_time,
    status: event.alert_triggered ? "active" : "resolved",
  };
}

/**
 * Transform a backend AlertRead into the shape expected by
 * the AlertCenter dashboard component.
 */
export function alertToDashboardAlert(alert: any): any {
  return {
    id: alert.id,
    title: alert.title,
    message: alert.message,
    severity: parseSeverityFromTitle(alert.title),
    time: formatRelativeTime(alert.created_at),
    hazard_type: parseHazardFromTitle(alert.title),
  };
}

/**
 * Transform a health check response into the shape expected by
 * the MLSystemStatus dashboard component.
 */
export function healthToSystemStatus(health: any): any {
  return {
    ml_engine: health.status === "ok" ? "online" : "offline",
    flood_model_version: "v1.0.0",
    landslide_model_version: "v1.0.0",
    weather_api: "not_configured",
    alert_dispatch: health.status === "ok" ? "online" : "offline",
    last_update: health.timestamp,
  };
}

/**
 * Format a date string as a relative time (e.g. "2 mins ago").
 */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/**
 * Build map-compatible data from real locations and disaster events.
 */
export function buildMapData(
  locations: any[],
  events: any[]
): { center: [number, number]; zoom: number; riskZones: any[]; events: any[] } {
  // Default center: India (Kerala region)
  let center: [number, number] = [11.605, 76.083];
  const zoom = 10;

  // Create a lookup map for location coordinates
  const locationMap = new Map<number, any>();
  for (const loc of locations) {
    locationMap.set(loc.id, loc);
  }

  // Update center to first available location
  if (locations.length > 0) {
    center = [locations[0].latitude, locations[0].longitude];
  }

  // Build event markers
  const eventMarkers = events
    .map((event) => {
      const loc = locationMap.get(event.location_id);
      if (!loc) return null;
      return {
        id: event.id,
        type: event.hazard_type,
        severity: event.severity,
        title: `${event.hazard_type.toUpperCase()} Event`,
        location: loc.name,
        lat: loc.latitude,
        lng: loc.longitude,
        record_type: event.record_type,
        data_source: event.data_source,
        source_reference: event.source_reference,
        risk_score: event.risk_score,
      };
    })
    .filter(Boolean);

  return { center, zoom, riskZones: [], events: eventMarkers };
}
