"use client";

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import type { LeagueMember, Round } from "@/lib/types/api";
import {
  aggregateWinnerStats,
  computeRoundsSinceLastWin,
  topDroughtHistoryEvents,
  topWinStreakHistoryEvents,
  type SeasonPlayerLine,
} from "@/lib/stats";

function shortLabel(name: string, max = 14): string {
  const t = name.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function barValueNumber(value: BarShapeProps["value"]): number | undefined {
  if (typeof value === "number") return value;
  if (Array.isArray(value) && value.length >= 2) return value[1] - value[0];
  return undefined;
}

function isZeroBarValue(value: BarShapeProps["value"]): boolean {
  const n = barValueNumber(value);
  return n !== undefined && Number.isFinite(n) && Math.abs(n) < 1e-9;
}

/** Barra vertical: linha cinza no eixo quando o valor é zero (continua contando no eixo X). */
function makeVerticalBarShape(fallbackFill: string, radius: [number, number, number, number] = [4, 4, 0, 0]) {
  return function VerticalBarShape(props: BarShapeProps): ReactElement {
    const { x, y, width, height, value, fill, index } = props;
    if (isZeroBarValue(value)) {
      const yLine = y + height;
      return (
        <g key={`zero-${index}`}>
          <line
            x1={x + width * 0.15}
            x2={x + width * 0.85}
            y1={yLine}
            y2={yLine}
            className="stroke-zinc-400 dark:stroke-zinc-500"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      );
    }
    return (
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={radius}
        fill={fill ?? fallbackFill}
        isAnimationActive={props.isAnimationActive}
      />
    );
  };
}

const shapeVitórias = makeVerticalBarShape("#059669");
const shapeGanhos = makeVerticalBarShape("#059669");
const shapePerdas = makeVerticalBarShape("#dc2626");
const shapeLucro = makeVerticalBarShape("#059669");
const shapeJejum = makeVerticalBarShape("#d97706");
const shapeSequenciaVitórias = makeVerticalBarShape("#059669");

const tooltipContentStyle = {
  borderRadius: 8,
  border: "1px solid var(--color-zinc-200, #e4e4e7)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
} as const;

const tooltipLabelStyle = {
  color: "var(--foreground)",
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 6,
} as const;

const tooltipItemStyle = {
  color: "var(--foreground)",
  fontSize: 13,
  padding: "2px 0",
} as const;

const tooltipWrapperStyle = {
  outline: "none",
} as const;

function chartColumnCursor(dark: boolean) {
  return dark
    ? { fill: "rgba(63, 63, 70, 0.42)" }
    : { fill: "rgba(244, 244, 245, 0.92)" };
}

function activeBarFill(dark: boolean) {
  return dark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.1)";
}

/** Linha do Top 10 (jejum / vitórias): eixo X único por evento para o Recharts não misturar tooltips quando o time se repete. */
type SequenceHistoryChartRow = {
  userId: string;
  categoria: string;
  nomeTime: string;
  rodadas: number;
  periodo: string;
};

function SequenceHistoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: SequenceHistoryChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={tooltipContentStyle}>
      <p style={tooltipLabelStyle}>{row.nomeTime}</p>
      <p style={tooltipItemStyle}>
        {row.rodadas} rodada{row.rodadas === 1 ? "" : "s"}
      </p>
      <p style={{ ...tooltipItemStyle, fontSize: 12, opacity: 0.75, marginTop: 4 }}>{row.periodo}</p>
    </div>
  );
}

