import { apiFetch } from "@/lib/api/client";
import type { User } from "@/lib/types/api";

export const usersApi = {
  getProfile() {
    return apiFetch<User>("/users/profile");
  },

  updateProfile(body: { name?: string; teamName?: string; pixKey?: string }) {
    return apiFetch<User>("/users/profile", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};
