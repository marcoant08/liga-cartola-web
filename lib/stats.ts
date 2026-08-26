import type { Deserter, LeagueMember, Round } from "@/lib/types/api";

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

/**
 * Recebimento estimado por rodada considerando desertores.
 * O prêmio de cada vitória é (participantes ativos naquela rodada − 1) × valor da rodada.
 */
export function aggregateWinnerStats(
  rounds: Round[],
  roundValue: number,
  members: LeagueMember[],
  deserters: Deserter[] = [],
): WinnerStatsRow[] {
  const teamByUserId = new Map(members.map((m) => [m.userId, m.teamName]));
  const deserterMap = new Map(deserters.map((d) => [d.memberId, d.desertedAtRound]));
  const rv = Number(roundValue);
  const byWinner = new Map<string, { displayName: string; wins: number; prize: number }>();

  const timeline = canonicalRoundsTimeline(rounds);

  for (const r of timeline) {
    const activeCount = members.filter(
      (m) => r.roundNumber < memberRoundCutoff(m.userId, deserterMap),
    ).length;
    const perWinThisRound = activeCount >= 2 ? (activeCount - 1) * rv : 0;

    const fromMember = teamByUserId.get(r.winnerId);
    const displayName = (fromMember && fromMember.trim()) || r.winnerName || r.winnerId;
    const cur = byWinner.get(r.winnerId) ?? { displayName, wins: 0, prize: 0 };
    byWinner.set(r.winnerId, {
      displayName: cur.displayName || displayName,
      wins: cur.wins + 1,
      prize: cur.prize + perWinThisRound,
    });
  }

  return [...byWinner.entries()]
    .map(([winnerId, v]) => ({
      winnerId,
      displayName: v.displayName,
      wins: v.wins,
      estimatedPrize: v.prize,
    }))
    .sort((a, b) => b.wins - a.wins);
}

