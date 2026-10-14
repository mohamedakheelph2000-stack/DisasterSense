/**
 * Explicit demo-mode fixtures.
 *
 * These are ONLY served when `NEXT_PUBLIC_DEMO_MODE=true` is set at build time.
 * They are never used as an automatic fallback when a real request fails — a
 * broken backend must stay visible, not silently replaced by fabricated data.
 *
 * Fixtures intentionally do not attempt privilege escalation: `/auth/register`
 * always mints a `citizen`, exactly like the hardened backend endpoint.
 */

export async function handleDemoRequest<T>(
  endpoint: string,
  options: RequestInit
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 180));

  const method = (options.method || "GET").toUpperCase();

  const parseBody = <B = any>(): B => {
    try {
      return (typeof options.body === "string"
        ? JSON.parse(options.body)
        : {}) as B;
    } catch {
      return {} as B;
    }
  };

  // --- AUTHENTICATION & USER MANAGEMENT ---
  if (endpoint.startsWith("/auth/register")) {
    const body = parseBody();
    const email: string = body.email || "demo@disastersense.org";
    const fullName: string = body.full_name || email.split("@")[0] || "Community Member";
    const newUser = {
      id: Math.floor(Math.random() * 1000) + 10,
      email,
      full_name: fullName,
      role: "citizen",
      is_active: true,
      phone_number: body.phone_number ?? null,
      email_enabled: body.email_enabled ?? true,
      sms_enabled: body.sms_enabled ?? false,
    };
    if (typeof window !== "undefined") {
      try {
        const existingUsers = JSON.parse(localStorage.getItem("ds_demo_users") || "[]");
        existingUsers.push({ ...newUser, plain_password: body.plain_password });
        localStorage.setItem("ds_demo_users", JSON.stringify(existingUsers));
      } catch {
        /* localStorage unavailable */
      }
    }
    return newUser as unknown as T;
  }

  if (endpoint.startsWith("/auth/login")) {
    let username = "";
    if (typeof options.body === "string") {
      const params = new URLSearchParams(options.body);
      username = params.get("username") || "";
    }

    let role = "citizen";
    let fullName = "Citizen User";
    let email = username || "citizen@disastersense.org";

    const lowerUser = username.toLowerCase();
    if (lowerUser.includes("admin")) {
      role = "admin";
      fullName = "Command Admin";
      email = "admin@disastersense.org";
    } else if (lowerUser.includes("responder")) {
      role = "responder";
      fullName = "Emergency Responder";
      email = "responder@disastersense.org";
    } else if (typeof window !== "undefined") {
      try {
        const users = JSON.parse(localStorage.getItem("ds_demo_users") || "[]");
        const found = users.find(
          (u: { email?: string }) => u.email?.toLowerCase() === lowerUser
        );
        if (found) {
          role = (found as any).role || "citizen";
          fullName = (found as any).full_name || "Community Member";
          email = (found as any).email;
        }
      } catch {
        /* ignore */
      }
    }

    const payload = { id: 1, email, full_name: fullName, role, is_active: true };
    const token = `ds_demo_token_${role}_${encodeURIComponent(JSON.stringify(payload))}`;

    if (typeof window !== "undefined") {
      localStorage.setItem("ds_current_user", JSON.stringify(payload));
    }

    return { access_token: token, token_type: "bearer" } as unknown as T;
  }

  if (endpoint.startsWith("/auth/me")) {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ds_current_user");
      if (stored) {
        try {
          return JSON.parse(stored) as unknown as T;
        } catch {
          /* fall through */
        }
      }
      const token = localStorage.getItem("ds_token") || "";
      if (token.startsWith("ds_demo_token_")) {
        const parts = token.split("_");
        const role = parts[3] || "citizen";
        try {
          return JSON.parse(
            decodeURIComponent(parts.slice(4).join("_"))
          ) as unknown as T;
        } catch {
          return {
            id: 1,
            email: `${role}@disastersense.org`,
            full_name: role.toUpperCase(),
            role,
            is_active: true,
          } as unknown as T;
        }
      }
    }
    return {
      id: 1,
      email: "citizen@disastersense.org",
      full_name: "Community Citizen",
      role: "citizen",
      is_active: true,
    } as unknown as T;
  }

  if (endpoint.startsWith("/health")) {
    return {
      status: "ok",
      version: "1.0.0",
      app_name: "DisasterSense API (Demo Mode)",
      environment: "demo",
      db_reachable: true,
      timestamp: new Date().toISOString(),
    } as unknown as T;
  }

  // --- EVENTS ---
  if (endpoint.startsWith("/disaster-events")) {
    const isFlood = endpoint.includes("hazard_type=flood");
    const isLandslide = endpoint.includes("hazard_type=landslide");

    let items = [
      {
        id: 1,
        title: "Imminent Flash Flood Warning",
        description: "Heavy continuous monsoon precipitation across Wayanad basin.",
        hazard_type: "flood",
        severity: "critical",
        risk_score: 0.85,
        location_id: 101,
        event_time: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        alert_triggered: true,
        model_version: "v1.0.0",
        feature_snapshot: JSON.stringify({
          explanation: [
            { feature: "rainfall_mm_24h", value: 150, importance: 0.55, impact: "high" },
            { feature: "soil_saturation_pct", value: 88, importance: 0.35, impact: "high" },
          ],
        }),
      },
      {
        id: 2,
        title: "High Slope Instability",
        description: "Geological stability weakened after 120mm rainfall on 45deg slope.",
        hazard_type: "landslide",
        severity: "high",
        risk_score: 0.61,
        location_id: 102,
        event_time: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        alert_triggered: true,
        model_version: "v1.0.0",
        feature_snapshot: JSON.stringify({
          explanation: [
            { feature: "slope_deg", value: 45, importance: 0.45, impact: "high" },
            { feature: "rainfall_mm_24h", value: 120, importance: 0.35, impact: "high" },
          ],
        }),
      },
    ];

    if (isFlood) items = items.filter((i) => i.hazard_type === "flood");
    else if (isLandslide) items = items.filter((i) => i.hazard_type === "landslide");

    return {
      items,
      total: items.length,
      page: 1,
      page_size: 20,
      pages: 1,
    } as unknown as T;
  }

  if (endpoint.startsWith("/locations")) {
    return {
      items: [
        { id: 101, name: "Wayanad Valley", latitude: 11.605, longitude: 76.083, elevation_m: 750, is_active: true },
        { id: 102, name: "Munnar Highlands", latitude: 10.088, longitude: 77.059, elevation_m: 1530, is_active: true },
        { id: 103, name: "Vythiri Basin", latitude: 11.547, longitude: 76.036, elevation_m: 700, is_active: true },
        { id: 104, name: "Meppadi Hill", latitude: 11.554, longitude: 76.132, elevation_m: 820, is_active: true },
      ],
      total: 4,
      page: 1,
      page_size: 100,
      pages: 1,
    } as unknown as T;
  }

  if (endpoint.startsWith("/resources")) {
    return {
      items: [
        { id: 1, name: "Wayanad Emergency Shelter Alpha", resource_type: "shelter", status: "available", capacity: 400, current_utilization: 120, latitude: 11.605, longitude: 76.083, contact_phone: "+91 4936 202 201" },
        { id: 2, name: "District Medical Response Unit 4", resource_type: "medical", status: "deployed", capacity: 80, current_utilization: 65, latitude: 11.554, longitude: 76.132, contact_phone: "+91 4936 202 202" },
        { id: 3, name: "Rapid Rescue Boat Fleet", resource_type: "rescue", status: "available", capacity: 150, current_utilization: 30, latitude: 11.547, longitude: 76.036, contact_phone: "+91 4936 202 203" },
        { id: 4, name: "Central Relief Supplies Warehouse", resource_type: "supplies", status: "available", capacity: 2000, current_utilization: 850, latitude: 10.088, longitude: 77.059, contact_phone: "+91 4865 230 400" },
      ],
      total: 4,
      page: 1,
      page_size: 100,
      pages: 1,
    } as unknown as T;
  }

  if (endpoint.startsWith("/spatial-risk/clusters")) {
    return {
      metadata: {
        time_window: "7d",
        record_type: "predictive",
        total_clusters: 2,
        total_assessments: 12,
        spatial_threshold_km: 10,
        temporal_threshold_hours: 24,
      },
      clusters: [
        {
          cluster_id: "cluster-kerala-flood-1",
          hazard_type: "flood",
          severity: "critical",
          risk_score: 84.5,
          center_lat: 11.605,
          center_lon: 76.083,
          centroid_lat: 11.605,
          centroid_lon: 76.083,
          radius_km: 6.2,
          member_count: 8,
          event_count: 8,
          active_alerts_count: 3,
          status: "active",
          first_timestamp: new Date(Date.now() - 86400000).toISOString(),
          latest_timestamp: new Date().toISOString(),
          duration_hours: 24,
          average_risk: 84.5,
          max_risk: 92.0,
          high_risk_count: 5,
          critical_risk_count: 8,
          provenance: ["model_inference"],
          quality_indicator: "high",
          recommended_action: "Initiate low-lying residential evacuation advisory.",
        },
        {
          cluster_id: "cluster-munnar-slide-1",
          hazard_type: "landslide",
          severity: "high",
          risk_score: 61.2,
          center_lat: 10.088,
          center_lon: 77.059,
          centroid_lat: 10.088,
          centroid_lon: 77.059,
          radius_km: 4.5,
          member_count: 4,
          event_count: 4,
          active_alerts_count: 2,
          status: "active",
          first_timestamp: new Date(Date.now() - 43200000).toISOString(),
          latest_timestamp: new Date().toISOString(),
          duration_hours: 12,
          average_risk: 61.2,
          max_risk: 74.0,
          high_risk_count: 4,
          critical_risk_count: 2,
          provenance: ["model_inference"],
          quality_indicator: "high",
          recommended_action: "Restrict heavy vehicle transit on ghat road passes.",
        },
      ],
    } as unknown as T;
  }

  if (endpoint.startsWith("/spatial-risk/aggregation")) {
    return {
      aggregation_metadata: {
        time_window: "7d",
        record_type: "predictive",
        cell_size: 0.05,
        total_cells: 3,
        total_assessments: 29,
      },
      cells: [
        {
          cell_id: "c-101",
          lat: 11.605,
          lon: 76.083,
          center_lat: 11.605,
          center_lon: 76.083,
          hazard_type: "flood",
          record_type: "predictive",
          average_risk: 84.5,
          max_risk: 92.0,
          min_risk: 75.0,
          latest_risk: 84.5,
          risk_score: 84.5,
          severity: "critical",
          risk_category: "Critical",
          latest_assessment_time: new Date().toISOString(),
          assessment_count: 14,
          high_risk_count: 5,
          critical_risk_count: 8,
          provenance: ["model_inference", "open_meteo_live"],
        },
      ],
    } as unknown as T;
  }

  if (endpoint.startsWith("/analytics/trends")) {
    const now = new Date();
    const data = Array.from({ length: 15 }, (_, i) => {
      const d = new Date(now.getTime() - (14 - i) * 86400000);
      return {
        date: d.toISOString().split("T")[0],
        flood: 40 + Math.random() * 45,
        landslide: 30 + Math.random() * 35,
        overall: 35 + Math.random() * 45,
      };
    });
    return data as unknown as T;
  }

  if (endpoint.startsWith("/events/recent")) {
    return [
      { id: 1, type: "flood", severity: "high", location: "Wayanad Valley", time: new Date(Date.now() - 3600000).toISOString(), status: "active", lat: 11.605, lng: 76.083 },
      { id: 2, type: "landslide", severity: "moderate", location: "Meppadi", time: new Date(Date.now() - 7200000).toISOString(), status: "resolved", lat: 11.554, lng: 76.132 },
    ] as unknown as T;
  }

  // --- ALERTS ---
  if (endpoint === "/alerts" || endpoint.startsWith("/alerts?")) {
    return {
      items: [
        {
          id: 1,
          location_id: 101,
          disaster_event_id: 201,
          title: "CRITICAL Flood Risk Detected",
          message: "Probability 92.0%. Contributing factors: rainfall_mm_24h, soil_saturation_pct.",
          status: "active",
          acknowledged_by: null,
          acknowledged_at: null,
          resolved_at: null,
          created_at: new Date(Date.now() - 900000).toISOString(),
          updated_at: new Date(Date.now() - 900000).toISOString(),
        },
        {
          id: 2,
          location_id: 102,
          disaster_event_id: 202,
          title: "HIGH Landslide Risk Detected",
          message: "Probability 78.5%. Contributing factors: slope_deg, rainfall_mm_24h.",
          status: "active",
          acknowledged_by: null,
          acknowledged_at: null,
          resolved_at: null,
          created_at: new Date(Date.now() - 7200000).toISOString(),
          updated_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
      total: 2,
      page: 1,
      page_size: 20,
      pages: 1,
    } as unknown as T;
  }

  if (/^\/alerts\/\d+\/acknowledge$/.test(endpoint)) {
    return {
      id: Number(endpoint.split("/")[2]),
      status: "acknowledged",
      acknowledged_by: "demo_user",
      acknowledged_at: new Date().toISOString(),
    } as unknown as T;
  }

  if (/^\/alerts\/\d+\/resolve$/.test(endpoint)) {
    return {
      id: Number(endpoint.split("/")[2]),
      status: "resolved",
      resolved_at: new Date().toISOString(),
    } as unknown as T;
  }

  // --- RISK ---
  if (endpoint.startsWith("/risk-assessments/")) {
    const body = parseBody();
    const hazard = endpoint.includes("landslide") ? "landslide" : "flood";
    const baseRisk = hazard === "flood" ? 20 : 15;
    const score =
      hazard === "flood"
        ? Math.min(
            100,
            Math.max(0, baseRisk + ((body.rainfall_mm_24h || 0) / 200) * 40 + ((body.soil_saturation_pct || 0) / 100) * 30)
          )
        : Math.min(
            100,
            Math.max(0, baseRisk + ((body.slope_deg || 0) / 60) * 35 + ((body.rainfall_mm_24h || 0) / 200) * 35)
          );
    const severity = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "moderate" : "low";
    return {
      hazard_type: hazard,
      risk_score: score,
      risk_level: severity[0].toUpperCase() + severity.slice(1),
      severity,
      probability: score / 100,
      mode: "manual",
      model_name: `${hazard}_risk_v1_demo`,
      model_version: "v1.0.0",
      inference_source: "demo_mock",
      dataset_version: "demo-v1",
      feature_impacts: [],
      assessed_at: new Date().toISOString(),
    } as unknown as T;
  }

  if (endpoint.startsWith("/environment/current")) {
    return {
      rainfall_mm_24h: 150,
      rainfall_intensity_mm_h: 25,
      temperature_c: 24.5,
      humidity_pct: 92,
      soil_saturation_pct: 88,
      wind_speed_kmh: 45,
    } as unknown as T;
  }

  if (endpoint.startsWith("/alerts/active")) {
    return [
      { id: 1, title: "Imminent Flooding Detected", message: "Water levels exceeding safe limits.", severity: "critical", time: "2 mins ago", hazard_type: "flood" },
      { id: 2, title: "Heavy Rainfall Warning", message: "Expect 150mm precipitation in next 24h.", severity: "high", time: "1 hour ago", hazard_type: "flood" },
    ] as unknown as T;
  }

  if (endpoint.startsWith("/users/me/preferences")) {
    if (method !== "GET") return { success: true } as unknown as T;
    return {
      user_id: 1,
      theme: "dark",
      notifications_enabled: true,
      hazard_alerts: ["flood", "landslide"],
      email_digest: "realtime",
    } as unknown as T;
  }

  if (endpoint.startsWith("/system/telemetry-worker")) {
    return {
      status: "active",
      cycle_count: 1420,
      last_poll: new Date().toISOString(),
      active_sensors: 28,
      source: "Open-Meteo Global Surface Archive",
    } as unknown as T;
  }

  if (endpoint.includes("/escalate")) {
    return { success: true, message: "Cluster escalated to emergency dispatch." } as unknown as T;
  }

  if (endpoint.startsWith("/locations/map-data")) {
    return {
      center: [11.605, 76.083],
      zoom: 10,
      riskZones: [
        { id: "z1", type: "flood", riskLevel: "Critical", score: 88, lat: 11.605, lng: 76.083, radius: 5000 },
        { id: "z2", type: "landslide", riskLevel: "High", score: 65, lat: 11.554, lng: 76.132, radius: 2500 },
      ],
    } as unknown as T;
  }

  if (endpoint.startsWith("/system/status")) {
    return {
      ml_engine: "online",
      flood_model_version: "v1.2.4-stable",
      landslide_model_version: "v1.1.0-stable",
      weather_api: "synced",
      alert_dispatch: "online",
      last_update: new Date().toISOString(),
    } as unknown as T;
  }

  if (endpoint.startsWith("/ml/status")) {
    return {
      flood: { hazard: "flood", loaded: true, model_name: "LogisticRegression", model_version: "v1.0.0", dataset_version: "real-v1", inference_source: "real_model", is_real: true, feature_count: 6, feature_names: ["rainfall_mm_24h", "rainfall_intensity_mm_h", "antecedent_rainfall_7d_mm", "temperature_c", "humidity_pct", "elevation_m"] },
      landslide: { hazard: "landslide", loaded: true, model_name: "RandomForest", model_version: "v1.0.0", dataset_version: "real-v1", inference_source: "real_model", is_real: true, feature_count: 6, feature_names: ["rainfall_mm_24h", "rainfall_intensity_mm_h", "antecedent_rainfall_7d_mm", "temperature_c", "humidity_pct", "elevation_m"] },
    } as unknown as T;
  }

  if (endpoint.startsWith("/ml/evaluation/")) {
    const hazard = endpoint.split("/").pop();
    return {
      hazard,
      model_name: hazard === "landslide" ? "RandomForest" : "LogisticRegression",
      model_version: "v1.0.0",
      dataset_version: "real-v1",
      metrics: {
        accuracy: 0.95,
        precision: 0.92,
        recall: 0.88,
        f1_score: 0.9,
        roc_auc: 0.97,
        confusion_matrix: { matrix: [[10, 2], [1, 9]], labels: ["Negative", "Positive"] },
        dataset_size: 22,
        timestamp: new Date().toISOString(),
      },
      feature_importance: [
        { feature: "rainfall_mm_24h", importance: 0.45 },
        { feature: "elevation_m", importance: 0.3 },
      ],
      limitations: "Small dataset (Kerala). Highly volatile metrics.",
    } as unknown as T;
  }

  if (endpoint.startsWith("/ml/experiments/")) {
    return {
      hazard: endpoint.split("/").pop(),
      dataset_version: "real-v1",
      models: [
        { model_name: "RandomForest", is_best_model: true, metrics: { accuracy: 0.95, precision: 0.92, recall: 0.88, f1_score: 0.9, roc_auc: 0.97 } },
        { model_name: "LogisticRegression", is_best_model: false, metrics: { accuracy: 0.85, precision: 0.82, recall: 0.78, f1_score: 0.8, roc_auc: 0.87 } },
      ],
    } as unknown as T;
  }

  if (endpoint.startsWith("/ml/governance/feedback")) {
    if (method === "POST") {
      return {
        id: 999,
        event_id: parseBody().event_id,
        hazard_type: parseBody().hazard_type,
        feedback_type: parseBody().feedback_type,
        review_status: "submitted",
        submitted_at: new Date().toISOString(),
      } as unknown as T;
    }
    return [] as unknown as T;
  }

  if (endpoint.startsWith("/ml/governance/datasets/candidates")) {
    return [] as unknown as T;
  }

  console.warn(`[DisasterSense Demo] No fixture for: ${method} ${endpoint}`);
  return { status: "ok", items: [] } as unknown as T;
}
