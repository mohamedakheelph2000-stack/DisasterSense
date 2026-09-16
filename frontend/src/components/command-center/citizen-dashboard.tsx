import { SystemStatusHero } from "@/components/dashboard/system-status-hero";
import { OverallRiskCard } from "@/components/dashboard/overall-risk-card";
import { DetailedRiskCard } from "@/components/dashboard/detailed-risk-card";
import { EnvironmentalPanel } from "@/components/dashboard/environmental-panel";
import { AlertCenter } from "@/components/dashboard/alert-center";
import { MapPreview } from "@/components/dashboard/map-preview";
import { FadeIn } from "@/components/animations/fade-in";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CitizenDashboard({ data, loading, error, onRetry, overallScore, overallLevel }: any) {
  if (error) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-center">
        <AlertTriangle className="h-16 w-16 text-danger mb-4" />
        <h2 className="text-2xl font-bold tracking-tight mb-2">DATA CONNECTION UNAVAILABLE</h2>
        <p className="text-foreground/60 mb-6">{error}</p>
        <Button onClick={onRetry}>Retry Connection</Button>
      </div>
    );
  }

  return (
    <>
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-danger/10 blur-[100px] rounded-full mix-blend-screen" />
      </div>

      <SystemStatusHero />

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6 pb-12">
        
        {/* ROW 1 */}
        {/* Overall Risk (Col Span 4) */}
        <div className="xl:col-span-4 h-full">
           <OverallRiskCard 
             score={overallScore} 
             level={overallLevel} 
             lastUpdated={data.systemStatus?.last_update}
             loading={loading}
           />
        </div>

        {/* Specific Risks (Col Span 8) */}
        <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
          <FadeIn delay={0.2} className="h-full">
            <DetailedRiskCard type="flood" data={data.floodRisk} loading={loading} />
          </FadeIn>
          <FadeIn delay={0.3} className="h-full">
            <DetailedRiskCard type="landslide" data={data.landslideRisk} loading={loading} />
          </FadeIn>
        </div>

        {/* ROW 2 */}
        {/* Environmental (Col Span 4) */}
        <div className="xl:col-span-4 h-full">
          <FadeIn delay={0.4} className="h-full">
             <EnvironmentalPanel data={data.weather} loading={loading} />
          </FadeIn>
        </div>

        {/* Map Preview (Col Span 8) */}
        <div className="xl:col-span-8 h-[400px]">
          <FadeIn delay={0.5} className="h-full">
             <MapPreview />
          </FadeIn>
        </div>

        {/* ROW 3 */}
        {/* Alerts (Col Span 12) */}
        <div className="xl:col-span-12 h-[400px]">
          <FadeIn delay={0.6} className="h-full">
             <AlertCenter alerts={data.alerts} loading={loading} />
          </FadeIn>
        </div>

      </div>
    </>
  );
}
