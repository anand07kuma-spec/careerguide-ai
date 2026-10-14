"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

export interface Resource<T> {
  state: "loading" | "ready" | "error";
  /** The most recent value that loaded, still shown while a newer one is in flight. */
  data: T | null;
  error: string | null;
}

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

/**
 * Reads data once the screen is ready, and re-reads it whenever `load` becomes a
 * new function (a changed filter) or `reload` is called. Pass a `useCallback`
 * `load`; an inline arrow would re-run the fetch on every render.
 *
 * "loading" is derived from *which* request is currently in flight rather than
 * being set by a call in the effect body, so a filter change shows the spinner
 * without a state update cascading into a second render. The previous value stays
 * on screen while the new one is fetched, and a response that arrives after a
 * newer request was made is dropped rather than overwriting it.
 */
export function useResource<T>(
  load: () => Promise<T>,
  enabled = true,
): Resource<T> & { reload: () => void } {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<{
    load: () => Promise<T>;
    tick: number;
    resource: Resource<T>;
  } | null>(null);

  // Only ever touched inside the effect, never while rendering.
  const inFlight = useRef(0);

  const reload = useCallback(() => setTick((current) => current + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++inFlight.current;
    let active = true;
    void load()
      .then((data) => {
        if (!active || mine !== inFlight.current) return;
        setSettled({ load, tick, resource: { state: "ready", data, error: null } });
      })
      .catch((error: unknown) => {
        if (!active || mine !== inFlight.current) return;
        setSettled((current) => ({
          load,
          tick,
          resource: {
            state: "error",
            data: current?.resource.data ?? null,
            error: messageFor(error),
          },
        }));
      });
    return () => {
      active = false;
    };
  }, [enabled, load, tick]);

  const fresh = settled !== null && settled.load === load && settled.tick === tick;
  if (fresh) return { ...settled.resource, reload };
  return {
    state: "loading",
    data: settled?.resource.data ?? null,
    error: null,
    reload,
  };
}
