import { Card } from "../ui/card";

export function MapLegend() {
  return (
    <Card variant="glass" className="p-3 shadow-xl text-xs w-48">
      <div className="font-semibold text-foreground/80 mb-2 border-b border-border/50 pb-1">Predictive Risk Level</div>
      <div className="space-y-1 mb-3">
        <div className="flex items-center space-x-2"><span className="w-3 h-3 rounded-full bg-success"></span><span>Very Low / Low</span></div>
        <div className="flex items-center space-x-2"><span className="w-3 h-3 rounded-full bg-warning"></span><span>Moderate</span></div>
        <div className="flex items-center space-x-2"><span className="w-3 h-3 rounded-full bg-danger"></span><span>High</span></div>
        <div className="flex items-center space-x-2"><span className="w-3 h-3 rounded-full bg-critical"></span><span>Critical</span></div>
      </div>

      <div className="font-semibold text-foreground/80 mb-2 border-b border-border/50 pb-1 pt-1">Markers</div>
      <div className="space-y-1.5 mb-3">
         <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full border-2 border-white bg-purple-500 shadow-[0_0_5px_var(--purple-500)]"></div>
            <span>Historical Event</span>
         </div>
         <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-sm border-2 border-white bg-danger/50 shadow-[0_0_5px_var(--danger)]"></div>
            <span>Predictive Grid Cell</span>
         </div>
         <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full border-2 border-white bg-gray-500 shadow-[0_0_5px_var(--gray-500)]"></div>
            <span>Demo Data</span>
         </div>
      </div>
      <div className="text-[10px] text-foreground/50 leading-tight border-t border-border/30 pt-2">
        * Note: Predictive visualization uses an explicit 0.05° spatial aggregation grid based on recorded assessments.
      </div>
    </Card>
  );
}
