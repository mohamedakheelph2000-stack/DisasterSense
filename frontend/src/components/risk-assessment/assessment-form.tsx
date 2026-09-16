import { FloodAssessmentRequest, LandslideAssessmentRequest } from "@/lib/api/types/risk";
import { Card, CardContent } from "../ui/card";

interface AssessmentFormProps {
  type: "flood" | "landslide";
  formData: any; // Using any for simplicity in this combined form, but keys map to the schemas
  setFormData: (data: any) => void;
}

const InputGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="space-y-4">
    <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-widest border-b border-border/50 pb-2 mb-4">{label}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {children}
    </div>
  </div>
);

const RangeInput = ({ 
  label, 
  value, 
  onChange, 
  min, 
  max, 
  step = 1,
  unit 
}: { 
  label: string, value: number, onChange: (v: number) => void, min: number, max: number, step?: number, unit: string 
}) => (
  <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
    <div className="flex justify-between items-center mb-2">
      <label className="text-sm text-foreground/80 font-medium">{label}</label>
      <div className="font-mono text-sm text-primary">
        {value} <span className="text-foreground/50 text-xs">{unit}</span>
      </div>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step}
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-primary"
    />
    <div className="flex justify-between text-[10px] text-foreground/40 mt-1">
      <span>{min}</span>
      <span>{max}</span>
    </div>
  </div>
);

export function AssessmentForm({ type, formData, setFormData }: AssessmentFormProps) {
  
  const updateField = (field: string, value: number) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Card variant="glass" className="border-t-4 border-t-primary/50">
      <CardContent className="pt-6 space-y-8">
        
        {/* COMMON FIELDS (Found in both models roughly) */}
        <InputGroup label="Meteorological Data">
          <RangeInput 
            label="Rainfall (24h)" 
            value={formData.rainfall_mm_24h} 
            onChange={(v) => updateField('rainfall_mm_24h', v)} 
            min={0} max={500} unit="mm" 
          />
          <RangeInput 
            label="Rainfall Intensity" 
            value={formData.rainfall_intensity_mm_h} 
            onChange={(v) => updateField('rainfall_intensity_mm_h', v)} 
            min={0} max={100} unit="mm/h" 
          />
          {type === "flood" && (
             <RangeInput 
               label="Rainfall Duration" 
               value={formData.rainfall_duration_h || 6} 
               onChange={(v) => updateField('rainfall_duration_h', v)} 
               min={0} max={72} unit="h" 
             />
          )}
        </InputGroup>

        {/* FLOOD SPECIFIC */}
        {type === "flood" && (
          <>
            <InputGroup label="Hydrological Factors">
              <RangeInput 
                label="Soil Saturation" 
                value={formData.soil_saturation_pct || 65} 
                onChange={(v) => updateField('soil_saturation_pct', v)} 
                min={0} max={100} unit="%" 
              />
              <RangeInput 
                label="Distance to River" 
                value={formData.distance_to_river_m || 450} 
                onChange={(v) => updateField('distance_to_river_m', v)} 
                min={0} max={5000} step={50} unit="m" 
              />
              <RangeInput 
                label="Drainage Capacity" 
                value={formData.drainage_capacity_score || 5} 
                onChange={(v) => updateField('drainage_capacity_score', v)} 
                min={0} max={10} unit="idx" 
              />
            </InputGroup>
            
            <InputGroup label="Geographical Context">
               <RangeInput 
                label="Elevation" 
                value={formData.elevation_m || 35} 
                onChange={(v) => updateField('elevation_m', v)} 
                min={0} max={3000} step={10} unit="m" 
              />
              <RangeInput 
                label="Slope" 
                value={formData.slope_deg || 4.5} 
                onChange={(v) => updateField('slope_deg', v)} 
                min={0} max={90} step={0.5} unit="°" 
              />
            </InputGroup>
          </>
        )}

        {/* LANDSLIDE SPECIFIC */}
        {type === "landslide" && (
          <>
            <InputGroup label="Geo-technical Factors">
              <RangeInput 
                label="Slope Angle" 
                value={formData.slope_deg || 32} 
                onChange={(v) => updateField('slope_deg', v)} 
                min={0} max={90} step={1} unit="°" 
              />
              <RangeInput 
                label="Soil Moisture" 
                value={formData.soil_moisture_pct || 78} 
                onChange={(v) => updateField('soil_moisture_pct', v)} 
                min={0} max={100} unit="%" 
              />
              <RangeInput 
                label="Geological Stability" 
                value={formData.geological_stability_index || 3.5} 
                onChange={(v) => updateField('geological_stability_index', v)} 
                min={0} max={10} step={0.1} unit="idx" 
              />
            </InputGroup>

            <InputGroup label="Environmental Context">
               <RangeInput 
                label="Vegetation Cover" 
                value={formData.vegetation_cover_pct || 45} 
                onChange={(v) => updateField('vegetation_cover_pct', v)} 
                min={0} max={100} unit="%" 
              />
              <RangeInput 
                label="Road Cut Proximity" 
                value={formData.road_cut_proximity_m || 120} 
                onChange={(v) => updateField('road_cut_proximity_m', v)} 
                min={0} max={2000} step={10} unit="m" 
              />
               <RangeInput 
                label="Elevation" 
                value={formData.elevation_m || 850} 
                onChange={(v) => updateField('elevation_m', v)} 
                min={0} max={3000} step={10} unit="m" 
              />
            </InputGroup>
          </>
        )}

      </CardContent>
    </Card>
  );
}
