"use client";

import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

interface RiskTrendChartProps {
  data: any[];
  loading: boolean;
}

export function RiskTrendChart({ data, loading }: RiskTrendChartProps) {
  if (loading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data || data.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface/90 border border-white/10 p-3 rounded-lg shadow-xl backdrop-blur-md">
          <p className="text-foreground/70 text-xs mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-sm font-medium">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="capitalize text-foreground/90">{entry.name}:</span>
              <span style={{ color: entry.color }}>{entry.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass" className="h-full flex flex-col">
      <CardHeader className="pb-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Risk Trend Analytics</span>
          </CardTitle>
          <div className="text-xs text-foreground/50 border border-border px-2 py-1 rounded bg-surface-muted/50">
            Last 14 Days
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-6 pb-2 pl-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={250}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255,255,255,0.2)" 
              fontSize={10} 
              tickMargin={10} 
              tickFormatter={(val) => val === 'Today' ? val : val.split('-').slice(1).join('/')}
            />
            <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
            <Line 
              type="monotone" 
              dataKey="flood_max_risk" 
              name="Flood Risk" 
              stroke="hsl(var(--info))" 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6, fill: "hsl(var(--info))", stroke: "transparent" }}
            />
            <Line 
              type="monotone" 
              dataKey="landslide_max_risk" 
              name="Landslide Risk" 
              stroke="hsl(var(--warning))" 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6, fill: "hsl(var(--warning))", stroke: "transparent" }}
            />
            <Line 
              type="monotone" 
              dataKey="active_alerts" 
              name="Active Alerts" 
              stroke="hsl(var(--critical))" 
              strokeWidth={2} 
              strokeDasharray="4 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
