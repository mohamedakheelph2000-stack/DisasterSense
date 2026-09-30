import { useState } from "react";
import { Search } from "lucide-react";

interface MapSearchProps {
  onSearch: (coords: [number, number]) => void;
}

export function MapSearch({ onSearch }: MapSearchProps) {
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return;

    // Check if input is lat, lon numbers (e.g. "11.55, 76.12" or "11.55 76.12")
    const coordMatch = trimmed.match(/^([-+]?[0-9]*\.?[0-9]+)[\s,]+([-+]?[0-9]*\.?[0-9]+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        onSearch([lat, lng]);
        return;
      }
    }

    if (trimmed.includes("wayanad") || trimmed.includes("meppadi") || trimmed.includes("chooralmala")) {
      onSearch([11.552, 76.124]);
    } else if (trimmed.includes("munnar") || trimmed.includes("idukki") || trimmed.includes("pettimudi")) {
      onSearch([10.158, 77.016]);
    } else if (trimmed.includes("malappuram") || trimmed.includes("kavalappara") || trimmed.includes("nilambur")) {
      onSearch([11.275, 76.241]);
    } else if (trimmed.includes("chengannur") || trimmed.includes("alappuzha") || trimmed.includes("pamba")) {
      onSearch([9.317, 76.616]);
    } else if (trimmed.includes("aluva") || trimmed.includes("ernakulam") || trimmed.includes("periyar")) {
      onSearch([10.107, 76.351]);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative flex items-center w-64 shadow-xl">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-foreground/50">
        <Search className="h-4 w-4" />
      </div>
      <input 
        type="text" 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search location (e.g. Wayanad)"
        className="w-full bg-surface/80 backdrop-blur-md border border-white/10 text-sm text-foreground rounded-md pl-10 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface"
      />
    </form>
  );
}
