"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  LoaderCircle,
  Wifi,
  WifiOff,
} from "lucide-react";

interface HealthResponse {
  status: "healthy" | "degraded";
  service: string;
  database_connected: boolean;
  embedding_model_ready: boolean;
  timestamp: string;
}

type BackendStatus =
  | "checking"
  | "healthy"
  | "degraded"
  | "offline";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

export function HealthStatusBadge() {
  const [status, setStatus] =
    useState<BackendStatus>("checking");

  useEffect(() => {
    let componentIsMounted = true;

    async function checkBackendHealth() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/health`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Health endpoint returned ${response.status}`,
          );
        }

        const health =
          (await response.json()) as HealthResponse;

        if (!componentIsMounted) {
          return;
        }

        const fullyHealthy =
          health.status === "healthy" &&
          health.database_connected &&
          health.embedding_model_ready;

        setStatus(
          fullyHealthy
            ? "healthy"
            : "degraded",
        );
      } catch {
        if (componentIsMounted) {
          setStatus("offline");
        }
      }
    }

    checkBackendHealth();

    const intervalId = window.setInterval(
      checkBackendHealth,
      30_000,
    );

    return () => {
      componentIsMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:flex">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        Checking backend
      </div>
    );
  }

  if (status === "healthy") {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:flex">
        <Wifi className="h-3.5 w-3.5" />
        Backend connected
      </div>
    );
  }

  if (status === "degraded") {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 sm:flex">
        <AlertTriangle className="h-3.5 w-3.5" />
        Backend degraded
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 sm:flex">
      <WifiOff className="h-3.5 w-3.5" />
      Backend unavailable
    </div>
  );
}