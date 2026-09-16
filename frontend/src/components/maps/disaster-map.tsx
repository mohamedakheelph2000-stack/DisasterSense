"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "../ui/skeleton";

// Dynamically load the MapClient component to avoid SSR issues with window/document
const MapClientDynamic = dynamic(() => import("./map-client"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-surface-muted/30 relative overflow-hidden">
      <Skeleton className="absolute inset-0 opacity-20" />
      <div className="z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border-4 border-surface border-t-primary animate-spin mb-4" />
        <p className="text-foreground/70 text-sm font-medium tracking-widest uppercase">Initializing GIS Engine</p>
      </div>
    </div>
  ),
});

export function DisasterMap(props: any) {
  return <MapClientDynamic {...props} />;
}
