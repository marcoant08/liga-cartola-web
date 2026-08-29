"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LeagueStatsCharts } from "@/components/league-stats-charts";
import { LeagueStatsTextBlocks } from "@/components/league-stats-text-blocks";
import { SitePresenceStats } from "@/components/site-presence-stats";
import { StatsPageFloatControls } from "@/components/stats-page-float-controls";
import { useAuth } from "@/contexts/auth-context";
import { leaguesApi } from "@/lib/api/leagues";
import { leagueAccessErrorMessage } from "@/lib/league-access-error";
import {
  aggregateWinnerStats,
  buildWinnerByRound,
  computeSeasonPlayerLines,
  getLastRegisteredRound,
  longestDroughtHistoryEvents,
} from "@/lib/stats";

export default function LeagueStatsPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

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
    const deserters = league.deserters ?? [];
    const roundValue = Number(league.roundValue);
    return {
      players: computeSeasonPlayerLines(members, rounds, roundValue, deserters),
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
      league.deserters ?? [],
    );
  }, [league]);

  const leadersTiedWins = useMemo(() => {
    if (ranking.length === 0) return [];
    const maxWins = ranking[0].wins;
    return ranking.filter((r) => r.wins === maxWins);
  }, [ranking]);

  const members = league?.members ?? [];
  const rounds = league?.rounds ?? [];
  const deserters = league?.deserters ?? [];

  const longestDroughts = useMemo(() => {
    if (!league) return [];
    return longestDroughtHistoryEvents(members, rounds, deserters);
  }, [league, members, rounds, deserters]);

  const roundValue = Number(league?.roundValue ?? 0);
  const leader = ranking[0];
  const totalRounds = rounds.length;

  if (isLoading) {
    return (
      <div>
        <StatsPageFloatControls />
        <p className="text-zinc-500">Carregando estatísticas…</p>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div>
        <StatsPageFloatControls />
        <Link
          href={user ? "/" : "/login"}
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {user ? "← Minhas ligas" : "← Entrar na conta"}
        </Link>
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error ? leagueAccessErrorMessage(error) : "Liga não encontrada."}
        </p>
      </div>
    );
  }

  const isMember = !!(user && (league.members ?? []).some((m) => m.userId === user.id));
  const isPublicLeague = league.isPublic ?? false;

  return (
    <div>
      <StatsPageFloatControls />
      <h1 className="pr-14 text-2xl font-semibold">Estatísticas — {league.name}</h1>

      {isPublicLeague && !isMember && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          {!user ? (
            <p>
              Vista pública destas estatísticas.{" "}
              <Link href="/login" className="font-medium text-emerald-800 underline dark:text-emerald-300">
                Entrar
              </Link>{" "}
              para gerenciar ou entrar na liga com convite.
            </p>
          ) : (
            <p>Você não é membro: vê apenas o que a liga expõe publicamente.</p>
          )}
        </div>
      )}
      <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Valor da rodada: <strong>R$ {roundValue.toFixed(2)}</strong> · {members.length} participante
          {members.length === 1 ? "" : "s"}
          {deserters.length > 0 ? ` (${deserters.length} desertor${deserters.length === 1 ? "" : "es"})` : ""}.
        </p>
        <p>
          O <strong>valor da rodada</strong> é o que cada <strong>perdedor</strong> paga ao campeão. O campeão
          recebe <strong>(participantes ativos na rodada − 1) × valor da rodada</strong> por vitória.{" "}
          {deserters.length > 0 && (
            <>Desertores só participam até a rodada anterior à desistência.{" "}</>
          )}
          <strong>Perdas</strong> e <strong>lucros</strong> consideram apenas as rodadas{" "}
          <strong>já registradas</strong> na liga. O percentual de vitórias também usa só essas rodadas.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rodadas registradas</p>
          <p className="mt-1 text-2xl font-semibold">{totalRounds}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Líder em vitórias</p>
          {leadersTiedWins.length > 0 ? (
            <>
              <p className="mt-1 text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                {leadersTiedWins.map((r) => r.displayName).join(" · ")}
              </p>
              <p className="text-sm text-zinc-500">
                {leadersTiedWins[0].wins} vitória{leadersTiedWins[0].wins === 1 ? "" : "s"}
                {leadersTiedWins.length > 1 ? " (empate)" : ""}
              </p>
            </>
          ) : (
            <p className="mt-1 text-lg font-semibold">—</p>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Maior recebimento
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {leader ? `R$ ${leader.estimatedPrize.toFixed(2)}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 dark:border-amber-900/50 dark:bg-amber-950/25">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
            Maior jejum da história
          </p>
          {totalRounds === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Ainda não há rodadas registradas.</p>
          ) : members.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Sem participantes na liga.</p>
          ) : longestDroughts.length > 0 ? (
            <>
              <p className="mt-1 text-2xl font-semibold text-amber-950 dark:text-amber-50">
                {longestDroughts[0].length}{" "}
                <span className="text-lg font-medium text-amber-900/90 dark:text-amber-100/90">
                  rodada{longestDroughts[0].length === 1 ? "" : "s"}
                </span>
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-amber-950 dark:text-amber-100">
                {longestDroughts
                  .map((e) => {
                    const span =
                      e.fromRound === e.toRound
                        ? `rodada ${e.fromRound}`
                        : `rodadas ${e.fromRound}–${e.toRound}`;
                    return `${e.displayName} (${span})`;
                  })
                  .join(" · ")}
              </p>
              <p className="mt-2 text-xs text-amber-900/75 dark:text-amber-200/80">
                Maior sequência consecutiva sem vitória desde o início da liga. Ao vencer, a contagem zera.
                {deserters.length > 0 ? " Quem desistiu só conta até a rodada anterior à desistência." : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">—</p>
          )}
        </div>
      </div>

      <SitePresenceStats />

      <LeagueStatsTextBlocks
        roundValue={roundValue}
        memberCount={members.length}
        members={members}
        rounds={rounds}
        deserters={deserters}
        registeredRoundsCount={rounds.length}
        players={seasonStats.players}
        winnerByRound={seasonStats.winnerByRound}
        lastRound={seasonStats.lastRound}
      />

      <div id="graficos" className="mt-12 scroll-mt-4">
        <h2 className="mb-4 text-lg font-semibold">Gráficos</h2>
        <LeagueStatsCharts
          rounds={rounds}
          roundValue={roundValue}
          members={members}
          deserters={deserters}
          players={seasonStats.players}
        />
      </div>
    </div>
  );
}
