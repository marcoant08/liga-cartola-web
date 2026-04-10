"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LeagueStatsCharts } from "@/components/league-stats-charts";
import { leaguesApi } from "@/lib/api/leagues";
import { aggregateWinnerStats } from "@/lib/stats";

export default function LeagueStatsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: league, isLoading, error } = useQuery({
    queryKey: ["league", id],
    queryFn: () => leaguesApi.get(id),
  });

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

  const rounds = league.rounds ?? [];
  const ranking = aggregateWinnerStats(rounds, league.roundValue, league.members ?? []);
  const leader = ranking[0];
  const totalRounds = rounds.length;

  return (
    <div>
      <Link
        href={`/leagues/${id}`}
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Voltar à liga
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Estatísticas — {league.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Valor da rodada: <strong>R$ {Number(league.roundValue).toFixed(2)}</strong>. O “total estimado em
        prêmios” considera <strong>vitórias × valor da rodada</strong> (não inclui pagamentos entre
        participantes).
      </p>

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
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Maior prêmio estimado</p>
          <p className="mt-1 text-2xl font-semibold">
            {leader ? `R$ ${leader.estimatedPrize.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Ranking</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
              <tr>
                <th className="px-4 py-3 font-medium">Participante</th>
                <th className="px-4 py-3 font-medium">Vitórias</th>
                <th className="px-4 py-3 font-medium">Total estimado em prêmios</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                    Nenhuma rodada ainda.
                  </td>
                </tr>
              ) : (
                ranking.map((row) => (
                  <tr
                    key={row.winnerId}
                    className="border-b border-zinc-100 dark:border-zinc-800/80"
                  >
                    <td className="px-4 py-3">{row.displayName}</td>
                    <td className="px-4 py-3">{row.wins}</td>
                    <td className="px-4 py-3">R$ {row.estimatedPrize.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">Gráficos</h2>
        <LeagueStatsCharts
          rounds={rounds}
          roundValue={Number(league.roundValue)}
          members={league.members ?? []}
        />
      </div>
    </div>
  );
}
