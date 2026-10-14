"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { errorMessage } from "@/lib/api/client";

export interface UseApiOptions {
  /** Poll interval in ms. Polling pauses while the tab is hidden. */
  refreshMs?: number;
  /** Skip fetching entirely (e.g. waiting on auth). */
  enabled?: boolean;
  /** Keep the previous payload visible while a refetch is in flight. */
  keepPreviousData?: boolean;
}

export interface UseApiResult<T> {
  data: T | null;
  error: unknown;
  /** True only for the very first load (or a manual full refetch). */
  loading: boolean;
  /** True whenever any request is in flight, including background polls. */
  refreshing: boolean;
  lastUpdated: Date | null;
  refetch: (options?: { background?: boolean }) => Promise<void>;
}

/**
 * Uniform data-fetching primitive for every page:
 *  - typed success payload
 *  - a real `error` object (never a swallowed null)
 *  - background polling that pauses on hidden tabs
 *  - manual retry that surfaces failures instead of masking them
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { refreshMs, enabled = true, keepPreviousData = true } = options;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keepRef = useRef(keepPreviousData);
  keepRef.current = keepPreviousData;
  const seqRef = useRef(0);

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(false);

  const load = useCallback(async (background: boolean) => {
    const seq = ++seqRef.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (seq !== seqRef.current || !mountedRef.current) return;
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (seq !== seqRef.current || !mountedRef.current) return;
      // By default the previous payload is kept so the UI can show the last
      // known state alongside an error banner instead of going blank.
      if (!keepRef.current) setData(null);
      setError(err);
    } finally {
      if (seq === seqRef.current && mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Invalidate any in-flight request on unmount.
      seqRef.current += 1;
    };
  }, []);

  // Initial / dependency-driven load, plus optional polling.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void load(false);

    let timer: ReturnType<typeof setInterval> | null = null;
    if (refreshMs && refreshMs > 0) {
      timer = setInterval(() => {
        if (document.hidden) return;
        void load(true);
      }, refreshMs);
    }

    const onVisible = () => {
      if (!document.hidden) void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refreshMs, load, ...deps]);

  const refetch = useCallback(
    async (opts?: { background?: boolean }) => {
      await load(opts?.background ?? false);
    },
    [load]
  );

  return { data, error, loading, refreshing, lastUpdated, refetch };
}

export interface UseActionResult<TInput, TOutput> {
  run: (input: TInput) => Promise<TOutput | null>;
  pending: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * One-shot mutation helper (POST/PUT). Returns a stable `run`, a pending flag
 * and a user-facing error string derived from `ApiError.detail`.
 */
export function useAction<TInput, TOutput>(
  action: (input: TInput) => Promise<TOutput>,
  options: { onSuccess?: (result: TOutput) => void; onError?: (message: string) => void } = {}
): UseActionResult<TInput, TOutput> {
  const { onSuccess, onError } = options;
  const actionRef = useRef(action);
  actionRef.current = action;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (input: TInput): Promise<TOutput | null> => {
      setPending(true);
      setError(null);
      try {
        const result = await actionRef.current(input);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        onError?.(message);
        return null;
      } finally {
        setPending(false);
      }
    },
    [onError, onSuccess]
  );

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}
