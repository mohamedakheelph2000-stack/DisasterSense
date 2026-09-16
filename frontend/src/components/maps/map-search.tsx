import { useState } from "react";
import { Search } from "lucide-react";

interface MapSearchProps {
  onSearch: (coords: [number, number]) => void;
}

export function MapSearch({ onSearch }: MapSearchProps) {
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.toLowerCase().includes("wayanad")) {
      onSearch([11.605, 76.083]);
    } else if (query.toLowerCase().includes("munnar")) {
      onSearch([10.088, 77.059]);
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