export function roundsSorted(rounds: Round[]): Round[] {
  return [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
}

/** Uma entrada por `roundNumber`: em caso de re-registro, vale o `registeredAt` mais recente. */
export function canonicalRoundsTimeline(rounds: Round[]): Round[] {
  const byNum = new Map<number, Round>();
  for (const r of rounds) {
    const prev = byNum.get(r.roundNumber);
    const t = new Date(r.registeredAt).getTime();
    if (!prev || t >= new Date(prev.registeredAt).getTime()) {
      byNum.set(r.roundNumber, r);
    }
  }
  return [...byNum.keys()]
    .sort((a, b) => a - b)
    .map((n) => byNum.get(n)!);
}

/** Total de rodadas do campeonato (Brasileirão) para % e fluxo financeiro estimado. */
export const SEASON_TOTAL_ROUNDS = 38;

/**
 * Próxima rodada sugerida para registro: maior `roundNumber` já presente + 1, limitado a `totalRounds`.
 * Sem rodadas, retorna 1.
 */
export function nextRoundToRegister(
  rounds: Round[],
  totalRounds: number = SEASON_TOTAL_ROUNDS,
): number {
  if (rounds.length === 0) return 1;
  const maxRound = Math.max(...rounds.map((r) => r.roundNumber));
  return Math.min(totalRounds, Math.max(1, maxRound + 1));
}

export type SeasonPlayerLine = {
  userId: string;
  displayName: string;
  wins: number;
  roundsWon: number[];
  roundsParticipated: number;
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
 * Retorna a rodada-limite (exclusiva) para um membro: rodadas com `roundNumber < limite` contam.
 * Desertores com `desertedAtRound = N` participam até a rodada N-1.
 * Membros normais não têm limite (Infinity).
 */
function memberRoundCutoff(
  userId: string,
  deserterMap: Map<string, number>,
): number {
  const desertedAt = deserterMap.get(userId);
  return desertedAt != null ? desertedAt : Infinity;
}

/**
 * Fluxo financeiro (somente rodadas já registradas na liga):
 * - Por vitória: campeão recebe (n − 1) × valor da rodada (cada perdedor paga esse valor).
 * - Em cada rodada registrada em que não venceu: paga `valor da rodada` ao campeão.
 * - Recebimentos = vitórias × (n − 1) × valor da rodada.
 * - Perdas = −(rodadas registradas − vitórias) × valor da rodada.
 * - Lucro = recebimentos + perdas.
 *
 * Desertores: um membro que desistiu na rodada N só participa até a rodada N-1.
 * A partir da rodada N, não paga nem recebe.
 * O número de participantes ativos por rodada é recalculado para cada rodada.
 */
export function computeSeasonPlayerLines(
  members: LeagueMember[],
  rounds: Round[],
  roundValue: number,
  deserters: Deserter[] = [],
): SeasonPlayerLine[] {
  const n = members.length;
  const rv = Number(roundValue);
  if (n === 0 || !Number.isFinite(rv) || rv <= 0) return [];

  const deserterMap = new Map(deserters.map((d) => [d.memberId, d.desertedAtRound]));

  const timeline = canonicalRoundsTimeline(rounds);

  const recebimentosByUser = new Map<string, number>();
  const perdasByUser = new Map<string, number>();
  const winsByUser = new Map<string, number>();
  const roundsWonByUser = new Map<string, number[]>();
  const roundsParticipatedByUser = new Map<string, number>();

  for (const r of timeline) {
    const activeMembers = members.filter(
      (m) => r.roundNumber < memberRoundCutoff(m.userId, deserterMap),
    );
    const activeCount = activeMembers.length;
    if (activeCount < 2) continue;

    const perWinThisRound = (activeCount - 1) * rv;

    for (const m of activeMembers) {
      const participated = (roundsParticipatedByUser.get(m.userId) ?? 0) + 1;
      roundsParticipatedByUser.set(m.userId, participated);

      if (r.winnerId === m.userId) {
        winsByUser.set(m.userId, (winsByUser.get(m.userId) ?? 0) + 1);
        const arr = roundsWonByUser.get(m.userId) ?? [];
        arr.push(r.roundNumber);
        roundsWonByUser.set(m.userId, arr);
        recebimentosByUser.set(
          m.userId,
          (recebimentosByUser.get(m.userId) ?? 0) + perWinThisRound,
        );
      } else {
        perdasByUser.set(m.userId, (perdasByUser.get(m.userId) ?? 0) - rv);
      }
    }
  }

  for (const arr of roundsWonByUser.values()) {
    arr.sort((a, b) => a - b);
  }

  const lines: SeasonPlayerLine[] = members.map((m) => {
    const wins = winsByUser.get(m.userId) ?? 0;
    const roundsWon = roundsWonByUser.get(m.userId) ?? [];
    const displayName = (m.teamName?.trim() || m.userName || m.userId).trim();
    const recebimentos = recebimentosByUser.get(m.userId) ?? 0;
    const perdas = perdasByUser.get(m.userId) ?? 0;
    const lucro = recebimentos + perdas;
    const participated = roundsParticipatedByUser.get(m.userId) ?? 0;
    const pctVitórias = participated > 0 ? (wins / participated) * 100 : 0;

    return {
      userId: m.userId,
      displayName,
      wins,
      roundsWon,
      roundsParticipated: participated,
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

/** Ponto do gráfico de vitórias acumuladas: `rodadas` é o k (0…N); cada `userId` é o total ou `null` após desistência. */
export type WinsOverRegisteredRoundPoint = {
  rodadas: number;
} & Record<string, number | null>;

/**
 * Vitórias acumuladas após k rodadas já registradas (timeline canônica).
 * k = 0 começa em 0 para todos. Desertores ficam `null` a partir da rodada em que desistiram.
 */
export function computeWinsOverRegisteredRounds(
  members: LeagueMember[],
  rounds: Round[],
  deserters: Deserter[] = [],
): WinsOverRegisteredRoundPoint[] {
  if (members.length === 0) return [];

  const deserterMap = new Map(deserters.map((d) => [d.memberId, d.desertedAtRound]));
  const timeline = canonicalRoundsTimeline(rounds);
  const wins = new Map<string, number>(members.map((m) => [m.userId, 0]));

  const snapshot = (k: number, roundNumber: number | null): WinsOverRegisteredRoundPoint => {
    const row: WinsOverRegisteredRoundPoint = { rodadas: k };
    for (const m of members) {
      const cutoff = memberRoundCutoff(m.userId, deserterMap);
      if (roundNumber != null && roundNumber >= cutoff) {
        row[m.userId] = null;
      } else {
        row[m.userId] = wins.get(m.userId) ?? 0;
      }
    }
    return row;
  };

  const points: WinsOverRegisteredRoundPoint[] = [snapshot(0, null)];

  for (let i = 0; i < timeline.length; i++) {
    const r = timeline[i];
    const cutoffWinner = memberRoundCutoff(r.winnerId, deserterMap);
    if (r.roundNumber < cutoffWinner) {
      wins.set(r.winnerId, (wins.get(r.winnerId) ?? 0) + 1);
    }
    points.push(snapshot(i + 1, r.roundNumber));
  }

  return points;
}

/**
 * Jejum consecutivo após k rodadas registradas.
 * Cada sequência é uma série à parte: ao vencer, a linha anterior termina (com marcador no pico)
 * e a próxima começa do zero, sem conectar os dois.
 */
export function droughtStreakSegKey(userId: string, segment: number): string {
  return `${userId}::s${segment}`;
}

export function droughtStreakDotKey(userId: string): string {
  return `${userId}::__dot`;
}

export function droughtStreakDashKey(userId: string, segment: number): string {
  return `${userId}::d${segment}`;
}

export type DroughtStreakSegmentSeries = {
  userId: string;
  dataKey: string;
  isFirst: boolean;
};

export type DroughtStreakDashSeries = {
  userId: string;
  dataKey: string;
};

export type DroughtStreakOverRoundsResult = {
  points: WinsOverRegisteredRoundPoint[];
  segments: DroughtStreakSegmentSeries[];
  dashes: DroughtStreakDashSeries[];
};

export function computeDroughtStreakOverRegisteredRounds(
  members: LeagueMember[],
  rounds: Round[],
  deserters: Deserter[] = [],
): DroughtStreakOverRoundsResult {
  if (members.length === 0) {
    return { points: [], segments: [], dashes: [] };
  }

  const deserterMap = new Map(deserters.map((d) => [d.memberId, d.desertedAtRound]));
  const timeline = canonicalRoundsTimeline(rounds);
  const lastK = timeline.length;
  const streak = new Map<string, number>(members.map((m) => [m.userId, 0]));
  const segIdx = new Map<string, number>(members.map((m) => [m.userId, 0]));
  const maxSeg = new Map<string, number>(members.map((m) => [m.userId, 0]));
  const inactive = new Set<string>();
  const dashes: DroughtStreakDashSeries[] = [];
  const dashKeys = new Set<string>();

  const points: WinsOverRegisteredRoundPoint[] = Array.from(
    { length: lastK + 1 },
    (_, k) => ({ rodadas: k }),
  );

  const paintDash = (userId: string, segment: number, fromK: number, value: number) => {
    const key = droughtStreakDashKey(userId, segment);
    for (let t = fromK; t <= lastK; t++) {
      points[t][key] = value;
    }
    if (!dashKeys.has(key)) {
      dashKeys.add(key);
      dashes.push({ userId, dataKey: key });
    }
  };

  for (const m of members) {
    points[0][droughtStreakSegKey(m.userId, 0)] = 0;
  }

  for (let i = 0; i < timeline.length; i++) {
    const r = timeline[i];
    const k = i + 1;
    const prev = i;

    for (const m of members) {
      const cutoff = memberRoundCutoff(m.userId, deserterMap);
      if (r.roundNumber >= cutoff) {
        if (!inactive.has(m.userId)) {
          const s = streak.get(m.userId) ?? 0;
          if (s > 0) {
            points[prev][droughtStreakDotKey(m.userId)] = s;
            paintDash(m.userId, segIdx.get(m.userId) ?? 0, prev, s);
          }
          inactive.add(m.userId);
        }
        continue;
      }

      if (r.winnerId === m.userId) {
        const s = streak.get(m.userId) ?? 0;
        if (s > 0) {
          const endedSeg = segIdx.get(m.userId) ?? 0;
          points[prev][droughtStreakDotKey(m.userId)] = s;
          paintDash(m.userId, endedSeg, prev, s);
          const nextSeg = endedSeg + 1;
          segIdx.set(m.userId, nextSeg);
          maxSeg.set(m.userId, nextSeg);
          streak.set(m.userId, 0);
          points[k][droughtStreakSegKey(m.userId, nextSeg)] = 0;
        } else {
          points[k][droughtStreakSegKey(m.userId, segIdx.get(m.userId) ?? 0)] = 0;
        }
      } else {
        const next = (streak.get(m.userId) ?? 0) + 1;
        streak.set(m.userId, next);
        points[k][droughtStreakSegKey(m.userId, segIdx.get(m.userId) ?? 0)] = next;
      }
    }
  }

  const segments: DroughtStreakSegmentSeries[] = [];
  for (const m of members) {
    const last = maxSeg.get(m.userId) ?? 0;
    for (let s = 0; s <= last; s++) {
      segments.push({
        userId: m.userId,
        dataKey: droughtStreakSegKey(m.userId, s),
        isFirst: s === 0,
      });
    }
  }

  for (const row of points) {
    for (const m of members) {
      const last = maxSeg.get(m.userId) ?? 0;
      for (let s = 0; s <= last; s++) {
        const key = droughtStreakSegKey(m.userId, s);
        if (row[key] === undefined) row[key] = null;
      }
      const dKey = droughtStreakDotKey(m.userId);
      if (row[dKey] === undefined) row[dKey] = null;
    }
    for (const dash of dashes) {
      if (row[dash.dataKey] === undefined) row[dash.dataKey] = null;
    }
  }

  return { points, segments, dashes };
}

export function buildWinnerByRound(rounds: Round[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const r of canonicalRoundsTimeline(rounds)) {
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

/** Por jogador: quantas rodadas **já registradas** seguem desde a mais recente (maior número de rodada) até a última em que foi campeão. Quem nunca venceu conta todas as rodadas registradas. */
export type WinDroughtRow = {
  userId: string;
  displayName: string;
  roundsSinceLastWin: number;
};

export function computeRoundsSinceLastWin(
  members: LeagueMember[],
  rounds: Round[],
  deserters: Deserter[] = [],
): WinDroughtRow[] {
  if (members.length === 0) return [];
  const sorted = canonicalRoundsTimeline(rounds);
  const deserterMap = new Map(deserters.map((d) => [d.memberId, d.desertedAtRound]));

  const rows: WinDroughtRow[] = members.map((m) => {
    const displayName = (m.teamName?.trim() || m.userName || m.userId).trim();
    const cutoff = memberRoundCutoff(m.userId, deserterMap);
    const memberRounds = sorted.filter((r) => r.roundNumber < cutoff);
    if (memberRounds.length === 0) {
      return { userId: m.userId, displayName, roundsSinceLastWin: 0 };
    }
    let count = 0;
    for (let i = memberRounds.length - 1; i >= 0; i--) {
      if (memberRounds[i].winnerId === m.userId) break;
      count++;
    }
    return { userId: m.userId, displayName, roundsSinceLastWin: count };
  });

  rows.sort((a, b) => {
    if (b.roundsSinceLastWin !== a.roundsSinceLastWin) {
      return b.roundsSinceLastWin - a.roundsSinceLastWin;
    }
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });

  return rows;
}

export type DroughtHistoryEntry = {
  userId: string;
  displayName: string;
  length: number;
  fromRound: number;
  toRound: number;
};

/** Jejuns consecutivos sem vitória (rodadas da timeline canônica); encerra ao vencer, ao desistir, ou ao fim dos dados. */
export function computeDroughtHistoryEvents(
  members: LeagueMember[],
  rounds: Round[],
  deserters: Deserter[] = [],
): DroughtHistoryEntry[] {
  const timeline = canonicalRoundsTimeline(rounds);
  if (members.length === 0 || timeline.length === 0) return [];

  const deserterMap = new Map(deserters.map((d) => [d.memberId, d.desertedAtRound]));
  const out: DroughtHistoryEntry[] = [];

  for (const m of members) {
    const displayName = (m.teamName?.trim() || m.userName || m.userId).trim();
    const cutoff = memberRoundCutoff(m.userId, deserterMap);
    let streak = 0;
    let fromRound = 0;
    let toRound = 0;

    for (const r of timeline) {
      if (r.roundNumber >= cutoff) break;

      if (r.winnerId === m.userId) {
        if (streak > 0) {
          out.push({
            userId: m.userId,
            displayName,
            length: streak,
            fromRound,
            toRound,
          });
        }
        streak = 0;
      } else {
        if (streak === 0) fromRound = r.roundNumber;
        streak++;
        toRound = r.roundNumber;
      }
    }

    if (streak > 0) {
      out.push({
        userId: m.userId,
        displayName,
        length: streak,
        fromRound,
        toRound,
      });
    }
  }

  return out;
}

export function topDroughtHistoryEvents(
  members: LeagueMember[],
  rounds: Round[],
  limit = 10,
  deserters: Deserter[] = [],
): DroughtHistoryEntry[] {
  const events = computeDroughtHistoryEvents(members, rounds, deserters);
  events.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    if (b.toRound !== a.toRound) return b.toRound - a.toRound;
    if (a.fromRound !== b.fromRound) return a.fromRound - b.fromRound;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });
  return events.slice(0, limit);
}

/** Todos os jejuns com o maior comprimento da liga (empates incluídos). */
export function longestDroughtHistoryEvents(
  members: LeagueMember[],
  rounds: Round[],
  deserters: Deserter[] = [],
): DroughtHistoryEntry[] {
  const events = computeDroughtHistoryEvents(members, rounds, deserters);
  if (events.length === 0) return [];
  events.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    if (b.toRound !== a.toRound) return b.toRound - a.toRound;
    if (a.fromRound !== b.fromRound) return a.fromRound - b.fromRound;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });
  const max = events[0].length;
  return events.filter((e) => e.length === max);
}

/** Remove a rodada de maior `roundNumber` (a última na timeline canônica), para comparar ranking com o snapshot anterior. */
export function roundsExcludingHighestRoundNumber(rounds: Round[]): Round[] {
  if (rounds.length === 0) return [];
  const maxNum = Math.max(...rounds.map((r) => r.roundNumber));
  return rounds.filter((r) => r.roundNumber !== maxNum);
}

function droughtHistoryEntryKey(e: DroughtHistoryEntry): string {
  return `${e.userId}|${e.fromRound}|${e.toRound}`;
}

/**
 * Posição (1-based) do mesmo período de jejum na lista `prevTop` já ordenada como em `topDroughtHistoryEvents`,
 * ou `null` se não havia entrada equivalente (ex.: estreia no top após nova rodada).
 */
export function findDroughtHistoryEntryPreviousRank(
  curr: DroughtHistoryEntry,
  prevTop: DroughtHistoryEntry[],
  roundsPrev: Round[],
): number | null {
  if (prevTop.length === 0) return null;

  const rankByKey = new Map<string, number>();
  prevTop.forEach((p, idx) => {
    rankByKey.set(droughtHistoryEntryKey(p), idx + 1);
  });
  const exact = rankByKey.get(droughtHistoryEntryKey(curr));
  if (exact !== undefined) return exact;

  const prevTimeline = canonicalRoundsTimeline(roundsPrev);
  const prevLastRound =
    prevTimeline.length > 0 ? prevTimeline[prevTimeline.length - 1].roundNumber : null;
  if (prevLastRound === null) return null;

  for (let idx = 0; idx < prevTop.length; idx++) {
    const p = prevTop[idx];
    if (
      p.userId === curr.userId &&
      p.fromRound === curr.fromRound &&
      p.toRound === prevLastRound &&
      curr.toRound > prevLastRound
    ) {
      return idx + 1;
    }
  }
  return null;
}

export type DroughtHistoryRankTrend = "up" | "down" | "same" | "none";

/** Compara posição no top atual vs. após excluir a última rodada da timeline (menor número = melhor). */
export function droughtHistoryEntryRankTrend(
  curr: DroughtHistoryEntry,
  currRank1Based: number,
  members: LeagueMember[],
  rounds: Round[],
  limit: number,
  deserters: Deserter[] = [],
): DroughtHistoryRankTrend {
  const roundsPrev = roundsExcludingHighestRoundNumber(rounds);
  const prevTop = topDroughtHistoryEvents(members, roundsPrev, limit, deserters).filter((e) => e.length > 1);
  const prevRank = findDroughtHistoryEntryPreviousRank(curr, prevTop, roundsPrev);
  if (prevRank === null) return "none";
  if (currRank1Based < prevRank) return "up";
  if (currRank1Based > prevRank) return "down";
  return "same";
}

export type WinStreakHistoryEntry = DroughtHistoryEntry;

/** Vitórias consecutivas nas rodadas da timeline; encerra quando o jogador não é campeão. */
export function computeWinStreakHistoryEvents(
  members: LeagueMember[],
  rounds: Round[],
): WinStreakHistoryEntry[] {
  const timeline = canonicalRoundsTimeline(rounds);
  if (members.length === 0 || timeline.length === 0) return [];

  const out: WinStreakHistoryEntry[] = [];

  for (const m of members) {
    const displayName = (m.teamName?.trim() || m.userName || m.userId).trim();
    let streak = 0;
    let fromRound = 0;
    let toRound = 0;

    for (const r of timeline) {
      if (r.winnerId === m.userId) {
        if (streak === 0) fromRound = r.roundNumber;
        streak++;
        toRound = r.roundNumber;
      } else {
        if (streak > 0) {
          out.push({
            userId: m.userId,
            displayName,
            length: streak,
            fromRound,
            toRound,
          });
        }
        streak = 0;
      }
    }

    if (streak > 0) {
      out.push({
        userId: m.userId,
        displayName,
        length: streak,
        fromRound,
        toRound,
      });
    }
  }

  return out;
}

export function topWinStreakHistoryEvents(
  members: LeagueMember[],
  rounds: Round[],
  limit = 10,
): WinStreakHistoryEntry[] {
  const events = computeWinStreakHistoryEvents(members, rounds);
  events.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    if (b.toRound !== a.toRound) return b.toRound - a.toRound;
    if (a.fromRound !== b.fromRound) return a.fromRound - b.fromRound;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });
  return events.slice(0, limit);
}

/** Quantas rodadas consecutivas (a partir da mais recente na timeline) o jogador foi campeão. */
export type ConsecutiveWinsAtEndRow = {
  userId: string;
  displayName: string;
  consecutiveWinsAtEnd: number;
};

export function computeConsecutiveWinsAtEnd(
  members: LeagueMember[],
  rounds: Round[],
): ConsecutiveWinsAtEndRow[] {
  if (members.length === 0) return [];
  const timeline = canonicalRoundsTimeline(rounds);

  const rows: ConsecutiveWinsAtEndRow[] = members.map((m) => {
    const displayName = (m.teamName?.trim() || m.userName || m.userId).trim();
    if (timeline.length === 0) {
      return { userId: m.userId, displayName, consecutiveWinsAtEnd: 0 };
    }
    let count = 0;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].winnerId !== m.userId) break;
      count++;
    }
    return { userId: m.userId, displayName, consecutiveWinsAtEnd: count };
  });

  rows.sort((a, b) => {
    if (b.consecutiveWinsAtEnd !== a.consecutiveWinsAtEnd) {
      return b.consecutiveWinsAtEnd - a.consecutiveWinsAtEnd;
    }
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });

  return rows;
}
