"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CloudSun,
  CloudRain,
  CloudLightning,
  Sun,
  Cloud,
  Wind,
  Droplets,
  Thermometer,
  Compass,
  Eye,
  Gauge,
  Umbrella,
  AlertTriangle,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/animations/fade-in";
import { apiClient } from "@/lib/api/client";

interface WeatherData {
  location: {
    name: string;
    district: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    elevation_m: number;
    station_time: string;
    updated_at: string;
  };
  current: {
    temperature_c: number;
    feels_like_c: number;
    temp_max_today: number;
    temp_min_today: number;
    condition: string;
    icon: string;
    humidity_pct: number;
    wind_speed_kmh: number;
    wind_direction: string;
    precipitation_mm: number;
    rain_probability: number;
    uv_index: number;
    pressure_hpa: number;
    visibility_km: number;
    dew_point_c: number;
    air_quality_index: number;
    air_quality_label: string;
  };
  hourly_forecast: Array<{
    time: string;
    hour: number;
    temp_c: number;
    condition: string;
    icon: string;
    rain_prob: number;
    precip_mm: number;
    wind_kmh: number;
  }>;
  daily_forecast: Array<{
    day: string;
    date: string;
    max_temp_c: number;
    min_temp_c: number;
    condition: string;
    icon: string;
    rain_prob: number;
    rain_sum_mm: number;
    uv_index: number;
  }>;
  predictions: {
    summary: string;
    safety_advisory: string;
    flood_risk: {
      level: string;
      score: number;
      details: string;
    };
    landslide_risk: {
      level: string;
      score: number;
      details: string;
    };
    estimated_24h_rainfall_mm: number;
    peak_intensity_mm_h: number;
  };
  provider: string;
  cache_status: string;
}

interface Station {
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
}

