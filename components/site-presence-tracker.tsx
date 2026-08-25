"use client";

import { useEffect } from "react";
import { presenceApi } from "@/lib/api/presence";
import { getVisitorId } from "@/lib/visitor-id";

const HEARTBEAT_MS = 25_000;

export function SitePresenceTracker() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "hidden") return;
      void presenceApi.heartbeat(getVisitorId()).catch(() => {});
    };

    ping();
    const id = window.setInterval(ping, HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
