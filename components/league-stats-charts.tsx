"use client";

import type { ReactElement } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  ReferenceLine,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import type { Deserter, LeagueMember, Round } from "@/lib/types/api";
import {
  aggregateWinnerStats,
  computeDroughtStreakOverRegisteredRounds,
  computeLucroOverRegisteredRounds,
  computeRoundsSinceLastWin,
  computeWinsOverRegisteredRounds,
  droughtStreakDotKey,
  formatBRL,
  patternOverlappingLines,
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

const lineTooltipWrapperStyle = {
  outline: "none",
  zIndex: 50,
  overflow: "hidden",
  backgroundColor: "var(--background)",
  borderRadius: 8,
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
  maxWidth: "calc(100vw - 16px)",
} as const;

const VIEWPORT_X_PAD = 8;

function clampRechartsTooltipToViewportX(node: HTMLElement | null) {
  const wrapper = node?.closest(".recharts-tooltip-wrapper") as HTMLElement | null;
  if (!wrapper) return;
  wrapper.style.translate = "0px";
  const rect = wrapper.getBoundingClientRect();
  const vv = window.visualViewport;
  const vw = vv?.width ?? window.innerWidth;
  const minX = (vv?.offsetLeft ?? 0) + VIEWPORT_X_PAD;
  const maxX = minX + vw - VIEWPORT_X_PAD * 2;
  let shift = 0;
  if (rect.left < minX) shift = minX - rect.left;
  if (rect.right + shift > maxX) shift = maxX - rect.right;
  if (rect.left + shift < minX) shift = minX - rect.left;
  wrapper.style.translate = shift ? `${shift}px` : "";
}

const TOOLTIP_TOP_N = 20;

const Y_AXIS_WIDTH = 28;
const Y_AXIS_MONEY_WIDTH = 42;
const LINE_CHART_LEFT = 4;
const LINE_CHART_MARGIN = { top: 8, right: 20, left: LINE_CHART_LEFT, bottom: 28 };
const LINE_CHART_X_LABEL = {
  value: "Rodadas registradas",
  position: "insideBottom" as const,
  offset: -2,
  fontSize: 11,
};
const LINE_CHART_LEGEND_STYLE = { fontSize: 11, paddingTop: 8 };

function LineChartYAxisName({ children }: { children: string }) {
  return (
    <span
      className="pointer-events-none absolute top-[45%] left-0.5 z-10 select-none text-[11px] leading-none text-zinc-500 dark:text-zinc-400"
      style={{ writingMode: "vertical-rl", transform: "translateY(-50%) rotate(180deg)" }}
    >
      {children}
    </span>
  );
}

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

function RankedLineTooltip({
  active,
  payload,
  label,
  formatValue,
  uniqueByName = false,
  maxItems = TOOLTIP_TOP_N,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: unknown;
    color?: string;
    dataKey?: unknown;
  }>;
  label?: unknown;
  formatValue: (value: unknown, item?: { dataKey?: unknown }) => string;
  uniqueByName?: boolean;
  maxItems?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const apply = () => clampRechartsTooltipToViewportX(boxRef.current);
    apply();
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  });

  if (!active || !payload?.length) return null;
  const k = typeof label === "number" ? label : Number(label);
  const isDashKey = (key: string) => key.includes("::d");
  const isSegKey = (key: string) => key.includes("::s");
  let items = payload
    .filter((p) => {
      const key = String(p.dataKey ?? "");
      return (
        p.value != null &&
        !key.includes("__dot") &&
        !key.includes("__endPie") &&
        !key.includes("__lucroPie") &&
        !key.includes("__winsPie")
      );
    })
    .slice();
  const solids = items.filter((p) => isSegKey(String(p.dataKey ?? "")));
  items = items.filter((p) => {
    const key = String(p.dataKey ?? "");
    if (isDashKey(key)) {
      return !solids.some(
        (s) => s.name === p.name && Number(s.value) === Number(p.value),
      );
    }
    if (isSegKey(key) && Number(p.value) === 0) {
      return !items.some((o) => o.name === p.name && isDashKey(String(o.dataKey ?? "")));
    }
    return true;
  });
  items.sort((a, b) => {
    const va = Number(a.value);
    const vb = Number(b.value);
    if (vb !== va) return vb - va;
    const aEnded = isDashKey(String(a.dataKey ?? ""));
    const bEnded = isDashKey(String(b.dataKey ?? ""));
    if (aEnded !== bEnded) return aEnded ? 1 : -1;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR");
  });
  if (uniqueByName) {
    const seen = new Set<string>();
    items = items.filter((p) => {
      const n = String(p.name ?? "");
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  } else {
    const seen = new Set<string>();
    items = items.filter((p) => {
      const id = `${p.name}:${Number(p.value)}:${p.color ?? ""}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  if (items.length === 0) return null;
  const cap = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : items.length;
  const hidden = Math.max(0, items.length - cap);
  const visible = items.slice(0, cap);
  return (
    <div
      ref={boxRef}
      className="rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
      style={{ ...tooltipContentStyle, maxWidth: "calc(100vw - 16px)" }}
    >
      <p style={tooltipLabelStyle}>
        {k === 0
          ? "Nenhuma rodada registrada"
          : `Após ${k} rodada${k === 1 ? "" : "s"} registrada${k === 1 ? "" : "s"}`}
      </p>
      {visible.map((p) => (
        <p key={String(p.dataKey ?? p.name)} style={{ ...tooltipItemStyle, color: p.color }}>
          {p.name}: {formatValue(p.value, p)}
        </p>
      ))}
      {hidden > 0 ? (
        <p style={{ ...tooltipItemStyle, opacity: 0.7, marginTop: 4 }}>
          e mais {hidden} time{hidden === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}

function droughtMarkerRadius(label: string): number {
  if (label.length <= 1) return 9;
  if (label.length <= 2) return 11;
  if (label.length <= 4) return 13;
  return 16;
}

const LUCRO_MARKER_R = 14;

function DroughtEndDot({
  cx,
  cy,
  value,
  fill,
  textColor,
  label: labelOverride,
  radius,
  bordered = true,
  borderColor,
  borderOpacity = 0.35,
  textHalo,
}: {
  cx?: number;
  cy?: number;
  value?: unknown;
  fill: string;
  textColor: string;
  label?: string;
  radius?: number;
  bordered?: boolean;
  borderColor?: string;
  borderOpacity?: number;
  textHalo?: string | false;
}) {
  if (cx == null || cy == null || value == null || typeof value === "boolean") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const label = labelOverride ?? String(n);
  const r = radius ?? droughtMarkerRadius(label);
  const stroke = bordered ? (borderColor ?? textColor) : "none";
  const halo = typeof textHalo === "string" ? textHalo : undefined;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={bordered ? 1 : 0}
        strokeOpacity={bordered ? borderOpacity : 0}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={label.length > 4 ? 8 : 10}
        fontWeight={700}
        fill={textColor}
        stroke={halo}
        strokeWidth={halo ? 3 : 0}
        paintOrder={halo ? "stroke fill" : undefined}
        strokeLinejoin={halo ? "round" : undefined}
      >
        {label}
      </text>
    </g>
  );
}

function pieSlicePath(cx: number, cy: number, r: number, start: number, end: number): string {
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** Bolinha no último X: pizza com as cores de todos os times naquela altura de jejum. */
function DroughtEndPieDot({
  cx,
  cy,
  value,
  colors,
  textColor,
  label: labelOverride,
  radius,
  bordered = true,
  borderColor,
  borderOpacity = 0.35,
  textHalo,
}: {
  cx?: number;
  cy?: number;
  value?: unknown;
  colors: string[];
  textColor: string;
  label?: string;
  radius?: number;
  bordered?: boolean;
  borderColor?: string;
  borderOpacity?: number;
  textHalo?: string | false;
}) {
  if (cx == null || cy == null || value == null || typeof value === "boolean") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || colors.length === 0) return null;
  if (colors.length === 1) {
    return (
      <DroughtEndDot
        cx={cx}
        cy={cy}
        value={value}
        fill={colors[0]}
        textColor={textColor}
        label={labelOverride}
        radius={radius}
        bordered={bordered}
        borderColor={borderColor}
        borderOpacity={borderOpacity}
        textHalo={textHalo}
      />
    );
  }
  const label = labelOverride ?? String(n);
  const r = radius ?? droughtMarkerRadius(label) + 1;
  const slice = (2 * Math.PI) / colors.length;
  const start0 = -Math.PI / 2;
  const halo =
    textHalo === false
      ? undefined
      : (textHalo ?? (textColor === "#fafafa" ? "#18181b" : "#fafafa"));
  const stroke = borderColor ?? textColor;
  return (
    <g>
      {colors.map((color, i) => (
        <path
          key={`${color}-${i}`}
          d={pieSlicePath(cx, cy, r, start0 + i * slice, start0 + (i + 1) * slice)}
          fill={color}
        />
      ))}
      {bordered ? (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={1}
          strokeOpacity={borderOpacity}
        />
      ) : null}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={label.length > 4 ? 8 : 10}
        fontWeight={700}
        fill={textColor}
        stroke={halo}
        strokeWidth={halo ? 3 : 0}
        paintOrder={halo ? "stroke fill" : undefined}
        strokeLinejoin={halo ? "round" : undefined}
      >
        {label}
      </text>
    </g>
  );
}

function droughtEndPieKey(y: number): string {
  return `__endPie::${y}`;
}

function lucroEndPieKey(idx: number, y: number): string {
  return `__lucroPie::${idx}::${y}`;
}

function winsEndPieKey(idx: number, y: number): string {
  return `__winsPie::${idx}::${y}`;
}

function groupLineEndPies(
  points: ReadonlyArray<{ rodadas: number } & Record<string, number | null>>,
  series: { userId: string; name: string }[],
  pieKey: (idx: number, y: number) => string,
): { idx: number; y: number; dataKey: string; userIds: string[] }[] {
  if (points.length === 0) return [];
  const nameOf = (id: string) => series.find((s) => s.userId === id)?.name ?? id;
  const groups = new Map<string, { idx: number; y: number; ids: Set<string> }>();
  for (const s of series) {
    let lastIdx = -1;
    let lastY: number | null = null;
    for (let i = 0; i < points.length; i++) {
      const v = points[i][s.userId];
      if (typeof v === "number" && Number.isFinite(v)) {
        lastIdx = i;
        lastY = v;
      }
    }
    if (lastIdx < 0 || lastY == null) continue;
    const key = `${lastIdx}::${lastY}`;
    let g = groups.get(key);
    if (!g) {
      g = { idx: lastIdx, y: lastY, ids: new Set() };
      groups.set(key, g);
    }
    g.ids.add(s.userId);
  }
  return [...groups.values()].map((g) => ({
    idx: g.idx,
    y: g.y,
    dataKey: pieKey(g.idx, g.y),
    userIds: [...g.ids].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "pt-BR")),
  }));
}

function formatMoneyTooltip(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function moneyAxisTick(v: number): string {
  if (!Number.isFinite(v)) return "";
  const n = Math.round(v);
  return n < 0 ? `-$${Math.abs(n)}` : `$${n}`;
}

function lucroBorderColor(y: number): string {
  if (y > 0) return "#059669";
  if (y < 0) return "#dc2626";
  return "#ffffff";
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
const TEAM_BAR_COLORS_DARK = [
  "#b91c1c", "#166534", "#a16207", "#1d4ed8", "#c2410c",
  "#7e22ce", "#0f766e", "#be185d", "#4d7c0f", "#9d174d",
  "#155e75", "#6d28d9", "#92400e", "#9f1239", "#7f1d1d",
  "#0f766e", "#3f6212", "#9a3412", "#312e81", "#374151",
] as const;
const TEAM_BAR_COLORS_LIGHT = [
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
  deserters?: Deserter[];
  players: SeasonPlayerLine[];
};

export function LeagueStatsCharts({ rounds, roundValue, members, deserters = [], players }: Props) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDarkMode(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const ranking = useMemo(
    () => aggregateWinnerStats(rounds, roundValue, members, deserters),
    [rounds, roundValue, members, deserters],
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

  const deserterIds = useMemo(() => new Set(deserters.map((d) => d.memberId)), [deserters]);

  const droughtBarData = useMemo(
    () =>
      computeRoundsSinceLastWin(members, rounds, deserters)
        .filter((r) => !deserterIds.has(r.userId))
        .map((r) => ({
          userId: r.userId,
          nome: shortLabel(r.displayName),
          jejum: r.roundsSinceLastWin,
        })),
    [members, rounds, deserters, deserterIds],
  );

  const top10DroughtHistoryData = useMemo(
    () =>
      topDroughtHistoryEvents(members, rounds, 10, deserters)
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
    [members, rounds, deserters],
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

  const winsOverRoundsData = useMemo(
    () => computeWinsOverRegisteredRounds(members, rounds, deserters),
    [members, rounds, deserters],
  );

  const lucroOverRoundsData = useMemo(
    () => computeLucroOverRegisteredRounds(members, rounds, roundValue, deserters),
    [members, rounds, roundValue, deserters],
  );

  const droughtStreakChart = useMemo(
    () => computeDroughtStreakOverRegisteredRounds(members, rounds, deserters),
    [members, rounds, deserters],
  );

  const lineSeries = useMemo(
    () =>
      members.map((m) => ({
        userId: m.userId,
        name: (m.teamName?.trim() || m.userName || m.userId).trim(),
      })),
    [members],
  );

  const memberLineRefs = useMemo(
    () => lineSeries.map((s) => ({ userId: s.userId, dataKey: s.userId })),
    [lineSeries],
  );

  const winsOverlap = useMemo(
    () => patternOverlappingLines(winsOverRoundsData, memberLineRefs),
    [winsOverRoundsData, memberLineRefs],
  );

  const winsEndPies = useMemo(
    () => groupLineEndPies(winsOverRoundsData, lineSeries, winsEndPieKey),
    [winsOverRoundsData, lineSeries],
  );

  const winsChartPoints = useMemo(() => {
    if (winsOverRoundsData.length === 0) return winsOverRoundsData;
    return winsOverRoundsData.map((row, i) => {
      const extra: typeof row = { ...row, ...winsOverlap.points[i] };
      for (const pie of winsEndPies) {
        if (pie.idx === i) extra[pie.dataKey] = pie.y;
      }
      return extra;
    });
  }, [winsOverRoundsData, winsOverlap.points, winsEndPies]);

  const lucroOverlap = useMemo(
    () => patternOverlappingLines(lucroOverRoundsData, memberLineRefs),
    [lucroOverRoundsData, memberLineRefs],
  );

  const droughtEndPies = useMemo(() => {
    const last = droughtStreakChart.points[droughtStreakChart.points.length - 1];
    if (!last) return [];
    const nameOf = (id: string) => lineSeries.find((s) => s.userId === id)?.name ?? id;
    const byY = new Map<number, Set<string>>();
    const take = (userId: string, raw: unknown) => {
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return;
      let ids = byY.get(raw);
      if (!ids) {
        ids = new Set();
        byY.set(raw, ids);
      }
      ids.add(userId);
    };
    for (const seg of droughtStreakChart.segments) take(seg.userId, last[seg.dataKey]);
    return [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, ids]) => ({
        y,
        dataKey: droughtEndPieKey(y),
        userIds: [...ids].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "pt-BR")),
      }));
  }, [droughtStreakChart, lineSeries]);

  const droughtOverlapSeries = useMemo(
    () => [
      ...droughtStreakChart.segments.map((seg) => ({ userId: seg.userId, dataKey: seg.dataKey })),
      ...droughtStreakChart.dashes.map((dash) => ({ userId: dash.userId, dataKey: dash.dataKey })),
    ],
    [droughtStreakChart.segments, droughtStreakChart.dashes],
  );

  const droughtOverlap = useMemo(
    () => patternOverlappingLines(droughtStreakChart.points, droughtOverlapSeries),
    [droughtStreakChart.points, droughtOverlapSeries],
  );

  const droughtStreakPoints = useMemo(() => {
    const pts = droughtStreakChart.points;
    if (pts.length === 0) return pts;
    const lastIdx = pts.length - 1;
    return pts.map((row, i) => {
      const extra: typeof row = { ...row, ...droughtOverlap.points[i] };
      if (i === lastIdx) {
        for (const pie of droughtEndPies) extra[pie.dataKey] = pie.y;
      }
      return extra;
    });
  }, [droughtStreakChart.points, droughtOverlap.points, droughtEndPies]);

  const droughtConnectedBase = useMemo(() => {
    const merged = droughtStreakChart.points.map((row) => {
      const out: typeof row = { rodadas: row.rodadas };
      for (const s of lineSeries) {
        let v: number | null = null;
        for (const seg of droughtStreakChart.segments) {
          if (seg.userId !== s.userId) continue;
          const raw = row[seg.dataKey];
          if (typeof raw === "number" && Number.isFinite(raw)) {
            v = raw;
            break;
          }
        }
        out[s.userId] = v;
      }
      return out;
    });
    const lastIdx = merged.length - 1;
    return merged.map((row, i) => {
      const out: typeof row = { ...row };
      for (const s of lineSeries) {
        const dKey = droughtStreakDotKey(s.userId);
        const peak = droughtStreakChart.points[i]?.[dKey];
        const v = row[s.userId];
        const prev = i > 0 ? merged[i - 1][s.userId] : null;
        const droppedToZero = v === 0 && typeof prev === "number" && prev > 0;
        if (typeof peak === "number" && Number.isFinite(peak)) {
          out[dKey] = peak;
        } else if (droppedToZero && i !== lastIdx) {
          out[dKey] = 0;
        } else {
          out[dKey] = null;
        }
      }
      return out;
    });
  }, [droughtStreakChart.points, droughtStreakChart.segments, lineSeries]);

  const droughtConnectedOverlap = useMemo(
    () => patternOverlappingLines(droughtConnectedBase, memberLineRefs),
    [droughtConnectedBase, memberLineRefs],
  );

  const droughtConnectedPoints = useMemo(() => {
    const pts = droughtConnectedBase;
    if (pts.length === 0) return pts;
    const lastIdx = pts.length - 1;
    return pts.map((row, i) => {
      const extra: typeof row = { ...row, ...droughtConnectedOverlap.points[i] };
      if (i === lastIdx) {
        for (const pie of droughtEndPies) extra[pie.dataKey] = pie.y;
      }
      return extra;
    });
  }, [droughtConnectedBase, droughtConnectedOverlap.points, droughtEndPies]);

  const lucroEndPies = useMemo(
    () => groupLineEndPies(lucroOverRoundsData, lineSeries, lucroEndPieKey),
    [lucroOverRoundsData, lineSeries],
  );

  const lucroChartPoints = useMemo(() => {
    const pts = lucroOverRoundsData;
    if (pts.length === 0) return pts;
    return pts.map((row, i) => {
      const extra: typeof row = { ...row, ...lucroOverlap.points[i] };
      for (const pie of lucroEndPies) {
        if (pie.idx === i) extra[pie.dataKey] = pie.y;
      }
      return extra;
    });
  }, [lucroOverRoundsData, lucroOverlap.points, lucroEndPies]);

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
        <h2 className="mb-2 text-lg font-semibold">Vitórias ao longo das rodadas</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Cada linha é um time: o eixo X é o número de rodadas já registradas e o eixo Y é o total de
          vitórias até aquele ponto. Quem desistiu para de aparecer a partir da rodada da desistência.
          Quando dois ou mais times empatam no mesmo valor, o trecho vira um tracejado intercalado com
          as cores sobrepostas. No fim de cada linha, o total de vitórias aparece numa bolinha; se
          vários times estão na mesma altura, as cores viram uma pizza.
        </p>
        {rounds.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            Sem rodadas registradas ainda.
          </p>
        ) : (
          <div className="relative h-96 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <LineChartYAxisName>Vitórias</LineChartYAxisName>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={winsChartPoints} margin={LINE_CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="rodadas"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  label={LINE_CHART_X_LABEL}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={Y_AXIS_WIDTH} tickMargin={2} />
                <Tooltip
                  allowEscapeViewBox={{ x: false, y: true }}
                  wrapperStyle={lineTooltipWrapperStyle}
                  content={({ active, payload, label }) => (
                    <RankedLineTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      uniqueByName
                      maxItems={Number.POSITIVE_INFINITY}
                      formatValue={(v) => `${v} vitória${v === 1 ? "" : "s"}`}
                    />
                  )}
                />
                <Legend wrapperStyle={LINE_CHART_LEGEND_STYLE} />
                {winsOverlap.overlaps.map((ov) => {
                  const color = barColorForUserId(ov.userId, isDarkMode);
                  const name = lineSeries.find((s) => s.userId === ov.userId)?.name ?? ov.userId;
                  return (
                    <Line
                      key={ov.dataKey}
                      type="linear"
                      dataKey={ov.dataKey}
                      name={name}
                      stroke={color}
                      strokeWidth={ov.keepDashed ? 2 : 3}
                      strokeDasharray={ov.dasharray}
                      strokeDashoffset={ov.dashOffset}
                      strokeLinecap={ov.keepDashed ? "butt" : undefined}
                      legendType={ov.showLegend ? "line" : "none"}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
                {winsOverlap.unique.map((seg) => {
                  const color = barColorForUserId(seg.userId, isDarkMode);
                  const name = lineSeries.find((s) => s.userId === seg.userId)?.name ?? seg.userId;
                  return (
                    <Line
                      key={seg.dataKey}
                      type="monotone"
                      dataKey={seg.dataKey}
                      name={name}
                      stroke={color}
                      strokeWidth={3}
                      legendType={seg.isFirst ? "line" : "none"}
                      connectNulls={false}
                      activeDot={false}
                      dot={(props) => {
                        const k =
                          typeof props.index === "number"
                            ? props.index
                            : Number((props.payload as { rodadas?: number } | undefined)?.rodadas);
                        const value = Number(props.value);
                        if (!Number.isFinite(k) || k <= 0 || !Number.isFinite(value)) return null;
                        const next = winsOverRoundsData[k + 1]?.[seg.userId];
                        if (typeof next !== "number") return null;
                        const prev = winsOverRoundsData[k - 1]?.[seg.userId];
                        if (typeof prev !== "number" || value <= prev) return null;
                        return (
                          <DroughtEndDot
                            cx={props.cx}
                            cy={props.cy}
                            value={value}
                            fill={color}
                            textColor={isDarkMode ? "#fafafa" : "#18181b"}
                          />
                        );
                      }}
                    />
                  );
                })}
                {winsEndPies.map((pie) => (
                  <Line
                    key={pie.dataKey}
                    type="linear"
                    dataKey={pie.dataKey}
                    stroke="none"
                    legendType="none"
                    isAnimationActive={false}
                    connectNulls={false}
                    dot={(props) => (
                      <DroughtEndPieDot
                        cx={props.cx}
                        cy={props.cy}
                        value={props.value}
                        colors={pie.userIds.map((id) => barColorForUserId(id, isDarkMode))}
                        textColor={isDarkMode ? "#fafafa" : "#18181b"}
                        textHalo={false}
                      />
                    )}
                    activeDot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Histórico de sequências de derrota</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Cada linha é o jejum consecutivo daquele time: sobe a cada rodada sem vencer. Quando a sequência
          termina (vitória), a linha para numa bolinha e segue tracejada na mesma altura até o fim. A
          próxima sequência começa do zero, sem ligar os dois. Quem desistiu também termina na bolinha e
          segue tracejado até a última rodada registrada. No fim das linhas contínuas, o jejum atual
          aparece numa bolinha; se vários times estão na mesma altura, as cores viram uma pizza.
          Trechos em que várias linhas coincidem aparecem em tracejado intercalado com as cores
          sobrepostas.
        </p>
        {rounds.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            Sem rodadas registradas ainda.
          </p>
        ) : (
          <div className="relative h-96 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <LineChartYAxisName>Derrotas</LineChartYAxisName>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={droughtStreakPoints} margin={LINE_CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="rodadas"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  label={LINE_CHART_X_LABEL}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={Y_AXIS_WIDTH} tickMargin={2} />
                <Tooltip
                  allowEscapeViewBox={{ x: false, y: true }}
                  wrapperStyle={lineTooltipWrapperStyle}
                  content={({ active, payload, label }) => (
                    <RankedLineTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      formatValue={(v, item) => {
                        const n = Number(v);
                        const base = `${v} rodada${n === 1 ? "" : "s"} sem vencer`;
                        return String(item?.dataKey ?? "").includes("::d")
                          ? `${base} (encerrada)`
                          : base;
                      }}
                    />
                  )}
                />
                <Legend wrapperStyle={LINE_CHART_LEGEND_STYLE} />
                {droughtOverlap.unique
                  .filter((seg) => seg.dashed)
                  .map((seg) => {
                    const name = lineSeries.find((s) => s.userId === seg.userId)?.name ?? seg.userId;
                    const color = barColorForUserId(seg.userId, isDarkMode);
                    return (
                      <Line
                        key={seg.dataKey}
                        type="linear"
                        dataKey={seg.dataKey}
                        name={name}
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray="7 5"
                        legendType={seg.isFirst ? "line" : "none"}
                        dot={false}
                        connectNulls={false}
                      />
                    );
                  })}
                {droughtOverlap.overlaps
                  .filter((ov) => ov.keepDashed)
                  .map((ov) => {
                    const name = lineSeries.find((s) => s.userId === ov.userId)?.name ?? ov.userId;
                    const color = barColorForUserId(ov.userId, isDarkMode);
                    return (
                      <Line
                        key={ov.dataKey}
                        type="linear"
                        dataKey={ov.dataKey}
                        name={name}
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray={ov.dasharray}
                        strokeDashoffset={ov.dashOffset}
                        strokeLinecap="butt"
                        legendType={ov.showLegend ? "line" : "none"}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    );
                  })}
                {droughtOverlap.overlaps
                  .filter((ov) => !ov.keepDashed)
                  .map((ov) => {
                    const name = lineSeries.find((s) => s.userId === ov.userId)?.name ?? ov.userId;
                    const color = barColorForUserId(ov.userId, isDarkMode);
                    return (
                      <Line
                        key={ov.dataKey}
                        type="linear"
                        dataKey={ov.dataKey}
                        name={name}
                        stroke={color}
                        strokeWidth={3}
                        strokeDasharray={ov.dasharray}
                        strokeDashoffset={ov.dashOffset}
                        legendType={ov.showLegend ? "line" : "none"}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    );
                  })}
                {droughtOverlap.unique
                  .filter((seg) => !seg.dashed)
                  .map((seg) => {
                    const name = lineSeries.find((s) => s.userId === seg.userId)?.name ?? seg.userId;
                    const color = barColorForUserId(seg.userId, isDarkMode);
                    return (
                      <Line
                        key={seg.dataKey}
                        type="linear"
                        dataKey={seg.dataKey}
                        name={name}
                        stroke={color}
                        strokeWidth={3}
                        legendType={seg.isFirst ? "line" : "none"}
                        dot={false}
                        connectNulls={false}
                      />
                    );
                  })}
                {lineSeries.map((s) => {
                  const color = barColorForUserId(s.userId, isDarkMode);
                  return (
                    <Line
                      key={droughtStreakDotKey(s.userId)}
                      type="linear"
                      dataKey={droughtStreakDotKey(s.userId)}
                      name={s.name}
                      stroke="none"
                      legendType="none"
                      connectNulls={false}
                      dot={(props) => (
                        <DroughtEndDot
                          cx={props.cx}
                          cy={props.cy}
                          value={props.value}
                          fill={color}
                          textColor={isDarkMode ? "#fafafa" : "#18181b"}
                        />
                      )}
                      activeDot={false}
                    />
                  );
                })}
                {droughtEndPies.map((pie) => (
                  <Line
                    key={pie.dataKey}
                    type="linear"
                    dataKey={pie.dataKey}
                    stroke="none"
                    legendType="none"
                    isAnimationActive={false}
                    connectNulls={false}
                    dot={(props) => (
                      <DroughtEndPieDot
                        cx={props.cx}
                        cy={props.cy}
                        value={props.value}
                        colors={pie.userIds.map((id) => barColorForUserId(id, isDarkMode))}
                        textColor={isDarkMode ? "#fafafa" : "#18181b"}
                      />
                    )}
                    activeDot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Histórico de sequências de derrota (contínuo)</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Igual ao gráfico acima, sem as continuações tracejadas. Cada time tem uma única linha contínua: ao
          vencer, o jejum volta a zero na rodada seguinte e a linha desce até lá, sem quebrar. A bolinha
          continua no pico da sequência encerrada e no jejum atual.
        </p>
        {rounds.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            Sem rodadas registradas ainda.
          </p>
        ) : (
          <div className="relative h-96 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <LineChartYAxisName>Derrotas</LineChartYAxisName>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={droughtConnectedPoints} margin={LINE_CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="rodadas"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  label={LINE_CHART_X_LABEL}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={Y_AXIS_WIDTH} tickMargin={2} />
                <Tooltip
                  allowEscapeViewBox={{ x: false, y: true }}
                  wrapperStyle={lineTooltipWrapperStyle}
                  content={({ active, payload, label }) => (
                    <RankedLineTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      uniqueByName
                      maxItems={Number.POSITIVE_INFINITY}
                      formatValue={(v) => {
                        const n = Number(v);
                        return `${v} rodada${n === 1 ? "" : "s"} sem vencer`;
                      }}
                    />
                  )}
                />
                <Legend wrapperStyle={LINE_CHART_LEGEND_STYLE} />
                {droughtConnectedOverlap.overlaps.map((ov) => {
                  const name = lineSeries.find((s) => s.userId === ov.userId)?.name ?? ov.userId;
                  const color = barColorForUserId(ov.userId, isDarkMode);
                  return (
                    <Line
                      key={ov.dataKey}
                      type="linear"
                      dataKey={ov.dataKey}
                      name={name}
                      stroke={color}
                      strokeWidth={3}
                      strokeDasharray={ov.dasharray}
                      strokeDashoffset={ov.dashOffset}
                      legendType={ov.showLegend ? "line" : "none"}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
                {droughtConnectedOverlap.unique.map((seg) => {
                  const name = lineSeries.find((s) => s.userId === seg.userId)?.name ?? seg.userId;
                  const color = barColorForUserId(seg.userId, isDarkMode);
                  return (
                    <Line
                      key={seg.dataKey}
                      type="linear"
                      dataKey={seg.dataKey}
                      name={name}
                      stroke={color}
                      strokeWidth={3}
                      legendType={seg.isFirst ? "line" : "none"}
                      dot={false}
                      connectNulls={false}
                    />
                  );
                })}
                {lineSeries.map((s) => {
                  const color = barColorForUserId(s.userId, isDarkMode);
                  return (
                    <Line
                      key={`test-${droughtStreakDotKey(s.userId)}`}
                      type="linear"
                      dataKey={droughtStreakDotKey(s.userId)}
                      name={s.name}
                      stroke="none"
                      legendType="none"
                      connectNulls={false}
                      dot={(props) => (
                        <DroughtEndDot
                          cx={props.cx}
                          cy={props.cy}
                          value={props.value}
                          fill={color}
                          textColor={isDarkMode ? "#fafafa" : "#18181b"}
                        />
                      )}
                      activeDot={false}
                    />
                  );
                })}
                {droughtEndPies.map((pie) => (
                  <Line
                    key={`test-${pie.dataKey}`}
                    type="linear"
                    dataKey={pie.dataKey}
                    stroke="none"
                    legendType="none"
                    isAnimationActive={false}
                    connectNulls={false}
                    dot={(props) => (
                      <DroughtEndPieDot
                        cx={props.cx}
                        cy={props.cy}
                        value={props.value}
                        colors={pie.userIds.map((id) => barColorForUserId(id, isDarkMode))}
                        textColor={isDarkMode ? "#fafafa" : "#18181b"}
                      />
                    )}
                    activeDot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Lucro ao longo das rodadas</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Cada linha é o lucro acumulado daquele time: sobe na vitória (recebe dos outros ativos) e desce
          quando perde (paga o valor da rodada). Quem desistiu para de aparecer a partir da rodada da
          desistência. Trechos empatados viram um tracejado intercalado com as cores sobrepostas.
        </p>
        {rounds.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            Sem rodadas registradas ainda.
          </p>
        ) : (
          <div className="relative h-96 w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <LineChartYAxisName>Lucro</LineChartYAxisName>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lucroChartPoints} margin={LINE_CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                <XAxis
                  dataKey="rodadas"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  label={LINE_CHART_X_LABEL}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={moneyAxisTick}
                  width={Y_AXIS_MONEY_WIDTH}
                  tickMargin={2}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                <Tooltip
                  allowEscapeViewBox={{ x: false, y: true }}
                  wrapperStyle={lineTooltipWrapperStyle}
                  content={({ active, payload, label }) => (
                    <RankedLineTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      uniqueByName
                      maxItems={Number.POSITIVE_INFINITY}
                      formatValue={(v) => formatBRL(Number(v))}
                    />
                  )}
                />
                <Legend wrapperStyle={LINE_CHART_LEGEND_STYLE} />
                {lucroOverlap.overlaps.map((ov) => {
                  const color = barColorForUserId(ov.userId, isDarkMode);
                  const name = lineSeries.find((s) => s.userId === ov.userId)?.name ?? ov.userId;
                  return (
                    <Line
                      key={ov.dataKey}
                      type="linear"
                      dataKey={ov.dataKey}
                      name={name}
                      stroke={color}
                      strokeWidth={ov.keepDashed ? 2 : 3}
                      strokeDasharray={ov.dasharray}
                      strokeDashoffset={ov.dashOffset}
                      strokeLinecap={ov.keepDashed ? "butt" : undefined}
                      legendType={ov.showLegend ? "line" : "none"}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
                {lucroOverlap.unique.map((seg) => {
                  const color = barColorForUserId(seg.userId, isDarkMode);
                  const name = lineSeries.find((s) => s.userId === seg.userId)?.name ?? seg.userId;
                  return (
                    <Line
                      key={seg.dataKey}
                      type="linear"
                      dataKey={seg.dataKey}
                      name={name}
                      stroke={color}
                      strokeWidth={3}
                      legendType={seg.isFirst ? "line" : "none"}
                      connectNulls={false}
                      dot={false}
                      activeDot={false}
                    />
                  );
                })}
                {lucroEndPies.map((pie) => (
                  <Line
                    key={pie.dataKey}
                    type="linear"
                    dataKey={pie.dataKey}
                    stroke="none"
                    legendType="none"
                    isAnimationActive={false}
                    connectNulls={false}
                    dot={(props) => (
                      <DroughtEndPieDot
                        cx={props.cx}
                        cy={props.cy}
                        value={props.value}
                        colors={pie.userIds.map((id) => barColorForUserId(id, isDarkMode))}
                        textColor={isDarkMode ? "#fafafa" : "#18181b"}
                        label={moneyAxisTick(pie.y)}
                        radius={LUCRO_MARKER_R}
                        borderColor={lucroBorderColor(pie.y)}
                        borderOpacity={1}
                        textHalo={false}
                      />
                    )}
                    activeDot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Rodadas sem vencer (desde a última vitória)</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Conta só rodadas <strong>já registradas</strong>, da mais recente (maior número de rodada) para trás,
          até a última em que o jogador foi campeão. Quem nunca venceu acumula todas as rodadas registradas.
          Quem desistiu da liga não entra.
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
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={Y_AXIS_WIDTH} tickMargin={4} />
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
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={Y_AXIS_WIDTH} tickMargin={4} />
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
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={Y_AXIS_WIDTH} tickMargin={4} />
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
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={Y_AXIS_WIDTH} tickMargin={4} />
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
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} width={Y_AXIS_MONEY_WIDTH} tickMargin={4} />
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
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} width={Y_AXIS_MONEY_WIDTH} tickMargin={4} />
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
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} width={Y_AXIS_MONEY_WIDTH} tickMargin={4} />
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
