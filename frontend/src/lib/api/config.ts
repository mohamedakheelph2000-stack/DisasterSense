const isBrowser = typeof window !== "undefined";

export const API_CONFIG = {
  // When running in the browser, always use relative '/api/v1' so requests route through
  // the Next.js reverse proxy (enabling Cloudflare Tunnel access with zero CORS or mixed-content issues).
  // When running on the Next.js server (SSR), use NEXT_PUBLIC_API_URL or local backend directly.
  BASE_URL: isBrowser ? "/api/v1" : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1"),
  
  // Real backend mode by default unless explicitly configured as demo.
  IS_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
};

export function useConfig() {
  return {
    baseUrl: API_CONFIG.BASE_URL,
    isDemoMode: API_CONFIG.IS_DEMO_MODE,
  };
}
