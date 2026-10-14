import { API_CONFIG } from "./config";
import { handleDemoRequest } from "./mocks";

/**
 * Structured API error. Every non-2xx response and every network failure
 * surfaces as one of these so callers can branch on `status` instead of
 * string-matching `message`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly endpoint: string;

  constructor(status: number, detail: string, endpoint: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.endpoint = endpoint;
  }

  /** True when no response was ever received (backend down / blocked). */
  get isNetworkError() {
    return this.status === 0;
  }

  /** True when the session is missing or expired. */
  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }
}

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

const NETWORK_DETAIL =
  "Cannot reach the DisasterSense API. Start the backend with `uvicorn app.main:app --reload` from the `backend/` directory.";

/** FastAPI `detail` is a string, a list of validation errors, or an object. */
function normalizeDetail(raw: unknown, status: number): string {
  if (typeof raw === "string" && raw.trim()) return raw;
  if (Array.isArray(raw)) {
    const parts = raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const loc = Array.isArray((item as any).loc)
            ? (item as any).loc.join(".")
            : "";
          const msg = (item as any).msg ?? "";
          return loc ? `${loc}: ${msg}` : String(msg);
        }
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" · ");
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.message === "string") return obj.message;
  }
  if (status >= 500) return `Server error (${status}). Check the backend logs.`;
  if (status === 404) return `Endpoint not found (${status}).`;
  if (status === 403) return "You do not have permission to perform this action.";
  return `Request failed with status ${status}.`;
}

function clearSessionAndRedirect() {
  if (typeof window === "undefined") return;
  const hadToken = !!localStorage.getItem("ds_token");
  localStorage.removeItem("ds_token");
  localStorage.removeItem("ds_current_user");
  if (!hadToken) return;
  if (PUBLIC_PATHS.includes(window.location.pathname)) return;
  window.location.assign("/login");
}

/**
 * Single fetch wrapper for the whole app.
 *
 * - Sends JSON + the bearer token from `localStorage`.
 * - Converts every failure into an `ApiError`.
 * - Demo-mode mocks only run when `NEXT_PUBLIC_DEMO_MODE=true`; they are never
 *   used as an automatic fallback for a real request that failed.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (API_CONFIG.IS_DEMO_MODE) {
    return handleDemoRequest<T>(endpoint, options);
  }

  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("ds_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, cache: "no-store" });
  } catch (err) {
    // TypeError from fetch: DNS/refused/CORS/abort. Surface it, never mask it.
    console.error(`[DisasterSense API] ${endpoint} unreachable`, err);
    throw new ApiError(0, NETWORK_DETAIL, endpoint);
  }

  if (response.status === 401) {
    clearSessionAndRedirect();
    const body = await response
      .json()
      .catch(() => ({ detail: "Session expired. Please log in again." }));
    throw new ApiError(401, normalizeDetail(body?.detail, 401), endpoint);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = normalizeDetail(body?.detail ?? body, response.status);
    console.error(
      `[DisasterSense API] ${response.status} on ${endpoint}: ${detail}`
    );
    throw new ApiError(response.status, detail, endpoint);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(500, "Malformed JSON in API response.", endpoint);
  }
}

/** Convenience wrapper that turns `ApiError` into a user-facing string. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
