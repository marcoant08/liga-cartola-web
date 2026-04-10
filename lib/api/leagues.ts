import { apiFetch } from "@/lib/api/client";
import type { League, LeagueMember, Round } from "@/lib/types/api";

export const leaguesApi = {
  list() {
    return apiFetch<League[]>("/leagues");
  },

  get(id: string) {
    return apiFetch<League>(`/leagues/${id}`);
  },

  create(body: {
    name: string;
    description: string;
    roundValue: number;
    maxParticipants: number;
  }) {
    return apiFetch<League>("/leagues", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update(
    id: string,
    body: {
      name?: string;
      description?: string;
      roundValue?: number;
      maxParticipants?: number;
    },
  ) {
    return apiFetch<League>(`/leagues/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  join(body: { inviteToken: string; pixKey: string; teamName: string; isGuest: false }) {
    return apiFetch<League>("/leagues/join", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  addGuest(
    leagueId: string,
    body: { name: string; pixKey: string; teamName: string; isGuest: true },
  ) {
    return apiFetch<LeagueMember>(`/leagues/${leagueId}/members`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  removeMember(leagueId: string, memberId: string) {
    return apiFetch<League>(`/leagues/${leagueId}/members/${memberId}`, {
      method: "DELETE",
    });
  },

  generateInviteToken(leagueId: string, body?: { expiresIn?: number }) {
    return apiFetch<{ inviteToken: string; expiresAt: string }>(
      `/leagues/${leagueId}/invite-token`,
      {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      },
    );
  },

  getRounds(leagueId: string) {
    return apiFetch<{ rounds: Round[] }>(`/leagues/${leagueId}/rounds`);
  },
};
