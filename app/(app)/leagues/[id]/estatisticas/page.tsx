"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LeagueStatsCharts } from "@/components/league-stats-charts";
import { LeagueStatsTextBlocks } from "@/components/league-stats-text-blocks";
import { leaguesApi } from "@/lib/api/leagues";
import {
  aggregateWinnerStats,
  buildWinnerByRound,
  computeSeasonPlayerLines,
  getLastRegisteredRound,
  SEASON_TOTAL_ROUNDS,
} from "@/lib/stats";

export default function LeagueStatsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: league, isLoading, error } = useQuery({
    queryKey: ["league", id],
    queryFn: () => leaguesApi.get(id),
  });

  const seasonStats = useMemo(() => {
    if (!league) {
      return {
        players: [] as ReturnType<typeof computeSeasonPlayerLines>,
        winnerByRound: new Map<number, string>(),
        lastRound: null as ReturnType<typeof getLastRegisteredRound>,
      };
    }
    const members = league.members ?? [];
    const rounds = league.rounds ?? [];
    const roundValue = Number(league.roundValue);
    return {
      players: computeSeasonPlayerLines(members, rounds, roundValue),
      winnerByRound: buildWinnerByRound(rounds),
      lastRound: getLastRegisteredRound(rounds),
    };
  }, [league]);

  const ranking = useMemo(() => {
    if (!league) return [];
    return aggregateWinnerStats(
      league.rounds ?? [],
      Number(league.roundValue),
      league.members ?? [],
    );
  }, [league]);

  const members = league?.members ?? [];
  const rounds = league?.rounds ?? [];
  const roundValue = Number(league?.roundValue ?? 0);
  const leader = ranking[0];
  const totalRounds = rounds.length;

  if (isLoading) {
    return <p className="text-zinc-500">Carregando estatísticas…</p>;
  }

  if (error || !league) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-red-800 dark:bg-red-950/40 dark:text-red-200">
        Liga não encontrada ou sem permissão.
      </p>
    );
  }

  return (
    <div>
      <Link
        href={`/leagues/${id}`}
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Voltar à liga
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Estatísticas — {league.name}</h1>
      <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Valor da rodada: <strong>R$ {roundValue.toFixed(2)}</strong> · {members.length} participante
          {members.length === 1 ? "" : "s"}.
        </p>
        <p>
          Percentuais e fluxo financeiro (recebimentos, perdas, lucros) usam <strong>{SEASON_TOTAL_ROUNDS} rodadas</strong>{" "}
          do campeonato e o rateio <strong>valor da rodada ÷ número de participantes</strong> nas rodadas em que o
          jogador não vence.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rodadas registradas</p>
          <p className="mt-1 text-2xl font-semibold">{totalRounds}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Líder em vitórias</p>
          <p className="mt-1 truncate text-lg font-semibold">{leader?.displayName ?? "—"}</p>
          <p className="text-sm text-zinc-500">{leader ? `${leader.wins} vitória(s)` : ""}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Maior prêmio (vitórias × rodada)</p>
          <p className="mt-1 text-2xl font-semibold">
            {leader ? `R$ ${leader.estimatedPrize.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>

      <LeagueStatsTextBlocks
        roundValue={roundValue}
        memberCount={members.length}
        members={members}
        players={seasonStats.players}
        winnerByRound={seasonStats.winnerByRound}
        lastRound={seasonStats.lastRound}
      />

      <div className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">Gráficos</h2>
        <LeagueStatsCharts rounds={rounds} roundValue={roundValue} members={members} />
      </div>
    </div>
  );
}
