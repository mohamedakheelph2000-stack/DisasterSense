"use client";

import React from "react";

/**
 * Concise, professional dashboard introduction for DisasterSense.
 * Focuses on disaster overview rather than repetitive operational subsystem badges.
 */
export function SystemStatusHero() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        Kerala Disaster Overview
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Flood and landslide risk across monitored locations.
      </p>
    </div>
  );
}

