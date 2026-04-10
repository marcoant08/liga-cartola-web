import { getApiBaseUrl } from "@/lib/config";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
} from "@/lib/session-storage";
import { ApiError, parseErrorBody } from "@/lib/api/error";

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken: string };
  if (!data.accessToken) return false;
  updateAccessToken(data.accessToken);
  return true;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const isAuthPath =
    path.includes("/auth/login") ||
    path.includes("/auth/register") ||
    path.includes("/auth/verify-email") ||
    path.includes("/auth/refresh");

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token && !isAuthPath) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && !isAuthPath) {
    const ok = await tryRefresh();
    if (ok) {
      const retryHeaders = new Headers(options.headers);
      if (!retryHeaders.has("Content-Type") && options.body && typeof options.body === "string") {
        retryHeaders.set("Content-Type", "application/json");
      }
      const t = getAccessToken();
      if (t) retryHeaders.set("Authorization", `Bearer ${t}`);
      res = await fetch(url, { ...options, headers: retryHeaders });
    } else {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
