export const API_CONFIG = {
  // Use environment variables for base URLs, default to local development backend
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  
  // Demo mode switch. In demo mode, the API client returns fabricated safe mock data.
  // This ensures we never accidentally show fake data as real.
  IS_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
};

export function useConfig() {
  return {
    baseUrl: API_CONFIG.BASE_URL,
    isDemoMode: API_CONFIG.IS_DEMO_MODE,
  };
}
