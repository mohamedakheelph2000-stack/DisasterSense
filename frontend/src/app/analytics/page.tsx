"use client";

import { useEffect, useState } from "react";
import { 
  analyticsApi, 
  AnalyticsSummary, 
  HazardComparison, 
  SeverityDistribution, 
  GeographicConcentration, 
  DataQualityMetrics,
  TrendDataPoint
} from "@/lib/api/analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { AlertTriangle, MapPin, Database, Activity, History, ChevronRight } from "lucide-react";
import Link from "next/link";

const COLORS = ['hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--critical))', 'hsl(var(--success))', 'hsl(var(--foreground))'];
const SEVERITY_COLORS = {
  VERY_LOW: 'hsl(var(--success))',
  LOW: 'hsl(var(--info))',
  MODERATE: 'hsl(var(--warning))',
  HIGH: 'hsl(var(--destructive))',
  CRITICAL: 'hsl(var(--critical))'
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [comparison, setComparison] = useState<HazardComparison | null>(null);
  const [severity, setSeverity] = useState<SeverityDistribution | null>(null);
  const [geo, setGeo] = useState<GeographicConcentration | null>(null);
  const [quality, setQuality] = useState<DataQualityMetrics | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [sum, tr, comp, sev, g, qual] = await Promise.all([
          analyticsApi.getSummary(days === 0 ? undefined : days),
          analyticsApi.getTrends(days === 0 ? 365 : days),
          analyticsApi.getHazardComparison(days === 0 ? undefined : days),
          analyticsApi.getSeverityDistribution(days === 0 ? undefined : days),
          analyticsApi.getGeographicConcentration(days === 0 ? undefined : days),
          analyticsApi.getDataQuality()
        ]);
        setSummary(sum);
        setTrends(tr);
        setComparison(comp);
        setSeverity(sev);
        setGeo(g);
        setQuality(qual);
      } catch (e: any) {
        setError(e.response?.data?.detail || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [days]);

  const severityPieData = severity ? [
    { name: 'Predictive', data: Object.entries(severity.predictive).filter(([_,v])=>v>0).map(([k,v]) => ({ name: k, value: v })) },
    { name: 'Historical', data: Object.entries(severity.historical).filter(([_,v])=>v>0).map(([k,v]) => ({ name: k, value: v })) }
  ] : [];

  const comparisonData = comparison ? [
    { name: 'Events (Hist)', Flood: comparison.flood_events, Landslide: comparison.landslide_events },
    { name: 'Alerts', Flood: comparison.flood_alerts, Landslide: comparison.landslide_alerts },
  ] : [];

  if (error) {
    return <div className="p-8 text-destructive">Error: {error}</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disaster Intelligence</h1>
          <p className="text-foreground/70 mt-1">Aggregate analytics and historical risk patterns.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-medium text-primary hover:underline flex items-center">
            Back to Command Center <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 1 Year</option>
            <option value={0}>All Time</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="glass">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-foreground/70">Historical Events</CardTitle>
              <History className="h-4 w-4 text-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_historical_events}</div>
              <p className="text-xs text-foreground/50 mt-1">Total recorded incidents</p>
            </CardContent>
          </Card>
          <Card variant="glass">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-foreground/70">Predictive Assessments</CardTitle>
              <Activity className="h-4 w-4 text-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_predictive_assessments}</div>
              <p className="text-xs text-foreground/50 mt-1">ML inferences completed</p>
            </CardContent>
          </Card>
          <Card variant="glass">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-foreground/70">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{summary.active_alerts}</div>
              <p className="text-xs text-foreground/50 mt-1">{summary.resolved_alerts} resolved all time</p>
            </CardContent>
          </Card>
          <Card variant="glass">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-foreground/70">Monitored Locations</CardTitle>
              <MapPin className="h-4 w-4 text-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_locations}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Time-Series Trends</CardTitle>
            <CardDescription>Historical vs Predictive progression over time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[300px] w-full" /> : trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickFormatter={(val) => val === 'Today' ? val : val.split('-').slice(1).join('/')} />
                  <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="predictive_assessments" name="Predictive Risk" stroke="hsl(var(--info))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="historical_events" name="Historical Events" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="active_alerts" name="Active Alerts" stroke="hsl(var(--critical))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-foreground/50">No data available for this selection</div>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Hazard Comparison</CardTitle>
            <CardDescription>Flood vs Landslide occurrence across regions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[300px] w-full" /> : comparisonData.length > 0 && (comparisonData[0].Flood > 0 || comparisonData[0].Landslide > 0 || comparisonData[1].Flood > 0 || comparisonData[1].Landslide > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Legend />
                  <Bar dataKey="Flood" fill="hsl(var(--info))" radius={[4,4,0,0]} />
                  <Bar dataKey="Landslide" fill="hsl(var(--warning))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-foreground/50">No data available for this selection</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
            <CardDescription>Breakdown of event magnitude by type</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[300px] w-full" /> : severityPieData.length > 0 && (severityPieData[0].data.length > 0 || severityPieData[1].data.length > 0) ? (
              <div className="flex flex-col md:flex-row h-[300px] items-center justify-around">
                {severityPieData.map((dataset, idx) => (
                  <div key={idx} className="flex flex-col items-center w-full">
                    <h4 className="text-sm font-medium text-foreground/70 mb-2">{dataset.name}</h4>
                    {dataset.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={dataset.data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2}>
                            {dataset.data.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS] || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                       <div className="flex h-[250px] items-center text-xs text-foreground/40">No records</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-foreground/50">No data available for this selection</div>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Geographic Concentration</CardTitle>
            <CardDescription>Locations with highest incidence rates</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[300px] w-full" /> : geo && geo.locations.length > 0 ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {geo.locations.slice(0, 8).map((loc, i) => (
                  <div key={loc.location_id} className="flex items-center justify-between p-3 rounded-lg bg-surface/50 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
                        #{i + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{loc.name}</div>
                        <div className="text-xs text-foreground/50">{loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{loc.total_incidents} total</div>
                      <div className="text-xs text-foreground/50">{loc.predictive_alerts} Pred / {loc.historical_events} Hist</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-foreground/50">No data available for this selection</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="glass" className="border-info/30 bg-info/5">
        <CardHeader>
          <CardTitle className="text-info flex items-center gap-2">
            <Database className="h-5 w-5" /> Data Quality & Provenance
          </CardTitle>
          <CardDescription className="text-info/80">Academic verification metrics for the dataset</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-16 w-full" /> : quality && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="block text-foreground/60 mb-1">Total Verified Records</span>
                <span className="font-medium">{quality.total_records.toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-foreground/60 mb-1">Time Coverage</span>
                <span className="font-medium">
                  {quality.oldest_record_date ? new Date(quality.oldest_record_date).toLocaleDateString() : 'N/A'} - 
                  {quality.newest_record_date ? new Date(quality.newest_record_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-foreground/60 mb-1">Missing Coordinates</span>
                <span className="font-medium">{quality.records_missing_coordinates}</span>
              </div>
              <div>
                <span className="block text-foreground/60 mb-1">Demo Source Tags</span>
                <span className="font-medium">{quality.demo_records_count}</span>
              </div>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-info/20 text-xs text-info/70">
            <strong>Note on predictive trends:</strong> The predictive risk trend demonstrates model assessments. It must not be interpreted as guaranteed real-world historical occurrences.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
