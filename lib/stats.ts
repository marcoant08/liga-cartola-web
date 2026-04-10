import type { LeagueMember, Round } from "@/lib/types/api";

export type WinnerStatsRow = {
  winnerId: string;
  displayName: string;
  wins: number;
  estimatedPrize: number;
};

/**
 * Por vitória, o campeão recebe `roundValue` de cada um dos (n − 1) que perderam
 * (ele não paga a si mesmo).
 */
export function receiptPerWin(memberCount: number, roundValue: number): number {
  const n = memberCount;
  const rv = Number(roundValue);
  if (n < 2 || !Number.isFinite(rv) || rv <= 0) return 0;
  return (n - 1) * rv;
}

/** Recebimento estimado = vitórias × (participantes − 1) × valor da rodada. */
export function aggregateWinnerStats(
  rounds: Round[],
  roundValue: number,
  members: LeagueMember[],
): WinnerStatsRow[] {
  const teamByUserId = new Map(members.map((m) => [m.userId, m.teamName]));
  const byWinner = new Map<string, { displayName: string; wins: number }>();
  const perWin = receiptPerWin(members.length, roundValue);

  for (const r of rounds) {
    const fromMember = teamByUserId.get(r.winnerId);
    const displayName = (fromMember && fromMember.trim()) || r.winnerName || r.winnerId;
    const cur = byWinner.get(r.winnerId) ?? { displayName, wins: 0 };
    byWinner.set(r.winnerId, {
      displayName: cur.displayName || displayName,
      wins: cur.wins + 1,
    });
  }

  return [...byWinner.entries()]
    .map(([winnerId, v]) => ({
      winnerId,
      displayName: v.displayName,
      wins: v.wins,
      estimatedPrize: v.wins * perWin,
    }))
    .sort((a, b) => b.wins - a.wins);
}

export function roundsSorted(rounds: Round[]): Round[] {
  return [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
}

/** Total de rodadas do campeonato (Brasileirão) para % e fluxo financeiro estimado. */
export const SEASON_TOTAL_ROUNDS = 38;

export type SeasonPlayerLine = {
  userId: string;
  displayName: string;
  wins: number;
  roundsWon: number[];
  recebimentos: number;
  perdas: number;
  lucro: number;
  pctVitórias: number;
};

export function formatBRL(value: number): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(value));
  if (value < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Fluxo financeiro (somente rodadas já registradas na liga):
 * - Por vitória: campeão recebe (n − 1) × valor da rodada (cada perdedor paga esse valor).
 * - Em cada rodada registrada em que não venceu: paga `valor da rodada` ao campeão.
 * - Recebimentos = vitórias × (n − 1) × valor da rodada.
 * - Perdas = −(rodadas registradas − vitórias) × valor da rodada.
 * - Lucro = recebimentos + perdas.
 */
export function computeSeasonPlayerLines(
  members: LeagueMember[],
  rounds: Round[],
  roundValue: number,
): SeasonPlayerLine[] {
  const n = members.length;
  const rv = Number(roundValue);
  if (n === 0 || !Number.isFinite(rv) || rv <= 0) return [];

  const perWin = receiptPerWin(n, rv);
  const winsByUser = new Map<string, number>();
  const roundsWonByUser = new Map<string, number[]>();

  for (const r of rounds) {
    const id = r.winnerId;
    winsByUser.set(id, (winsByUser.get(id) ?? 0) + 1);
    const arr = roundsWonByUser.get(id) ?? [];
    arr.push(r.roundNumber);
    roundsWonByUser.set(id, arr);
  }
  for (const arr of roundsWonByUser.values()) {
    arr.sort((a, b) => a - b);
  }

  const registeredRounds = rounds.length;

  const lines: SeasonPlayerLine[] = members.map((m) => {
    const wins = winsByUser.get(m.userId) ?? 0;
    const roundsWon = roundsWonByUser.get(m.userId) ?? [];
    const displayName = (m.teamName?.trim() || m.userName || m.userId).trim();
    const recebimentos = wins * perWin;
    const perdas =
      registeredRounds > 0 ? -(registeredRounds - wins) * rv : 0;
    const lucro = recebimentos + perdas;
    const pctVitórias =
      registeredRounds > 0 ? (wins / registeredRounds) * 100 : 0;

    return {
      userId: m.userId,
      displayName,
      wins,
      roundsWon,
      recebimentos,
      perdas,
      lucro,
      pctVitórias,
    };
  });

  lines.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });

  return lines;
}

export function buildWinnerByRound(rounds: Round[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const r of roundsSorted(rounds)) {
    map.set(r.roundNumber, r.winnerName);
  }
  return map;
}

export function getLastRegisteredRound(rounds: Round[]): Round | null {
  if (rounds.length === 0) return null;
  const maxNum = Math.max(...rounds.map((r) => r.roundNumber));
  const candidates = rounds.filter((r) => r.roundNumber === maxNum);
  return candidates.reduce((best, r) => {
    const t = new Date(r.registeredAt).getTime();
    const bt = new Date(best.registeredAt).getTime();
    return t >= bt ? r : best;
  });
}
