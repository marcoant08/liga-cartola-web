"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeagueMember, Round } from "@/lib/types/api";
import { aggregateWinnerStats, type SeasonPlayerLine } from "@/lib/stats";

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

function shortLabel(name: string, max = 14): string {
  const t = name.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

type Props = {
  rounds: Round[];
  roundValue: number;
  members: LeagueMember[];
  players: SeasonPlayerLine[];
};

export function LeagueStatsCharts({ rounds, roundValue, members, players }: Props) {
  const ranking = useMemo(
    () => aggregateWinnerStats(rounds, roundValue, members),
    [rounds, roundValue, members],
  );

  const barData = useMemo(
    () =>
      ranking.map((r) => ({
        nome: shortLabel(r.displayName),
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

  const top5Ganhos = useMemo(
    () =>
      [...players]
        .sort(
          (a, b) =>
            b.recebimentos - a.recebimentos ||
            a.displayName.localeCompare(b.displayName, "pt-BR"),
        )
        .slice(0, 5)
        .map((p) => ({
          nome: shortLabel(p.displayName),
          valor: p.recebimentos,
        })),
    [players],
  );

  const top5Perdas = useMemo(
    () =>
      [...players]
        .sort(
          (a, b) =>
            a.perdas - b.perdas || a.displayName.localeCompare(b.displayName, "pt-BR"),
        )
        .slice(0, 5)
        .map((p) => ({
          nome: shortLabel(p.displayName),
          valor: p.perdas,
        })),
    [players],
  );

  const top5Lucros = useMemo(
    () =>
      [...players]
        .sort(
          (a, b) => b.lucro - a.lucro || a.displayName.localeCompare(b.displayName, "pt-BR"),
        )
        .slice(0, 5)
        .map((p) => ({
          nome: shortLabel(p.displayName),
          valor: p.lucro,
        })),
    [players],
  );

  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
        Nenhum participante na liga.
      </p>
    );
  }

  const moneyFmt = (v: unknown) =>
    `R$ ${typeof v === "number" ? v.toFixed(2) : String(v ?? "—")}`;

  return (
    <div className="grid gap-8">
      {rounds.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Ainda não há rodadas registradas. Os gráficos de vitórias abaixo ficam vazios; os de valores
          financeiros usam só as rodadas já cadastradas (neste momento, zeros).
        </p>
      ) : null}

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

      <section className="grid gap-8 lg:grid-cols-3">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Top 5 — maiores ganhos (recebimentos)</h2>
          <p className="mb-2 text-xs text-zinc-500">
            Estimado: vitórias × (participantes − 1) × valor da rodada.
          </p>
          <div className="h-72 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5Ganhos} margin={{ top: 8, right: 8, left: 4, bottom: 52 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" height={56} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => [moneyFmt(v), "Recebimentos"]} />
                <Bar dataKey="valor" fill="#059669" radius={[4, 4, 0, 0]} name="Recebimentos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Top 5 — maiores perdas</h2>
          <p className="mb-2 text-xs text-zinc-500">
            Valores negativos: rodadas registradas em que não venceu × valor da rodada.
          </p>
          <div className="h-72 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5Perdas} margin={{ top: 8, right: 8, left: 4, bottom: 52 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" height={56} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => [moneyFmt(v), "Perdas"]} />
                <Bar dataKey="valor" fill="#dc2626" radius={[4, 4, 0, 0]} name="Perdas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Top 5 — maiores lucros</h2>
          <p className="mb-2 text-xs text-zinc-500">Recebimentos + perdas (estimado).</p>
          <div className="h-72 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5Lucros} margin={{ top: 8, right: 8, left: 4, bottom: 52 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" height={56} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => [moneyFmt(v), "Lucro"]} />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                <Bar dataKey="valor" name="Lucro" radius={[4, 4, 0, 0]}>
                  {top5Lucros.map((e, i) => (
                    <Cell key={i} fill={e.valor >= 0 ? "#059669" : "#dc2626"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section>
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
      </section>
    </div>
  );
}
