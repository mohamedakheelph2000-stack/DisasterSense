const isBrowser = typeof window !== "undefined";
const isLocalhost = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export const API_CONFIG = {
  // Use environment variables for base URLs, default to local development backend
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  
  // In demo mode, the client uses realistic simulated telemetry and safe offline data.
  // Defaults to true whenever no public external backend URL is configured.
  IS_DEMO_MODE: 
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    (!process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_DEMO_MODE !== "false"),
};

export function useConfig() {
  return {
    baseUrl: API_CONFIG.BASE_URL,
    isDemoMode: API_CONFIG.IS_DEMO_MODE,
  };
}
