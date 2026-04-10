import { apiFetch } from "@/lib/api/client";
import type { User } from "@/lib/types/api";

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export const authApi = {
  register(body: {
    email: string;
    password: string;
    name?: string;
    teamName?: string;
    pixKey?: string;
  }) {
    return apiFetch<{ userId: string; message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  verifyEmail(body: { email: string; code: string }) {
    return apiFetch<{ message?: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  login(body: { email: string; password: string }) {
    return apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
