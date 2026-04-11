"use client";

import type { ReactNode } from "react";
import type { LeagueMember, Round } from "@/lib/types/api";
import { formatBRL, receiptPerWin, type SeasonPlayerLine } from "@/lib/stats";

const MEDALS = ["🥇", "🥈", "🥉"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Linha divisória entre itens (igual ao separador dos cards com label/valor). */
const STAT_ROW_LINE =
  "border-b border-zinc-100 py-1.5 last:border-b-0 dark:border-zinc-800/80";

function StatSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-4 text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </section>
  );
}

/** Texto explicativo no topo do card, com linha abaixo alinhada às demais linhas. */
function StatIntro({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 border-b border-zinc-100 pb-3 text-xs text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
      {children}
    </div>
  );
}

function LineRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 ${STAT_ROW_LINE}`}>
      <span className="min-w-0 flex-1 font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <span className="shrink-0 tabular-nums text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

/** Verde se positivo, vermelho se negativo, padrão se zero — recebimentos, perdas e lucro. */
function moneyValueNode(value: number): ReactNode {
  const text = formatBRL(value);
  if (value > 0) {
    return <span className="text-emerald-600 dark:text-emerald-400">{text}</span>;
  }
  if (value < 0) {
    return <span className="text-red-600 dark:text-red-400">{text}</span>;
  }
  return text;
}

type Props = {
  roundValue: number;
  memberCount: number;
  members: LeagueMember[];
  registeredRoundsCount: number;
  players: SeasonPlayerLine[];
  winnerByRound: Map<number, string>;
  lastRound: Round | null;
};

export function LeagueStatsTextBlocks({
  roundValue,
  memberCount,
  members,
  registeredRoundsCount,
  players,
  winnerByRound,
  lastRound,
}: Props) {
  const podium = players.slice(0, 3);
  const receitaPorVitória = receiptPerWin(memberCount, roundValue);
  const membersByTeam = [...members].sort((a, b) => {
    const ta = (a.teamName?.trim() || a.userName).toLowerCase();
    const tb = (b.teamName?.trim() || b.userName).toLowerCase();
    return ta.localeCompare(tb, "pt-BR");
  });

  /** Perdas são negativas: menor valor = maior perda em R$. */
  const playersByPerdasDesc = [...players].sort((a, b) => {
    if (a.perdas !== b.perdas) return a.perdas - b.perdas;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });

  const derrotasCount = (p: SeasonPlayerLine) =>
    registeredRoundsCount === 0 ? 0 : registeredRoundsCount - p.wins;

  /** Mais derrotas primeiro (rodadas em que não venceu). */
  const playersByDerrotasDesc = [...players].sort((a, b) => {
    const da = derrotasCount(a);
    const db = derrotasCount(b);
    if (da !== db) return db - da;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });

  return (
    <>
      <StatSection title="🥇 Pódio">
        {podium.length === 0 ? (
          <p className="py-1.5 text-zinc-500">Sem dados de vitórias ainda.</p>
        ) : (
          <ul className="list-none">
            {podium.map((p, i) => (
              <li key={p.userId} className={`text-base ${STAT_ROW_LINE}`}>
                {MEDALS[i]}{" "}
                <span className="font-medium">
                  {p.displayName} ({pad2(p.wins)} vitória{p.wins === 1 ? "" : "s"})
                </span>
              </li>
            ))}
          </ul>
        )}
      </StatSection>

      <StatSection title="👥 Dono de cada time">
        {membersByTeam.length === 0 ? (
          <p className="py-1.5 text-zinc-500">Nenhum membro na liga.</p>
        ) : (
          <ul className="list-none">
            {membersByTeam.map((m) => {
              const nomeTime = (m.teamName?.trim() || m.userName || "—").trim();
              return (
                <li key={m.userId} className={STAT_ROW_LINE}>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{nomeTime}</span>
                  <span className="text-zinc-500"> → </span>
                  <span>{m.userName}</span>
                </li>
              );
            })}
          </ul>
        )}
      </StatSection>

      <StatSection title="🔄 Rodada atual">
        {lastRound ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            <div className="py-1.5">
              <p className="font-medium">Estatísticas da rodada {lastRound.roundNumber}</p>
            </div>
            <div className="py-1.5">
              <p className="text-zinc-600 dark:text-zinc-400">
                Último campeão registrado: <strong>{lastRound.winnerName}</strong>
              </p>
            </div>
            <div className="py-1.5">
              <p className="text-xs text-zinc-500">
                Registrado em {new Date(lastRound.registeredAt).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        ) : (
          <p className="py-1.5 text-zinc-500">Nenhuma rodada registrada na liga ainda.</p>
        )}
      </StatSection>

      <StatSection title="👤 Jogadores">
        {players.length === 0 ? (
          <p className="py-1.5 text-zinc-500">Nenhum membro na liga.</p>
        ) : (
          <ol className="list-none">
            {players.map((p, idx) => (
              <li key={p.userId} className={STAT_ROW_LINE}>
                <span className="tabular-nums text-zinc-500">{pad2(idx + 1)}.</span>{" "}
                {p.displayName}
              </li>
            ))}
          </ol>
        )}
      </StatSection>

      <StatSection title="🔄 Vencedores das rodadas">
        {winnerByRound.size === 0 ? (
          <p className="py-1.5 text-zinc-500">Nenhuma rodada com vencedor registrado.</p>
        ) : (
          <ol className="list-none">
            {[...winnerByRound.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([num, name]) => (
                <li key={num} className={STAT_ROW_LINE}>
                  <span className="tabular-nums text-zinc-500">{pad2(num)}.</span> {name}
                </li>
              ))}
          </ol>
        )}
      </StatSection>

      <StatSection title="📝 Histórico de vitória das rodadas">
        {players.length === 0 ? (
          <p className="py-1.5 text-zinc-500">—</p>
        ) : (
          <ul className="list-none">
            {players.map((p) => (
              <li key={p.userId} className={STAT_ROW_LINE}>
                <span className="font-medium">{p.displayName}</span>
                {" → "}
                {p.roundsWon.length > 0 ? p.roundsWon.join(", ") : "❌"}
              </li>
            ))}
          </ul>
        )}
      </StatSection>

      <StatSection title="✅ Número de vitórias no campeonato">
        {players.map((p) => (
          <LineRow
            key={p.userId}
            label={p.displayName}
            value={String(p.wins)}
          />
        ))}
      </StatSection>

      <StatSection title="❌ Número de derrotas no campeonato">
        <StatIntro>
          {registeredRoundsCount === 0 ? (
            <>Sem rodadas cadastradas — todos com 0 derrotas.</>
          ) : (
            <>
              Conta só rodadas <strong>já registradas</strong> ({registeredRoundsCount}): em cada uma, quem não
              foi campeão soma 1 derrota (igual a {registeredRoundsCount} − vitórias).
            </>
          )}
        </StatIntro>
        {players.length === 0 ? (
          <p className="py-1.5 text-zinc-500">Nenhum membro na liga.</p>
        ) : (
          playersByDerrotasDesc.map((p) => (
            <LineRow
              key={p.userId}
              label={p.displayName}
              value={String(derrotasCount(p))}
            />
          ))
        )}
      </StatSection>

      <StatSection title="➗ Percentual de vitórias">
        <StatIntro>
          {registeredRoundsCount === 0 ? (
            <>Sem rodadas cadastradas — todos com 0%.</>
          ) : (
            <>
              Com base em <strong>{registeredRoundsCount}</strong> rodada
              {registeredRoundsCount === 1 ? "" : "s"} cadastrada
              {registeredRoundsCount === 1 ? "" : "s"} (vitórias ÷ {registeredRoundsCount}).
            </>
          )}
        </StatIntro>
        {players.map((p) => (
          <LineRow
            key={p.userId}
            label={p.displayName}
            value={`${p.pctVitórias.toFixed(1)}%`}
          />
        ))}
      </StatSection>

      <StatSection title="💰 Recebimentos">
        <StatIntro>
          {`Por vitória o campeão recebe R$ ${receitaPorVitória.toFixed(2)} = (${memberCount} − 1) × R$ ${roundValue.toFixed(2)} (cada perdedor paga R$ ${roundValue.toFixed(2)}). Total = vitórias × esse valor.`}
        </StatIntro>
        {players.map((p) => (
          <LineRow
            key={p.userId}
            label={p.displayName}
            value={moneyValueNode(p.recebimentos)}
          />
        ))}
      </StatSection>

      <StatSection title="💸 Perdas">
        <StatIntro>
          {registeredRoundsCount === 0
            ? "Sem rodadas registradas — sem perdas contabilizadas."
            : `Só entram rodadas já registradas (${registeredRoundsCount}). Em cada uma em que não venceu, paga R$ ${roundValue.toFixed(2)} ao campeão: −(${registeredRoundsCount} − vitórias) × R$ ${roundValue.toFixed(2)}.`}
        </StatIntro>
        {playersByPerdasDesc.map((p) => (
          <LineRow
            key={p.userId}
            label={p.displayName}
            value={moneyValueNode(p.perdas)}
          />
        ))}
      </StatSection>

      <StatSection title="💵 Lucros">
        <StatIntro>Recebimentos + perdas (valores estimados).</StatIntro>
        {players.map((p) => (
          <LineRow
            key={p.userId}
            label={p.displayName}
            value={moneyValueNode(p.lucro)}
          />
        ))}
      </StatSection>
    </>
  );
}