export default function WeatherForecastPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station>({
    name: "Wayanad (Vythiri / Kalpetta)",
    district: "Wayanad",
    latitude: 11.605,
    longitude: 76.083,
    elevation_m: 780,
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load weather stations on mount
  useEffect(() => {
    async function loadStations() {
      try {
        const data = await apiClient<Station[]>("/weather/stations");
        if (data && data.length > 0) {
          setStations(data);
        }
      } catch {
        // Fallback to default stations
        setStations([
          { name: "Wayanad (Vythiri / Kalpetta)", district: "Wayanad", latitude: 11.605, longitude: 76.083, elevation_m: 780 },
          { name: "Idukki (Munnar High Ranges)", district: "Idukki", latitude: 10.089, longitude: 77.060, elevation_m: 1530 },
          { name: "Ernakulam (Kochi Coastal)", district: "Ernakulam", latitude: 9.931, longitude: 76.267, elevation_m: 4 },
          { name: "Thiruvananthapuram (Capital)", district: "Thiruvananthapuram", latitude: 8.524, longitude: 76.936, elevation_m: 16 },
          { name: "Kozhikode (Calicut Coast)", district: "Kozhikode", latitude: 11.258, longitude: 75.780, elevation_m: 8 },
          { name: "Palakkad (Western Ghats Gap)", district: "Palakkad", latitude: 10.786, longitude: 76.654, elevation_m: 84 },
        ]);
      }
    }
    loadStations();
  }, []);

  // Fetch forecast for selected station
  const fetchWeather = useCallback(async (stn: Station, forceRefresh: boolean = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const endpoint = forceRefresh
        ? `/weather/refresh?latitude=${stn.latitude}&longitude=${stn.longitude}`
        : `/weather/forecast?latitude=${stn.latitude}&longitude=${stn.longitude}&location_name=${encodeURIComponent(stn.name)}&district=${encodeURIComponent(stn.district)}`;
      
      const method = forceRefresh ? "POST" : "GET";
      const data = await apiClient<WeatherData>(endpoint, { method });
      setWeather(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load live weather data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather(selectedStation);
  }, [selectedStation, fetchWeather]);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const customStn: Station = {
            name: "Current GPS Location",
            district: "Live GPS",
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            elevation_m: 25,
          };
          setSelectedStation(customStn);
        },
        () => {
          alert("Geolocation permission denied or unavailable. Selecting Wayanad by default.");
        }
      );
    }
  };

  const getWeatherIcon = (iconName: string, className: string = "w-8 h-8") => {
    switch (iconName) {
      case "clear":
        return <Sun className={`${className} text-amber-400`} />;
      case "partly-cloudy":
        return <CloudSun className={`${className} text-sky-400`} />;
      case "cloudy":
        return <Cloud className={`${className} text-slate-300`} />;
      case "rain":
        return <CloudRain className={`${className} text-blue-400`} />;
      case "heavy-rain":
        return <CloudRain className={`${className} text-indigo-400 animate-bounce`} />;
      case "thunderstorm":
        return <CloudLightning className={`${className} text-purple-400 animate-pulse`} />;
      case "mist":
        return <Cloud className={`${className} text-gray-400`} />;
      default:
        return <CloudSun className={`${className} text-sky-400`} />;
    }
  };

  return (
    <AppShell>
      {/* Dynamic Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-25">
        <div className="absolute top-[-10%] right-[10%] w-[55%] h-[55%] bg-sky-500/20 blur-[160px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[10%] left-[5%] w-[45%] h-[45%] bg-indigo-600/15 blur-[140px] rounded-full mix-blend-screen" />
      </div>

      <PageHeader
        eyebrow="Real-Time Telemetry"
        title="Live Weather Forecast"
        description="Live meteorological telemetry, 24-hour hourly forecast curves, 7-day outlook, and real-time AI disaster prediction."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
              className="text-xs"
            >
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-primary" /> My Location
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchWeather(selectedStation, true)}
              disabled={refreshing}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh Live
            </Button>
          </div>
        }
      />

      {/* District / Station Selector Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {stations.map((stn) => {
          const isSelected = selectedStation.name === stn.name;
          return (
            <button
              key={stn.name}
              onClick={() => setSelectedStation(stn)}
              className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary"
                  : "bg-surface/70 border border-border/60 text-foreground/80 hover:bg-surface-muted hover:border-primary/40"
              }`}
            >
              {stn.district}
            </button>
          );
        })}
      </div>

      {loading && !weather ? (
        <div className="flex flex-col items-center justify-center p-16">
          <div className="w-10 h-10 border-4 border-surface border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-sm text-foreground/60">Fetching live atmospheric telemetry…</p>
        </div>
      ) : error ? (
        <Card variant="glass" className="p-8 text-center border-danger/40 mb-8">
          <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-danger mb-1">Weather Service Error</h3>
          <p className="text-sm text-foreground/70 mb-4">{error}</p>
          <Button onClick={() => fetchWeather(selectedStation, true)}>Retry</Button>
        </Card>
      ) : weather && (
        <div className="space-y-6">
          
          {/* Main Hero Card (Google Weather Style) */}
          <FadeIn>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-surface/90 via-surface-muted/50 to-surface/80 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                    <MapPin className="w-4 h-4" />
                    <span>{weather.location.name}</span>
                    <span className="text-foreground/40">• {weather.location.district}, Kerala</span>
                  </div>
                  <div className="flex items-baseline gap-4 mt-2">
                    <span className="text-6xl md:text-7xl font-extrabold tracking-tighter text-foreground">
                      {Math.round(weather.current.temperature_c)}°
                    </span>
                    <span className="text-2xl md:text-3xl font-medium text-foreground/60">
                      C
                    </span>
                    <div className="flex flex-col text-sm text-foreground/60 ml-2">
                      <span>Feels like {Math.round(weather.current.feels_like_c)}°</span>
                      <span className="font-mono text-xs">
                        H: {Math.round(weather.current.temp_max_today)}° · L: {Math.round(weather.current.temp_min_today)}°
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <Badge variant="outline" className="px-3 py-1 text-sm font-semibold bg-primary/10 text-primary border-primary/30 flex items-center gap-1.5">
                      {weather.current.condition}
                    </Badge>
                    <Badge variant="outline" className="px-2.5 py-0.5 text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      AQI {weather.current.air_quality_index} · {weather.current.air_quality_label}
                    </Badge>
                    <span className="text-xs text-foreground/40 font-mono">
                      Updated {new Date(weather.location.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center lg:items-end justify-center">
                  <div className="p-4 rounded-2xl bg-surface-muted/40 border border-white/10 shadow-inner flex items-center justify-center">
                    {getWeatherIcon(weather.current.icon, "w-20 h-20 md:w-24 md:h-24")}
                  </div>
                  <span className="text-xs text-foreground/40 mt-2 font-mono">
                    Provider: {weather.provider}
                  </span>
                </div>
              </div>

              {/* Vitals Grid (6 Tiles) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-8 pt-6 border-t border-white/10">
                <div className="p-3.5 rounded-xl bg-surface-muted/30 border border-white/5">
                  <div className="flex items-center text-xs text-foreground/50 mb-1 gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-sky-400" /> Humidity
                  </div>
                  <div className="text-lg font-bold">{weather.current.humidity_pct}%</div>
                  <div className="text-[11px] text-foreground/40">Dew pt: {weather.current.dew_point_c}°</div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-muted/30 border border-white/5">
                  <div className="flex items-center text-xs text-foreground/50 mb-1 gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-emerald-400" /> Wind
                  </div>
                  <div className="text-lg font-bold">{weather.current.wind_speed_kmh} <span className="text-xs font-normal text-foreground/50">km/h</span></div>
                  <div className="text-[11px] text-foreground/40">Dir: {weather.current.wind_direction}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-muted/30 border border-white/5">
                  <div className="flex items-center text-xs text-foreground/50 mb-1 gap-1.5">
                    <Umbrella className="w-3.5 h-3.5 text-blue-400" /> Rain Chance
                  </div>
                  <div className="text-lg font-bold">{weather.current.rain_probability}%</div>
                  <div className="text-[11px] text-foreground/40">Precip: {weather.current.precipitation_mm} mm</div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-muted/30 border border-white/5">
                  <div className="flex items-center text-xs text-foreground/50 mb-1 gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> UV Index
                  </div>
                  <div className="text-lg font-bold">{weather.current.uv_index} of 10</div>
                  <div className="text-[11px] text-foreground/40">{weather.current.uv_index >= 7 ? "High" : weather.current.uv_index >= 4 ? "Moderate" : "Low"}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-muted/30 border border-white/5">
                  <div className="flex items-center text-xs text-foreground/50 mb-1 gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-purple-400" /> Pressure
                  </div>
                  <div className="text-lg font-bold">{Math.round(weather.current.pressure_hpa)} <span className="text-xs font-normal text-foreground/50">hPa</span></div>
                  <div className="text-[11px] text-foreground/40">Sea level</div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-muted/30 border border-white/5">
                  <div className="flex items-center text-xs text-foreground/50 mb-1 gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-teal-400" /> Visibility
                  </div>
                  <div className="text-lg font-bold">{weather.current.visibility_km} <span className="text-xs font-normal text-foreground/50">km</span></div>
                  <div className="text-[11px] text-foreground/40">Clear sight</div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* 24-Hour Hourly Forecast Slider */}
          <FadeIn delay={0.1}>
            <Card variant="glass" className="p-6 border-border/50">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <CloudSun className="w-4 h-4 text-primary" />
                  <span>24-Hour Hourly Forecast</span>
                </CardTitle>
                <span className="text-xs text-muted-foreground font-mono">Live hourly progression</span>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {weather.hourly_forecast.map((hour, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center min-w-[76px] p-3 rounded-xl bg-surface-muted/20 border border-white/5 hover:border-primary/40 hover:bg-surface-muted/40 transition-colors"
                  >
                    <span className="text-xs font-semibold text-foreground/70 mb-2">{hour.time}</span>
                    <div className="my-1">{getWeatherIcon(hour.icon, "w-6 h-6")}</div>
                    <span className="text-sm font-bold mt-2">{Math.round(hour.temp_c)}°</span>
                    {hour.rain_prob > 25 && (
                      <span className="text-[10px] font-mono text-sky-400 mt-1 flex items-center">
                        <Droplets className="w-2.5 h-2.5 mr-0.5" />{hour.rain_prob}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </FadeIn>

          {/* Grid: 7-Day Forecast & AI Hazard Predictions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 7-Day Daily Forecast (Col Span 7) */}
            <div className="lg:col-span-7">
              <FadeIn delay={0.2} className="h-full">
                <Card variant="glass" className="p-6 border-border/50 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-warning" />
                      <span>7-Day Weather Outlook</span>
                    </CardTitle>
                    <span className="text-xs text-muted-foreground font-mono">Next 7 days</span>
                  </div>

                  <div className="divide-y divide-border/40 flex-1 flex flex-col justify-between">
                    {weather.daily_forecast.map((day, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between gap-4">
                        <div className="w-24">
                          <div className="text-sm font-semibold">{day.day}</div>
                          <div className="text-[11px] text-muted-foreground">{day.date}</div>
                        </div>

                        <div className="flex items-center gap-2 min-w-[120px]">
                          {getWeatherIcon(day.icon, "w-5 h-5")}
                          <span className="text-xs text-foreground/80 truncate">{day.condition}</span>
                        </div>

                        <div className="w-16 text-right">
                          <span className="text-xs font-mono text-sky-400">
                            {day.rain_prob}% rain
                          </span>
                        </div>

                        <div className="flex items-center gap-2 min-w-[110px] justify-end font-mono text-xs">
                          <span className="text-muted-foreground">{Math.round(day.min_temp_c)}°</span>
                          <div className="w-14 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-sky-400 to-amber-400 rounded-full" />
                          </div>
                          <span className="font-bold text-foreground">{Math.round(day.max_temp_c)}°</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </FadeIn>
            </div>

            {/* AI DisasterSense Prediction Engine Card (Col Span 5) */}
            <div className="lg:col-span-5">
              <FadeIn delay={0.25} className="h-full">
                <Card variant="glass" className="p-6 border-border/50 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <CardTitle className="text-base flex items-center gap-2 text-primary">
                        <Sparkles className="w-4 h-4" />
                        <span>AI Hazard Prediction</span>
                      </CardTitle>
                      <Badge variant="outline" className="text-xs text-primary border-primary/30">
                        Real-Time ML
                      </Badge>
                    </div>

                    <p className="text-xs leading-relaxed text-foreground/80 bg-surface-muted/30 p-3.5 rounded-xl border border-white/5 mb-4">
                      {weather.predictions.summary}
                    </p>

                    <div className="space-y-4">
                      {/* Flood Risk Prediction */}
                      <div className="p-3.5 rounded-xl bg-surface-muted/20 border border-white/5">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            <CloudRain className="w-3.5 h-3.5 text-info" /> Flood Inundation Threat
                          </span>
                          <Badge
                            variant={
                              weather.predictions.flood_risk.level === "CRITICAL"
                                ? "danger"
                                : weather.predictions.flood_risk.level === "HIGH"
                                ? "warning"
                                : "default"
                            }
                            className="uppercase text-[10px]"
                          >
                            {weather.predictions.flood_risk.level}
                          </Badge>
                        </div>
                        <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-full ${
                              weather.predictions.flood_risk.score > 70
                                ? "bg-danger"
                                : weather.predictions.flood_risk.score > 40
                                ? "bg-warning"
                                : "bg-success"
                            }`}
                            style={{ width: `${weather.predictions.flood_risk.score}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-foreground/60">
                          {weather.predictions.flood_risk.details}
                        </p>
                      </div>

                      {/* Landslide Risk Prediction */}
                      <div className="p-3.5 rounded-xl bg-surface-muted/20 border border-white/5">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-warning" /> Landslide & Slope Threat
                          </span>
                          <Badge
                            variant={
                              weather.predictions.landslide_risk.level === "CRITICAL" ||
                              weather.predictions.landslide_risk.level === "HIGH"
                                ? "danger"
                                : weather.predictions.landslide_risk.level === "MODERATE"
                                ? "warning"
                                : "default"
                            }
                            className="uppercase text-[10px]"
                          >
                            {weather.predictions.landslide_risk.level}
                          </Badge>
                        </div>
                        <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-full ${
                              weather.predictions.landslide_risk.score > 70
                                ? "bg-danger"
                                : weather.predictions.landslide_risk.score > 40
                                ? "bg-warning"
                                : "bg-success"
                            }`}
                            style={{ width: `${weather.predictions.landslide_risk.score}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-foreground/60">
                          {weather.predictions.landslide_risk.details}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Safety Advisory Banner */}
                  <div className="mt-6 p-4 rounded-xl border border-primary/30 bg-primary/10">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
                      <ShieldAlert className="w-4 h-4" /> Operational Safety Advisory
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {weather.predictions.safety_advisory}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-primary/20">
                      <Link href="/warnings" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                        View Warning Board <ArrowRight className="w-3 h-3" />
                      </Link>
                      <Link href="/map" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                        Open Map Heatmap <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </Card>
              </FadeIn>
            </div>

          </div>

        </div>
      )}
    </AppShell>
  );
}
