"use client";
import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error("DisasterSense Client Exception:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-surface border border-border/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-danger animate-pulse" />
        </div>

        <h2 className="text-xl font-bold tracking-tight mb-2 text-foreground">
          DisasterSense Dashboard Notice
        </h2>

        <p className="text-sm text-foreground/70 mb-6">
          A temporary client error occurred while rendering telemetry or live feeds.
          {error?.message ? (
            <span className="block mt-2 font-mono text-xs text-danger/80 bg-danger/5 p-2 rounded-lg border border-danger/10 break-words">
              {error.message}
            </span>
          ) : null}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>

          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl"
          >
            <Home className="w-4 h-4" />
            Reload Home
          </Button>
        </div>
      </div>
    </div>
  );
}
