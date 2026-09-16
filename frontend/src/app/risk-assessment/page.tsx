"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FadeIn } from "@/components/animations/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisasterTypeSelector } from "@/components/risk-assessment/disaster-type-selector";
import { AssessmentForm } from "@/components/risk-assessment/assessment-form";
import { AssessmentResult } from "@/components/risk-assessment/assessment-result";
import { apiClient } from "@/lib/api/client";
import { RiskAssessmentResponse } from "@/lib/api/types/risk";
import { useConfig } from "@/lib/api/config";
import { Activity, ShieldCheck, Loader2 } from "lucide-react";

export default function RiskAssessmentPage() {
  const { isDemoMode } = useConfig();
  
  const [hazardType, setHazardType] = useState<"flood" | "landslide">("flood");
  const [formData, setFormData] = useState<any>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RiskAssessmentResponse | null>(null);

  const handleAssess = async () => {
    setLoading(true);
    setError(null);
    setResult(null); // Clear previous result
    
    try {
      const endpoint = `/risk-assessments/${hazardType}`;
      const response = await apiClient<RiskAssessmentResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setResult(response);
    } catch (err: any) {
      setError(err.message || "Failed to process risk assessment.");
    } finally {
      setLoading(false);
    }
  };

  const resetAssessment = () => {
    setResult(null);
    setError(null);
  };

  return (
    <AppShell>
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <FadeIn direction="up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 mb-8 border-b border-border/50 pb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Risk Assessment
              </h1>
              {isDemoMode && <Badge variant="warning">SIMULATION MODE</Badge>}
            </div>
            <p className="text-foreground/60 text-base max-w-2xl">
              Configure environmental and geospatial parameters to run intelligence models for flood and landslide prediction.
            </p>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pb-12">
        
        {/* LEFT COLUMN: Input Workspace */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full">
          <FadeIn delay={0.1}>
             <DisasterTypeSelector 
               type={hazardType} 
               onChange={(type) => {
                 setHazardType(type);
                 setResult(null); // Clear result when switching models
               }} 
             />
             
             <AssessmentForm 
               type={hazardType} 
               formData={formData} 
               setFormData={setFormData} 
             />

             <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-foreground/40 hidden md:block">
                  Inputs are bounded to valid model training ranges.
                </p>
                <Button 
                  size="lg" 
                  className="w-full md:w-auto px-12"
                  onClick={handleAssess}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing Engine...
                    </>
                  ) : (
                    "Assess Risk"
                  )}
                </Button>
             </div>
             
             {error && (
               <div className="mt-4 p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                 {error}
               </div>
             )}
          </FadeIn>
        </div>

        {/* RIGHT COLUMN: Intelligence Result */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full">
           <FadeIn delay={0.2} className="h-full">
             
             {loading ? (
               <div className="h-full min-h-[500px] border border-white/5 bg-surface-muted/10 rounded-2xl flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                 <Activity className="w-12 h-12 text-primary animate-bounce mb-4" />
                 <h3 className="text-lg font-semibold mb-2">Analyzing Inputs</h3>
                 <p className="text-sm text-foreground/50">Running Random Forest inference...</p>
               </div>
             ) : result ? (
               <AssessmentResult result={result} />
             ) : (
               <div className="h-full min-h-[500px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-foreground/40">
                  <ShieldCheck className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1">Awaiting Assessment</p>
                  <p className="text-sm">Configure the parameters on the left and run the engine to view the risk intelligence report.</p>
               </div>
             )}

           </FadeIn>
        </div>

      </div>
    </AppShell>
  );
}