function formatMoneyTooltip(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

type MoneyTooltipKind = "ganho" | "perda" | "lucro";

function MoneySeriesTooltip({
  kind,
  active,
  payload,
}: {
  kind: MoneyTooltipKind;
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: { nome: string; valor: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const { valor } = row;
  const titulo = kind === "ganho" ? "Recebimentos" : kind === "perda" ? "Perdas" : "Lucro";
  const tituloCor =
    kind === "ganho" ? "#059669" : kind === "perda" ? "#dc2626" : "#71717a";
  const valorCor =
    kind === "ganho" ? "#059669" : kind === "perda" ? "#dc2626" : valor >= 0 ? "#059669" : "#dc2626";
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={tooltipContentStyle}>
      <p style={{ ...tooltipLabelStyle, color: tituloCor }}>{titulo}</p>
      <p style={{ ...tooltipItemStyle, marginTop: 4 }}>{row.nome}</p>
      <p style={{ ...tooltipItemStyle, color: valorCor, fontWeight: 600, marginTop: 6 }}>
        {formatMoneyTooltip(valor)}
      </p>
    </div>
  );
}

// Paletas distintas por tema: escura no light, clara no dark.
const TEAM_BAR_COLORS_LIGHT = [
  "#b91c1c", "#166534", "#a16207", "#1d4ed8", "#c2410c",
  "#7e22ce", "#0f766e", "#be185d", "#4d7c0f", "#9d174d",
  "#155e75", "#6d28d9", "#92400e", "#9f1239", "#7f1d1d",
  "#0f766e", "#3f6212", "#9a3412", "#312e81", "#374151",
] as const;
const TEAM_BAR_COLORS_DARK = [
  "#fca5a5", "#86efac", "#fde047", "#93c5fd", "#fdba74",
  "#d8b4fe", "#5eead4", "#f9a8d4", "#bef264", "#fda4af",
  "#67e8f9", "#c4b5fd", "#fcd34d", "#fda4af", "#fca5a5",
  "#99f6e4", "#d9f99d", "#fdba74", "#a5b4fc", "#d1d5db",
] as const;

function hashStringToInt(value: string): number {
  // hash simples e estável (djb2)
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = (h * 33) ^ value.charCodeAt(i);
  return h >>> 0;
}

function barColorForUserId(userId: string, darkMode: boolean): string {
  const palette = darkMode ? TEAM_BAR_COLORS_DARK : TEAM_BAR_COLORS_LIGHT;
  return palette[hashStringToInt(userId) % palette.length];
}

type Props = {
  rounds: Round[];
  roundValue: number;
  members: LeagueMember[];
  players: SeasonPlayerLine[];
};

export function LeagueStatsCharts({ rounds, roundValue, members, players }: Props) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDarkMode(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const ranking = useMemo(
    () => aggregateWinnerStats(rounds, roundValue, members),
    [rounds, roundValue, members],
  );

  const barData = useMemo(
    () =>
      ranking.map((r) => ({
        userId: r.winnerId,
        nome: shortLabel(r.displayName),
        vitórias: r.wins,
      })),
    [ranking],
  );

  const pieData = useMemo(() => {
    const totalWins = rounds.length;
    if (totalWins === 0) return [];
    return ranking.map((r) => ({
      userId: r.winnerId,
      name: r.displayName.length > 18 ? `${r.displayName.slice(0, 16)}…` : r.displayName,
      value: r.wins,
    }));
  }, [ranking, rounds.length]);

  const droughtBarData = useMemo(
    () =>
      computeRoundsSinceLastWin(members, rounds).map((r) => ({
        userId: r.userId,
        nome: shortLabel(r.displayName),
        jejum: r.roundsSinceLastWin,
      })),
    [members, rounds],
  );

  const top10DroughtHistoryData = useMemo(
    () =>
      topDroughtHistoryEvents(members, rounds, 10)
        .filter((e) => e.length > 1)
        .map((e, idx) => ({
          userId: e.userId,
          categoria: `${idx + 1}. ${shortLabel(e.displayName)}`,
          nomeTime: e.displayName.trim(),
          rodadas: e.length,
          periodo:
            e.fromRound === e.toRound
              ? `Rodada ${e.fromRound}`
              : `Rodadas ${e.fromRound}–${e.toRound}`,
        })),
    [members, rounds],
  );

  const top10WinStreakHistoryData = useMemo(
    () =>
      topWinStreakHistoryEvents(members, rounds, 10)
        .filter((e) => e.length > 1)
        .map((e, idx) => ({
          userId: e.userId,
          categoria: `${idx + 1}. ${shortLabel(e.displayName)}`,
          nomeTime: e.displayName.trim(),
          rodadas: e.length,
          periodo:
            e.fromRound === e.toRound
              ? `Rodada ${e.fromRound}`
              : `Rodadas ${e.fromRound}–${e.toRound}`,
        })),
    [members, rounds],
  );

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

  const membersSortedByTeam = useMemo(() => {
    return [...members].sort((a, b) => {
      const ta = (a.teamName?.trim() || a.userName || a.userId).toLowerCase();
      const tb = (b.teamName?.trim() || b.userName || b.userId).toLowerCase();
      return ta.localeCompare(tb, "pt-BR");
    });
  }, [members]);

  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
        Nenhum participante na liga.
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      {rounds.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Ainda não há rodadas registradas. Os gráficos de vitórias abaixo ficam vazios; os de valores
          financeiros usam só as rodadas já cadastradas (neste momento, zeros).
        </p>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Times e cores</h2>
        <p className="mb-3 text-xs text-zinc-500">
          As cores abaixo são as mesmas usadas nos gráficos (cada time mantém sempre a sua cor).
        </p>
        <div className="space-y-2">
          {membersSortedByTeam.map((m) => {
            const label = (m.teamName?.trim() || m.userName || m.userId).trim();
            const color = barColorForUserId(m.userId, isDarkMode);
            return (
              <div
                key={m.userId}
                className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-100"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-zinc-900/10 dark:ring-white/10"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Rodadas sem vencer (desde a última vitória)</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Conta só rodadas <strong>já registradas</strong>, da mais recente (maior número de rodada) para trás,
          até a última em que o jogador foi campeão. Quem nunca venceu acumula todas as rodadas registradas.
        </p>
        {rounds.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            Sem rodadas registradas ainda.
          </p>
        ) : (
          <div className="h-72 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={droughtBarData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  wrapperStyle={tooltipWrapperStyle}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={chartColumnCursor(isDarkMode)}
                  formatter={(v) => [`${v} rodada(s)`, "Sem vencer"]}
                />
                <Bar
                  dataKey="jejum"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                  name="Rodadas sem vitória"
                  shape={shapeJejum}
                  activeBar={{ fill: activeBarFill(isDarkMode) }}
                >
                  {droughtBarData.map((e, i) => (
                    <Cell key={i} fill={barColorForUserId(e.userId, isDarkMode)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {top10DroughtHistoryData.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Top 10 - histórico de maiores sequências de derrota</h2>
          <p className="mb-2 text-xs text-zinc-500">
            Considera períodos consecutivos sem vitória; ao vencer, um novo jejum começa. Mostra apenas jejuns de 2+
            rodadas.
          </p>
          <div className="h-80 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10DroughtHistoryData} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="categoria" angle={-25} textAnchor="end" height={72} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={SequenceHistoryTooltip}
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={chartColumnCursor(isDarkMode)}
                />
                <Bar
                  dataKey="rodadas"
                  radius={[4, 4, 0, 0]}
                  name="Maior jejum"
                  shape={shapeJejum}
                  activeBar={{ fill: activeBarFill(isDarkMode) }}
                >
                  {top10DroughtHistoryData.map((e, i) => (
                    <Cell key={i} fill={barColorForUserId(e.userId, isDarkMode)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {top10WinStreakHistoryData.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Top 10 - histórico de maiores sequências de vitória</h2>
          <p className="mb-2 text-xs text-zinc-500">
            Considera períodos consecutivos como campeão; ao não vencer, o período encerra e começa nova contagem.
            Mostra apenas sequências de 2+ rodadas.
          </p>
          <div className="h-80 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10WinStreakHistoryData} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis dataKey="categoria" angle={-25} textAnchor="end" height={72} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={SequenceHistoryTooltip}
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={chartColumnCursor(isDarkMode)}
                />
                <Bar
                  dataKey="rodadas"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  name="Sequência de vitórias"
                  shape={shapeSequenciaVitórias}
                  activeBar={{ fill: activeBarFill(isDarkMode) }}
                >
                  {top10WinStreakHistoryData.map((e, i) => (
                    <Cell key={i} fill={barColorForUserId(e.userId, isDarkMode)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
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
                wrapperStyle={tooltipWrapperStyle}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={chartColumnCursor(isDarkMode)}
              />
              <Bar
                dataKey="vitórias"
                fill="#059669"
                radius={[4, 4, 0, 0]}
                name="Vitórias"
                shape={shapeVitórias}
                activeBar={{ fill: activeBarFill(isDarkMode) }}
              >
                {barData.map((e, i) => (
                  <Cell key={i} fill={barColorForUserId(e.userId, isDarkMode)} />
                ))}
              </Bar>
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
                <Tooltip
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={chartColumnCursor(isDarkMode)}
                  content={(props) => <MoneySeriesTooltip {...props} kind="ganho" />}
                />
                <Bar
                  dataKey="valor"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  name="Recebimentos"
                  shape={shapeGanhos}
                  activeBar={{ fill: activeBarFill(isDarkMode) }}
                />
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
                <Tooltip
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={chartColumnCursor(isDarkMode)}
                  content={(props) => <MoneySeriesTooltip {...props} kind="perda" />}
                />
                <Bar
                  dataKey="valor"
                  fill="#dc2626"
                  radius={[4, 4, 0, 0]}
                  name="Perdas"
                  shape={shapePerdas}
                  activeBar={{ fill: activeBarFill(isDarkMode) }}
                />
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
                <Tooltip
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={chartColumnCursor(isDarkMode)}
                  content={(props) => <MoneySeriesTooltip {...props} kind="lucro" />}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                <Bar
                  dataKey="valor"
                  name="Lucro"
                  radius={[4, 4, 0, 0]}
                  shape={shapeLucro}
                  activeBar={{ fill: activeBarFill(isDarkMode) }}
                >
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
                {pieData.map((e, i) => (
                  <Cell key={i} fill={barColorForUserId(e.userId, isDarkMode)} />
                ))}
              </Pie>
              <Tooltip
                wrapperStyle={tooltipWrapperStyle}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
