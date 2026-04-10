import { apiFetch } from "@/lib/api/client";
import type { Round } from "@/lib/types/api";

export const roundsApi = {
  registerWinner(body: { leagueId: string; roundNumber: number; winnerId: string }) {
    return apiFetch<Round>("/rounds", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
