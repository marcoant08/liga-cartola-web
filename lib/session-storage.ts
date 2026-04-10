import type { User } from "@/lib/types/api";

const ACCESS = "lc_access_token";
const REFRESH = "lc_refresh_token";
const USER = "lc_user";

export type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export function loadSession(): SessionPayload | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem(ACCESS);
  const refreshToken = localStorage.getItem(REFRESH);
  const raw = localStorage.getItem(USER);
  if (!accessToken || !refreshToken || !raw) return null;
  try {
    const user = JSON.parse(raw) as User;
    return { accessToken, refreshToken, user };
  } catch {
    return null;
  }
}

export function saveSession({ accessToken, refreshToken, user }: SessionPayload): void {
  localStorage.setItem(ACCESS, accessToken);
  localStorage.setItem(REFRESH, refreshToken);
  localStorage.setItem(USER, JSON.stringify(user));
}

export function updateAccessToken(accessToken: string): void {
  localStorage.setItem(ACCESS, accessToken);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH);
}
