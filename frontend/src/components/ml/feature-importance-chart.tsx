"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MLFeatureImportance } from "@/lib/api/types/ml";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function FeatureImportanceChart({ featureImportance, title }: { featureImportance: MLFeatureImportance[], title: string }) {
  if (!featureImportance || featureImportance.length === 0) return null;

  // Format data for Recharts, sorted by importance
  const data = [...featureImportance]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10) // show top 10
    .map(f => ({
      name: f.feature,
      importance: Number((f.importance * 100).toFixed(1))
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">Relative feature weights assigned by the model</p>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis type="number" domain={[0, 'dataMax']} hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={120} 
                tick={{ fontSize: 12, fill: "var(--foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: "transparent" }}
                contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--foreground)" }}
                formatter={(val: any) => [`${val}%`, "Importance"]}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]} maxBarSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="hsl(var(--primary))" opacity={1 - (index * 0.08)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
