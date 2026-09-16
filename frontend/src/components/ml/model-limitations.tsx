import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function ModelLimitations({ limitations }: { limitations: string }) {
  if (!limitations) return null;

  // Split limitations by period to make it a list
  const limitList = limitations.split(".").filter(l => l.trim().length > 0);

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center space-x-2 text-lg">
          <AlertTriangle className="w-5 h-5" />
          <span>Model Limitations</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc pl-5 space-y-1">
          {limitList.map((lim, idx) => (
            <li key={idx} className="text-sm text-amber-900 dark:text-amber-200/80">
              {lim.trim()}.
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
