"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeagueMember, Round } from "@/lib/types/api";
import { aggregateWinnerStats, receiptPerWin, roundsSorted } from "@/lib/stats";

const COLORS = [
  "#059669",
  "#0d9488",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#db2777",
  "#ea580c",
];

type Props = {
  rounds: Round[];
  roundValue: number;
  members: LeagueMember[];
};

export function LeagueStatsCharts({ rounds, roundValue, members }: Props) {
  const ranking = useMemo(
    () => aggregateWinnerStats(rounds, roundValue, members),
    [rounds, roundValue, members],
  );

  const barData = useMemo(
    () =>
      ranking.map((r) => ({
        nome: r.displayName.length > 14 ? `${r.displayName.slice(0, 12)}…` : r.displayName,
        vitórias: r.wins,
      })),
    [ranking],
  );

  const pieData = useMemo(() => {
    const totalWins = rounds.length;
    if (totalWins === 0) return [];
    return ranking.map((r) => ({
      name: r.displayName.length > 18 ? `${r.displayName.slice(0, 16)}…` : r.displayName,
      value: r.wins,
    }));
  }, [ranking, rounds.length]);

  const prizePerWin = useMemo(
    () => receiptPerWin(members.length, roundValue),
    [members.length, roundValue],
  );

  const cumulativeByLeader = useMemo(() => {
    const sorted = roundsSorted(rounds);
    if (sorted.length === 0 || ranking.length === 0) return [];
    const leaderId = ranking[0].winnerId;
    let acc = 0;
    return sorted.map((r) => {
      if (r.winnerId === leaderId) acc += prizePerWin;
      return {
        rodada: r.roundNumber,
        acumuladoLíder: acc,
      };
    });
  }, [rounds, prizePerWin, ranking]);

  if (rounds.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
        Ainda não há rodadas registradas. Os gráficos aparecerão quando houver campeões.
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Vitórias por participante</h2>
        <div className="h-72 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
              <XAxis dataKey="nome" angle={-25} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--color-zinc-200, #e4e4e7)",
                }}
              />
              <Bar dataKey="vitórias" fill="#059669" radius={[4, 4, 0, 0]} name="Vitórias" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Participação nas vitórias (%)</h2>
          <div className="h-72 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${String(name)}: ${((percent ?? 0) * 100).toFixed(1)}%`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Prêmio acumulado do líder em vitórias</h2>
          <p className="mb-2 text-xs text-zinc-500">
            {`Por vitória: (${members.length} − 1) × R$ ${roundValue.toFixed(2)} = R$ ${prizePerWin.toFixed(2)} dos demais (cada perdedor paga R$ ${roundValue.toFixed(2)} ao campeão). Acumulado só nas rodadas em que o líder venceu.`}
          </p>
          <div className="h-72 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeByLeader} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="rodada" tick={{ fontSize: 11 }} name="Rodada" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(value) => [
                    typeof value === "number" ? `R$ ${value.toFixed(2)}` : String(value),
                    "Acumulado",
                  ]}
                  labelFormatter={(l) => `Rodada ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="acumuladoLíder"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                  name="Acumulado"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
