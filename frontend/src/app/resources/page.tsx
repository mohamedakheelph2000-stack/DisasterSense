"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FadeIn } from "@/components/animations/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  Search, 
  MapPin, 
  Phone, 
  PhoneCall,
  ShieldCheck, 
  Cross, 
  Flame, 
  Shield, 
  Home, 
  Navigation,
  Compass,
  Loader2,
  RefreshCw,
  ExternalLink,
  Ambulance,
  Siren,
} from "lucide-react";
import { resourcesApi, EmergencyResource, ResourceType } from "@/lib/api/resources";
import { ingestionApi, NearbyResponse, EmergencyNumber } from "@/lib/api/ingestion";
import { errorMessage } from "@/lib/api/client";
import Link from "next/link";

const NEARBY_DEFAULT_RADIUS_KM = 25;

const NEARBY_PRESETS: Array<{ label: string; lat: number; lng: number }> = [
  { label: "Wayanad (Meppadi)", lat: 11.552, lng: 76.1245 },
  { label: "Kochi", lat: 9.9312, lng: 76.2673 },
  { label: "Kozhikode", lat: 11.2588, lng: 75.7804 },
  { label: "Thiruvananthapuram", lat: 8.5241, lng: 76.9366 },
];

export default function EmergencyResourcesPage() {
  const [resources, setResources] = useState<EmergencyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);

  // Proximity Search State
  const [useProximity, setUseProximity] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [proximityLat, setProximityLat] = useState<number | string>(11.5520); // Default to Meppadi
  const [proximityLng, setProximityLng] = useState<number | string>(76.1245);
  const [radiusKm, setRadiusKm] = useState<number>(30);

  // ── Near me: hospitals / ambulance / police / fire with phone numbers ───
  const [nearbyLocation, setNearbyLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  }>({ lat: NEARBY_PRESETS[0].lat, lng: NEARBY_PRESETS[0].lng, label: NEARBY_PRESETS[0].label });
  const [nearbyRadius, setNearbyRadius] = useState<number>(NEARBY_DEFAULT_RADIUS_KM);
  const [nearby, setNearby] = useState<NearbyResponse | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumber[]>([]);
  const [numbersError, setNumbersError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ingestionApi
      .getEmergencyNumbers()
      .then((res) => {
        if (!cancelled) setEmergencyNumbers(res.numbers || []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setNumbersError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchNearby = useCallback(async () => {
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const res = await ingestionApi.getNearby({
        latitude: nearbyLocation.lat,
        longitude: nearbyLocation.lng,
        radius_km: nearbyRadius,
        limit_per_type: 8,
      });
      setNearby(res);
    } catch (err) {
      setNearbyError(errorMessage(err));
    } finally {
      setNearbyLoading(false);
    }
  }, [nearbyLocation.lat, nearbyLocation.lng, nearbyRadius]);

  useEffect(() => {
    void fetchNearby();
  }, [fetchNearby]);

  const locateMe = () => {
    setNearbyError(null);
    if (!navigator.geolocation) {
      setNearbyError("This browser does not expose a geolocation API — pick a preset below instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearbyLocation({
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
          label: "Your current location",
        });
      },
      (err) => {
        setNearbyError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — pick a preset location below."
            : "Could not read your browser location — pick a preset location below."
        );
      }
    );
  };

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        limit: 100
      };

      if (typeFilter !== "all") {
        params.resource_type = typeFilter as ResourceType;
      }

      if (verifiedOnly) {
        params.verification_status = "verified";
      }

      if (useProximity && proximityLat !== "" && proximityLng !== "") {
        params.latitude = Number(proximityLat);
        params.longitude = Number(proximityLng);
        params.radius_km = radiusKm;
      }

      const res = await resourcesApi.getResources(params);
      setResources(res.items || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, verifiedOnly, useProximity, proximityLat, proximityLng, radiusKm]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Client-side text filter on the retrieved items
  const filteredResources = resources.filter(res => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      res.name.toLowerCase().includes(q) ||
      (res.district && res.district.toLowerCase().includes(q)) ||
      (res.address && res.address.toLowerCase().includes(q)) ||
      res.resource_type.toLowerCase().includes(q)
    );
  });

  const getResourceTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "hospital":
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            <Cross className="w-3 h-3 mr-1" /> Hospital
          </span>
        );
      case "shelter":
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Home className="w-3 h-3 mr-1" /> Shelter
          </span>
        );
      case "relief_center":
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Building2 className="w-3 h-3 mr-1" /> Relief Camp
          </span>
        );
      case "fire_station":
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Flame className="w-3 h-3 mr-1" /> Fire Station
          </span>
        );
      case "police_station":
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Shield className="w-3 h-3 mr-1" /> Police Control
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
            {type.replace("_", " ")}
          </span>
        );
    }
  };

  const handleUseCurrentLocation = () => {
    setGeoNotice(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setProximityLat(Number(pos.coords.latitude.toFixed(4)));
          setProximityLng(Number(pos.coords.longitude.toFixed(4)));
          setUseProximity(true);
        },
        (err) => {
          setGeoNotice(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied - enter coordinates manually or use a quick-focus preset."
              : "Could not read your browser location - enter coordinates manually or use a quick-focus preset."
          );
        }
      );
    }
  };

  const setPresetLocation = (lat: number, lng: number) => {
    setProximityLat(lat);
    setProximityLng(lng);
    setUseProximity(true);
  };

  return (
    <AppShell>
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <FadeIn direction="up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 mb-8 border-b border-border/50 pb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Building2 className="w-8 h-8 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Emergency Resources
              </h1>
            </div>
            <p className="text-foreground/60 text-base max-w-2xl">
              Directory of verified medical facilities, shelters, rescue stations, and relief centers across monitoring districts.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={fetchResources}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Link href="/map">
              <Button variant="default" className="flex items-center space-x-2 bg-primary hover:bg-primary/90 text-white">
                <MapPin className="w-4 h-4" />
                <span>View on Live Map</span>
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* ── Universal emergency numbers ─────────────────────────────────── */}
      <FadeIn delay={0.05}>
        <div className="mb-8 rounded-xl border border-danger/25 bg-danger/[0.06] p-5 backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-danger" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Emergency call numbers</h2>
                <p className="text-xs text-muted-foreground">
                  India-wide dispatch lines — available even when every live feed is offline.
                </p>
              </div>
            </div>
            {numbersError && (
              <span role="alert" className="text-xs text-warning">
                {numbersError}
              </span>
            )}
          </div>

          {emergencyNumbers.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {emergencyNumbers.map((number) => (
                <a
                  key={number.number}
                  href={`tel:${number.number}`}
                  className="group rounded-lg border border-border/60 bg-surface/60 px-3 py-2.5 transition-colors hover:border-danger/50 hover:bg-danger/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-foreground/85">{number.name}</span>
                    <PhoneCall className="h-3.5 w-3.5 shrink-0 text-foreground/40 transition-colors group-hover:text-danger" />
                  </div>
                  <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-danger">
                    {number.number}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{number.description}</p>
                </a>
              ))}
            </div>
          ) : (
            !numbersError && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading emergency numbers…
              </div>
            )
          )}
        </div>
      </FadeIn>

      {/* ── Nearby hospitals / ambulance / police / fire ──────────────────── */}
      <FadeIn delay={0.1}>
        <div className="mb-8 rounded-xl border border-border/60 bg-surface-muted/30 p-5 backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Emergency services near you</h2>
                <p className="text-xs text-muted-foreground">
                  Hospitals, ambulance services, police stations and fire stations — sorted by distance,
                  with tap-to-call numbers.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hud-label">
                {nearbyLocation.label} · {nearbyRadius} km
              </span>
              <Button variant="outline" size="sm" onClick={locateMe} disabled={nearbyLoading}>
                <Navigation className="h-3.5 w-3.5" />
                My location
              </Button>
              <Button variant="outline" size="sm" onClick={() => void fetchNearby()} disabled={nearbyLoading}>
                <RefreshCw className={nearbyLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="flex min-w-[220px] flex-1 items-center gap-3 text-xs text-foreground/70">
              <span className="whitespace-nowrap">Search radius</span>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={nearbyRadius}
                onChange={(e) => setNearbyRadius(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="w-14 text-right font-mono text-foreground/80">{nearbyRadius} km</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-foreground/50">Jump to:</span>
              {NEARBY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setNearbyLocation({ lat: preset.lat, lng: preset.lng, label: preset.label })}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                    nearbyLocation.label === preset.label
                      ? "bg-primary text-white border-primary"
                      : "bg-surface hover:bg-surface-muted border-border/50 text-foreground/80 hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {nearbyError && (
            <p role="alert" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {nearbyError}
            </p>
          )}

          {nearbyLoading && !nearby ? (
            <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Locating nearby emergency services…
            </div>
          ) : nearbyError && !nearby ? (
            <Button variant="outline" size="sm" onClick={() => void fetchNearby()}>
              Try again
            </Button>
          ) : nearby && nearby.groups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {nearby.groups.map((group) => (
                <NearbyGroupCard key={group.key} group={group} radius={nearbyRadius} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-surface/40 px-4 py-6 text-center text-xs text-muted-foreground">
              No emergency facilities of these types are recorded within {nearbyRadius} km of{" "}
              {nearbyLocation.label}. Widen the radius or run{" "}
              <code className="font-mono text-foreground/70">
                python scripts/seed_emergency_resources_osm.py
              </code>{" "}
              to import OpenStreetMap facilities.
            </div>
          )}

          {nearby && (
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{nearby.source_note}</p>
          )}
        </div>
      </FadeIn>

      {/* Proximity Search Card */}
      <FadeIn delay={0.1}>
        <div className="bg-surface-muted/30 border border-border/50 rounded-xl p-6 mb-8 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <Compass className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Geographic Proximity Finder</h2>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-foreground/80 flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useProximity}
                  onChange={(e) => setUseProximity(e.target.checked)}
                  className="rounded border-border accent-primary w-4 h-4"
                />
                <span>Enable Distance Sorting</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-foreground/60 mb-1 block">Latitude</label>
              <Input
                type="number"
                step="0.0001"
                value={proximityLat}
                onChange={(e) => setProximityLat(e.target.value)}
                placeholder="11.5520"
                disabled={!useProximity}
              />
            </div>
            <div>
              <label className="text-xs text-foreground/60 mb-1 block">Longitude</label>
              <Input
                type="number"
                step="0.0001"
                value={proximityLng}
                onChange={(e) => setProximityLng(e.target.value)}
                placeholder="76.1245"
                disabled={!useProximity}
              />
            </div>
            <div>
              <label className="text-xs text-foreground/60 mb-1 block">Radius: {radiusKm} km</label>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                disabled={!useProximity}
                className="w-full mt-2 accent-primary"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleUseCurrentLocation}
                className="w-full text-xs flex items-center justify-center space-x-2"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>My Location</span>
              </Button>
            </div>
          </div>

          {geoNotice ? (
            <p role="status" className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {geoNotice}
            </p>
          ) : null}

          {/* Quick Preset Location Chips */}
          <div className="mt-4 pt-3 border-t border-border/30 flex flex-wrap items-center gap-2">
            <span className="text-xs text-foreground/50">Quick Focus:</span>
            <button
              onClick={() => setPresetLocation(11.5520, 76.1245)}
              className="text-xs px-2.5 py-1 rounded bg-surface hover:bg-surface-muted border border-border/50 text-foreground/80 hover:text-foreground transition-colors"
            >
              Wayanad (Meppadi)
            </button>
            <button
              onClick={() => setPresetLocation(10.1076, 76.3516)}
              className="text-xs px-2.5 py-1 rounded bg-surface hover:bg-surface-muted border border-border/50 text-foreground/80 hover:text-foreground transition-colors"
            >
              Aluva (Periyar)
            </button>
            <button
              onClick={() => setPresetLocation(9.3175, 76.6167)}
              className="text-xs px-2.5 py-1 rounded bg-surface hover:bg-surface-muted border border-border/50 text-foreground/80 hover:text-foreground transition-colors"
            >
              Chengannur (Pamba)
            </button>
            <button
              onClick={() => setPresetLocation(11.2721, 75.8368)}
              className="text-xs px-2.5 py-1 rounded bg-surface hover:bg-surface-muted border border-border/50 text-foreground/80 hover:text-foreground transition-colors"
            >
              Kozhikode
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Filter and Search Bar */}
      <FadeIn delay={0.15}>
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <Input
              type="text"
              placeholder="Search by facility name, district, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === "all"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface-muted/50 text-foreground/70 border-border hover:bg-surface"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter("hospital")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === "hospital"
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-surface-muted/50 text-foreground/70 border-border hover:bg-surface"
              }`}
            >
              Hospitals
            </button>
            <button
              onClick={() => setTypeFilter("shelter")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === "shelter"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-surface-muted/50 text-foreground/70 border-border hover:bg-surface"
              }`}
            >
              Shelters
            </button>
            <button
              onClick={() => setTypeFilter("relief_center")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === "relief_center"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-surface-muted/50 text-foreground/70 border-border hover:bg-surface"
              }`}
            >
              Relief Camps
            </button>
            <button
              onClick={() => setTypeFilter("fire_station")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === "fire_station"
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-surface-muted/50 text-foreground/70 border-border hover:bg-surface"
              }`}
            >
              Fire & Rescue
            </button>
            <button
              onClick={() => setTypeFilter("police_station")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === "police_station"
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-surface-muted/50 text-foreground/70 border-border hover:bg-surface"
              }`}
            >
              Police Control
            </button>

            {/* Verified Only Toggle */}
            <label className="flex items-center space-x-1.5 text-xs text-foreground/70 ml-2 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-border accent-emerald-500"
              />
              <span className="flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                Verified Only
              </span>
            </label>
          </div>
        </div>
      </FadeIn>

      {/* Resource Grid */}
      <FadeIn delay={0.2}>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-foreground/50">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p>Loading emergency facilities...</p>
          </div>
        ) : error ? (
          <div className="bg-critical/10 border border-critical/30 rounded-xl p-8 text-center text-critical">
            <p className="font-semibold mb-2">{error}</p>
            <Button variant="outline" onClick={fetchResources} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="bg-surface-muted/20 border border-border rounded-xl p-12 text-center text-foreground/60">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-foreground/30" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No emergency resources found</h3>
            <p className="text-sm max-w-md mx-auto mb-4">
              {searchQuery || typeFilter !== "all" || useProximity
                ? "Try widening your radius search or clearing your active filters."
                : "No verified emergency resources are currently listed in the database."}
            </p>
            {(searchQuery || typeFilter !== "all" || useProximity || verifiedOnly) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                  setUseProximity(false);
                  setVerifiedOnly(false);
                }}
              >
                Reset All Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((res) => (
              <div
                key={res.id}
                className="bg-surface-muted/40 border border-border/60 hover:border-primary/50 transition-all rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md backdrop-blur-sm group"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors leading-snug">
                      {res.name}
                    </h3>
                    <div className="shrink-0">
                      {res.verification_status === "verified" && (
                        <span className="inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3 mr-0.5" /> Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {getResourceTypeBadge(res.resource_type)}
                    {res.district && (
                      <Badge variant="outline" className="text-xs bg-surface/50 border-border/50">
                        {res.district}
                      </Badge>
                    )}
                    {res.distance_km !== undefined && (
                      <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                        {res.distance_km} km away
                      </span>
                    )}
                  </div>

                  {res.address && (
                    <div className="flex items-start text-xs text-foreground/70 mb-2">
                      <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0 mt-0.5 text-foreground/40" />
                      <span>{res.address}</span>
                    </div>
                  )}

                  {res.capacity && (
                    <div className="text-xs text-foreground/60 mb-2">
                      <span className="font-medium text-foreground/80">Capacity:</span> {res.capacity} persons
                    </div>
                  )}

                  <div className="text-[11px] text-foreground/50 font-mono mb-4">
                    Coords: {res.latitude.toFixed(4)}, {res.longitude.toFixed(4)}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/40 flex items-center justify-between gap-2">
                  {res.contact_info ? (
                    <a
                      href={`tel:${res.contact_info.replace(/[^0-9+]/g, '')}`}
                      className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5 mr-1" />
                      <span>{res.contact_info}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-foreground/40">No direct phone</span>
                  )}

                  <Link href={`/map`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex items-center space-x-1 hover:bg-primary hover:text-white transition-colors"
                    >
                      <span>Map View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </FadeIn>
    </AppShell>
  );
}

const NEARBY_GROUP_META: Record<string, { icon: typeof Cross; chip: string; empty: string }> = {
  hospital: {
    icon: Cross,
    chip: "border-red-500/30 bg-red-500/10 text-red-400",
    empty: "No hospitals or clinics in range",
  },
  ambulance: {
    icon: Ambulance,
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    empty: "No ambulance services listed in range",
  },
  police_station: {
    icon: Shield,
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    empty: "No police stations in range",
  },
  fire_station: {
    icon: Flame,
    chip: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    empty: "No fire stations in range",
  },
};

function NearbyGroupCard({
  group,
  radius,
}: {
  group: NearbyResponse["groups"][number];
  radius: number;
}) {
  const meta = NEARBY_GROUP_META[group.key] ?? {
    icon: Building2,
    chip: "border-border bg-surface/60 text-foreground/70",
    empty: "Nothing in range",
  };
  const Icon = meta.icon;

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-surface/50">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${meta.chip}`}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold text-foreground/90">{group.label}</span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">{group.count} in {radius} km</span>
      </div>

      {group.items.length === 0 ? (
        <p className="px-4 py-5 text-center text-[11px] text-muted-foreground">{meta.empty}</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {group.items.map((item) => {
            const dial = (item.phone_number || item.contact_info || "").replace(/[^\d+]/g, "");
            const phone = item.phone_number || item.contact_info;
            return (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-xs font-medium leading-snug text-foreground/90">{item.name}</p>
                  {item.distance_km !== undefined && (
                    <span className="shrink-0 rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                      {item.distance_km} km
                    </span>
                  )}
                </div>
                {item.address && (
                  <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    {item.address}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  {phone ? (
                    <a
                      href={`tel:${dial}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                    >
                      <Phone className="h-3 w-3" />
                      {phone}
                    </a>
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground">No phone on record</span>
                  )}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=17/${item.latitude}/${item.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    map <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
