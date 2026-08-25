import { getApiBaseUrl } from "@/lib/config";
import type { PresenceStats } from "@/lib/types/api";

async function presenceFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    throw new Error(`Presence ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const presenceApi = {
  heartbeat(visitorId: string) {
    return presenceFetch<void>("/presence/heartbeat", {
      method: "POST",
      body: JSON.stringify({ visitorId }),
    });
  },

  getStats() {
    return presenceFetch<PresenceStats>("/presence/stats");
  },
};
