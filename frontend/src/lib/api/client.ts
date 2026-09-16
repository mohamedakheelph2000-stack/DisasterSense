import { API_CONFIG } from "./config";

/**
 * Base fetch wrapper that handles JSON, errors, and Demo Mode branching.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // 1. Check if we should intercept with DEMO data
  if (API_CONFIG.IS_DEMO_MODE) {
    return handleDemoRequest<T>(endpoint, options);
  }

  // 2. LIVE Mode Execution
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  // Setup standard headers
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  // Attach JWT token from localStorage if available
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("ds_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("ds_token");
        // Optionally dispatch a global event or redirect
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }

    // Attempt to extract detailed error from backend
    let errorDetail = "An unexpected error occurred.";
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // Fallback if not JSON
    }
    throw new Error(errorDetail);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Handles generating fake mock data during Demo Mode
 * so we don't need a running backend for UI development.
 */
async function handleDemoRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (endpoint.startsWith("/risk-assessments/flood")) {
    if (options.method === "POST" && options.body) {
      const body = JSON.parse(options.body as string);
      // Simulate dynamic risk calculation based on demo inputs
      const baseRisk = 20;
      const rainImpact = (body.rainfall_mm_24h / 200) * 40; // Max 40 impact
      const satImpact = (body.soil_saturation_pct / 100) * 30; // Max 30 impact
      const score = Math.min(100, Math.max(0, baseRisk + rainImpact + satImpact));
      const level = score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 40 ? "Moderate" : "Low";
      const severity = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "moderate" : "low";

      return {
        hazard_type: "flood",
        risk_score: score,
        risk_level: level,
        severity: severity,
        probability: score / 100,
        mode: "manual",
        model_name: "flood_risk_v1_demo",
        model_version: "v1.0.0",
        inference_source: "demo_mock",
        dataset_version: "demo-v1",
        features_used: {
          "Rainfall 24h (mm)": body.rainfall_mm_24h,
          "Soil Saturation (%)": body.soil_saturation_pct,
          "Slope (°)": body.slope_deg,
          "Distance to River (m)": body.distance_to_river_m
        },
        feature_impacts: [
          { feature: "rainfall_mm_24h", value: body.rainfall_mm_24h, importance: 0.55, impact_level: rainImpact > 25 ? "high" : "moderate" },
          { feature: "soil_saturation_pct", value: body.soil_saturation_pct, importance: 0.35, impact_level: satImpact > 20 ? "high" : "moderate" },
          { feature: "distance_to_river_m", value: body.distance_to_river_m, importance: 0.10, impact_level: "low" }
        ],
        assessed_at: new Date().toISOString()
      } as any;
    }

    return {
      hazard_type: "flood",
      risk_score: 84.5,
      risk_level: "High",
      severity: "high",
      probability: 0.85,
      mode: "manual",
      model_name: "flood_risk_v1_demo",
      model_version: "v1.0.0",
      inference_source: "demo_mock",
      dataset_version: "demo-v1",
      feature_impacts: [
        { feature: "rainfall_mm_24h", value: 150.0, importance: 0.6, impact_level: "high" },
        { feature: "drainage_capacity_score", value: 0.3, importance: 0.25, impact_level: "high" }
      ]
    } as any;
  }

  if (endpoint.startsWith("/risk-assessments/landslide")) {
    if (options.method === "POST" && options.body) {
      const body = JSON.parse(options.body as string);
      // Simulate dynamic risk calculation based on demo inputs
      const baseRisk = 15;
      const slopeImpact = (body.slope_deg / 60) * 35; 
      const rainImpact = (body.rainfall_mm_24h / 200) * 35;
      const score = Math.min(100, Math.max(0, baseRisk + slopeImpact + rainImpact));
      const level = score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 40 ? "Moderate" : "Low";
      const severity = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "moderate" : "low";

      return {
        hazard_type: "landslide",
        risk_score: score,
        risk_level: level,
        severity: severity,
        probability: score / 100,
        mode: "manual",
        model_name: "landslide_risk_v1_demo",
        model_version: "v1.0.0",
        inference_source: "demo_mock",
        dataset_version: "demo-v1",
        features_used: {
          "Slope (°)": body.slope_deg,
          "Rainfall 24h (mm)": body.rainfall_mm_24h,
          "Soil Moisture (%)": body.soil_moisture_pct,
          "Geological Stability": body.geological_stability_index
        },
        feature_impacts: [
          { feature: "slope_deg", value: body.slope_deg, importance: 0.45, impact_level: slopeImpact > 20 ? "high" : "moderate" },
          { feature: "rainfall_mm_24h", value: body.rainfall_mm_24h, importance: 0.35, impact_level: rainImpact > 20 ? "high" : "moderate" },
          { feature: "soil_moisture_pct", value: body.soil_moisture_pct, importance: 0.20, impact_level: "low" }
        ],
        assessed_at: new Date().toISOString()
      } as any;
    }

    return {
      hazard_type: "landslide",
      risk_score: 61.2,
      risk_level: "High",
      severity: "high",
      probability: 0.61,
      mode: "manual",
      model_name: "landslide_risk_v1_demo",
      model_version: "v1.0.0",
      inference_source: "demo_mock",
      dataset_version: "demo-v1",
      feature_impacts: [
        { feature: "slope_deg", value: 45.0, importance: 0.5, impact_level: "high" },
        { feature: "soil_moisture_pct", value: 88.0, importance: 0.3, impact_level: "high" },
        { feature: "rainfall_mm_24h", value: 120.0, importance: 0.2, impact_level: "moderate" }
      ]
    } as any;
  }

  if (endpoint.startsWith("/environment/current")) {
    return {
      rainfall_mm_24h: 150,
      rainfall_intensity_mm_h: 25,
      temperature_c: 24.5,
      humidity_pct: 92,
      soil_saturation_pct: 88,
      wind_speed_kmh: 45,
    } as any;
  }

  // NOTE: This old endpoint is kept for dashboard backwards compatibility for a moment, 
  // but we should eventually update the dashboard to use the actual paginated /alerts endpoint.
  if (endpoint.startsWith("/alerts/active")) {
    return [
      { id: 1, title: "Imminent Flooding Detected", message: "Water levels exceeding safe limits at Sector 7.", severity: "critical", time: "2 mins ago", hazard_type: "flood" },
      { id: 2, title: "Heavy Rainfall Warning", message: "Expect 150mm precipitation in next 24h.", severity: "high", time: "1 hour ago", hazard_type: "flood" },
      { id: 3, title: "System Maintenance", message: "ML models updating tonight.", severity: "info", time: "3 hours ago", hazard_type: "landslide" }
    ] as any;
  }

  // --- NEW ALERTS ENDPOINTS ---
  if (endpoint === "/alerts" || endpoint.startsWith("/alerts?")) {
    return {
      items: [
        {
          id: 1,
          location_id: 101,
          disaster_event_id: 201,
          title: "CRITICAL Flood Risk Detected",
          message: "A critical risk of flood has been assessed with a probability of 92.0%. Primary contributing factors: rainfall_mm_24h, soil_saturation_pct, drainage_capacity_score.",
          status: "active",
          acknowledged_by: null,
          acknowledged_at: null,
          resolved_at: null,
          created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
          updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          // Adding mock relations to make UI easier without chained calls for now
          __mock_meta: { location: "Wayanad Valley", hazard_type: "flood", severity: "critical" }
        },
        {
          id: 2,
          location_id: 102,
          disaster_event_id: 202,
          title: "HIGH Landslide Risk Detected",
          message: "A high risk of landslide has been assessed with a probability of 78.5%. Primary contributing factors: slope_deg, rainfall_mm_24h, geological_stability_index.",
          status: "active",
          acknowledged_by: null,
          acknowledged_at: null,
          resolved_at: null,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          __mock_meta: { location: "Munnar", hazard_type: "landslide", severity: "high" }
        },
        {
          id: 3,
          location_id: 103,
          disaster_event_id: 203,
          title: "MODERATE Flood Risk Detected",
          message: "A moderate risk of flood has been assessed with a probability of 55.0%.",
          status: "acknowledged",
          acknowledged_by: "demo_responder",
          acknowledged_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          resolved_at: null,
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), 
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          __mock_meta: { location: "Vythiri", hazard_type: "flood", severity: "moderate" }
        },
        {
          id: 4,
          location_id: 104,
          disaster_event_id: 204,
          title: "HIGH Landslide Risk Detected",
          message: "A high risk of landslide has been assessed. Heavy rainfall has weakened slopes.",
          status: "resolved",
          acknowledged_by: "demo_admin",
          acknowledged_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          resolved_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), 
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          __mock_meta: { location: "Meppadi", hazard_type: "landslide", severity: "high" }
        }
      ],
      total: 4,
      page: 1,
      page_size: 20,
      pages: 1
    } as any;
  }

  if (endpoint.match(/^\/alerts\/\d+\/acknowledge$/)) {
    return {
      id: parseInt(endpoint.split("/")[2]),
      status: "acknowledged",
      acknowledged_by: "demo_user",
      acknowledged_at: new Date().toISOString()
    } as any;
  }

  if (endpoint.match(/^\/alerts\/\d+\/resolve$/)) {
    return {
      id: parseInt(endpoint.split("/")[2]),
      status: "resolved",
      resolved_at: new Date().toISOString()
    } as any;
  }

  if (endpoint.startsWith("/analytics/trends")) {
    // Return mock historical data for the chart
    const now = new Date();
    const data = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        date: d.toISOString().split("T")[0],
        flood: 40 + Math.random() * 45, // 40-85
        landslide: 30 + Math.random() * 35, // 30-65
        overall: 35 + Math.random() * 45,
      });
    }
    // Make the last one match our current scores
    data[14] = {
      date: "Today",
      flood: 84.5,
      landslide: 61.2,
      overall: 84.5,
    };
    return data as any;
  }

  if (endpoint.startsWith("/events/recent")) {
    return [
      { id: 1, type: "flood", severity: "high", location: "Wayanad Valley", time: "2026-09-11T12:00:00Z", status: "active", lat: 11.605, lng: 76.083 },
      { id: 2, type: "landslide", severity: "moderate", location: "Meppadi", time: "2026-09-10T08:30:00Z", status: "resolved", lat: 11.554, lng: 76.132 },
      { id: 3, type: "flood", severity: "critical", location: "Vythiri", time: "2026-09-11T14:15:00Z", status: "active", lat: 11.547, lng: 76.036 },
      { id: 4, type: "landslide", severity: "high", location: "Munnar", time: "2026-09-11T16:00:00Z", status: "active", lat: 10.088, lng: 77.059 }
    ] as any;
  }

  if (endpoint.startsWith("/locations/map-data")) {
    return {
      center: [11.605, 76.083], // Wayanad
      zoom: 10,
      riskZones: [
        { id: "z1", type: "flood", riskLevel: "Critical", score: 88, lat: 11.605, lng: 76.083, radius: 5000 },
        { id: "z2", type: "flood", riskLevel: "High", score: 72, lat: 11.547, lng: 76.036, radius: 4000 },
        { id: "z3", type: "landslide", riskLevel: "High", score: 65, lat: 11.554, lng: 76.132, radius: 2500 },
        { id: "z4", type: "landslide", riskLevel: "Critical", score: 82, lat: 10.088, lng: 77.059, radius: 3000 },
        { id: "z5", type: "flood", riskLevel: "Moderate", score: 45, lat: 11.7, lng: 76.2, radius: 6000 }
      ]
    } as any;
  }

  if (endpoint.startsWith("/system/status")) {
    return {
      ml_engine: "online",
      flood_model_version: "v1.2.4-stable",
      landslide_model_version: "v1.1.0-stable",
      weather_api: "synced",
      alert_dispatch: "online",
      last_update: new Date().toISOString(),
    } as any;
  }

  if (endpoint.startsWith("/ml/status")) {
    return {
      flood: { hazard: "flood", loaded: true, model_name: "LogisticRegression", model_version: "v1.0.0", dataset_version: "real-v1", inference_source: "real_model", is_real: true, feature_count: 6, feature_names: ["rainfall_mm_24h", "rainfall_intensity_mm_h", "antecedent_rainfall_7d_mm", "temperature_c", "humidity_pct", "elevation_m"] },
      landslide: { hazard: "landslide", loaded: true, model_name: "RandomForest", model_version: "v1.0.0", dataset_version: "real-v1", inference_source: "real_model", is_real: true, feature_count: 6, feature_names: ["rainfall_mm_24h", "rainfall_intensity_mm_h", "antecedent_rainfall_7d_mm", "temperature_c", "humidity_pct", "elevation_m"] }
    } as any;
  }

  if (endpoint.startsWith("/ml/evaluation/flood")) {
    return {
      hazard: "flood", model_name: "LogisticRegression", model_version: "v1.0.0", dataset_version: "real-v1",
      metrics: { accuracy: 0.95, precision: 0.92, recall: 0.88, f1_score: 0.90, roc_auc: 0.97, confusion_matrix: { matrix: [[10, 2], [1, 9]], labels: ["Negative", "Positive"] }, dataset_size: 22, timestamp: new Date().toISOString() },
      feature_importance: [{ feature: "rainfall_mm_24h", importance: 0.45 }, { feature: "elevation_m", importance: 0.3 }],
      limitations: "Small dataset (Kerala). Highly volatile metrics."
    } as any;
  }

  if (endpoint.startsWith("/ml/evaluation/landslide")) {
    return {
      hazard: "landslide", model_name: "RandomForest", model_version: "v1.0.0", dataset_version: "real-v1",
      metrics: { accuracy: 0.93, precision: 0.91, recall: 0.85, f1_score: 0.88, roc_auc: 0.96, confusion_matrix: { matrix: [[12, 1], [2, 8]], labels: ["Negative", "Positive"] }, dataset_size: 23, timestamp: new Date().toISOString() },
      feature_importance: [{ feature: "rainfall_mm_24h", importance: 0.20 }, { feature: "humidity_pct", importance: 0.31 }],
      limitations: "Small dataset (Kerala). slope_deg omitted."
    } as any;
  }

  if (endpoint.startsWith("/ml/experiments/flood") || endpoint.startsWith("/ml/experiments/landslide")) {
    return {
      hazard: endpoint.split("/").pop(), dataset_version: "real-v1",
      models: [
        { model_name: "RandomForest", is_best_model: true, metrics: { accuracy: 0.95, precision: 0.92, recall: 0.88, f1_score: 0.90, roc_auc: 0.97 } },
        { model_name: "LogisticRegression", is_best_model: false, metrics: { accuracy: 0.85, precision: 0.82, recall: 0.78, f1_score: 0.80, roc_auc: 0.87 } }
      ]
    } as any;
  }

  if (endpoint.startsWith("/ml/governance/feedback")) {
    if (options?.method === "POST") {
      return {
        id: 999,
        event_id: 1,
        hazard_type: "flood",
        feedback_type: "confirmed_event",
        review_status: "submitted",
        submitted_at: new Date().toISOString()
      } as any;
    }
    return [] as any;
  }

  if (endpoint.startsWith("/ml/governance/datasets/candidates")) {
    if (endpoint.endsWith("/export")) return [] as any;
    return [] as any;
  }

  throw new Error(`Demo mock not implemented for endpoint: ${endpoint}`);
}
