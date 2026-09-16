import { Waves, Mountain } from "lucide-react";

interface DisasterTypeSelectorProps {
  type: "flood" | "landslide";
  onChange: (type: "flood" | "landslide") => void;
}

export function DisasterTypeSelector({ type, onChange }: DisasterTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <button
        type="button"
        onClick={() => onChange("flood")}
        className={`relative flex flex-col items-center justify-center p-6 rounded-xl border transition-all duration-300 overflow-hidden group ${
          type === "flood"
            ? "bg-info/10 border-info/50 shadow-[0_0_20px_rgba(var(--info),0.15)] text-foreground"
            : "bg-surface-muted/30 border-white/5 text-foreground/50 hover:bg-surface-muted hover:border-white/10"
        }`}
      >
        {type === "flood" && (
          <div className="absolute inset-0 bg-info/5 opacity-50 mix-blend-overlay pointer-events-none" />
        )}
        <Waves className={`w-10 h-10 mb-3 transition-colors ${type === "flood" ? "text-info" : "text-foreground/30 group-hover:text-foreground/50"}`} />
        <span className="font-semibold tracking-wider uppercase text-sm">Flood Model</span>
        <span className="text-[10px] mt-1 opacity-70">Hydro-meteorological Risk</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("landslide")}
        className={`relative flex flex-col items-center justify-center p-6 rounded-xl border transition-all duration-300 overflow-hidden group ${
          type === "landslide"
            ? "bg-warning/10 border-warning/50 shadow-[0_0_20px_rgba(var(--warning),0.15)] text-foreground"
            : "bg-surface-muted/30 border-white/5 text-foreground/50 hover:bg-surface-muted hover:border-white/10"
        }`}
      >
        {type === "landslide" && (
          <div className="absolute inset-0 bg-warning/5 opacity-50 mix-blend-overlay pointer-events-none" />
        )}
        <Mountain className={`w-10 h-10 mb-3 transition-colors ${type === "landslide" ? "text-warning" : "text-foreground/30 group-hover:text-foreground/50"}`} />
        <span className="font-semibold tracking-wider uppercase text-sm">Landslide Model</span>
        <span className="text-[10px] mt-1 opacity-70">Geo-technical Risk</span>
      </button>
    </div>
  );
}
