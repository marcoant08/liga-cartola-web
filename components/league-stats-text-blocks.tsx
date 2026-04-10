"use client";

import type { ReactNode } from "react";
import type { LeagueMember, Round } from "@/lib/types/api";
import { SEASON_TOTAL_ROUNDS, formatBRL, type SeasonPlayerLine } from "@/lib/stats";

const MEDALS = ["🥇", "🥈", "🥉"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

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
      <div className="mt-4 space-y-2 text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </section>
  );
}

function LineRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 border-b border-zinc-100 py-1.5 last:border-0 dark:border-zinc-800/80">
      <span className="min-w-0 flex-1 font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <span className="shrink-0 tabular-nums text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
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
  const membersByTeam = [...members].sort((a, b) => {
    const ta = (a.teamName?.trim() || a.userName).toLowerCase();
    const tb = (b.teamName?.trim() || b.userName).toLowerCase();
    return ta.localeCompare(tb, "pt-BR");
  });

  return (
    <>
      <StatSection title="🥇 Pódio">
        {podium.length === 0 ? (
          <p className="text-zinc-500">Sem dados de vitórias ainda.</p>
        ) : (
          <ul className="list-none space-y-2">
            {podium.map((p, i) => (
              <li key={p.userId} className="text-base">
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
          <p className="text-zinc-500">Nenhum membro na liga.</p>
        ) : (
          <ul className="space-y-2">
            {membersByTeam.map((m) => {
              const nomeTime = (m.teamName?.trim() || m.userName || "—").trim();
              return (
                <li key={m.userId}>
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
          <>
            <p className="font-medium">Estatísticas da rodada {lastRound.roundNumber}</p>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Último campeão registrado: <strong>{lastRound.winnerName}</strong>
            </p>
            <p className="text-xs text-zinc-500">
              Registrado em {new Date(lastRound.registeredAt).toLocaleString("pt-BR")}
            </p>
          </>
        ) : (
          <p className="text-zinc-500">Nenhuma rodada registrada na liga ainda.</p>
        )}
      </StatSection>

      <StatSection title="👤 Jogadores">
        {players.length === 0 ? (
          <p className="text-zinc-500">Nenhum membro na liga.</p>
        ) : (
          <ol className="list-none space-y-1">
            {players.map((p, idx) => (
              <li key={p.userId}>
                <span className="tabular-nums text-zinc-500">{pad2(idx + 1)}.</span>{" "}
                {p.displayName}
              </li>
            ))}
          </ol>
        )}
      </StatSection>

      <StatSection title="📝 Histórico de vitória das rodadas">
        {players.length === 0 ? (
          <p className="text-zinc-500">—</p>
        ) : (
          <ul className="space-y-2">
            {players.map((p) => (
              <li key={p.userId}>
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

      <StatSection title="🔄 Vencedores das rodadas">
        {winnerByRound.size === 0 ? (
          <p className="text-zinc-500">Nenhuma rodada com vencedor registrado.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs sm:text-sm">
            {[...winnerByRound.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([num, name]) => (
                <li key={num}>
                  {pad2(num)}: {name};
                </li>
              ))}
          </ul>
        )}
      </StatSection>

      <StatSection title="➗ Percentual de vitórias">
        <p className="mb-3 text-xs text-zinc-500">
          {registeredRoundsCount === 0 ? (
            <>Sem rodadas cadastradas — todos com 0%.</>
          ) : (
            <>
              Com base em <strong>{registeredRoundsCount}</strong> rodada
              {registeredRoundsCount === 1 ? "" : "s"} cadastrada
              {registeredRoundsCount === 1 ? "" : "s"} (vitórias ÷ {registeredRoundsCount}).
            </>
          )}
        </p>
        {players.map((p) => (
          <LineRow
            key={p.userId}
            label={`${p.displayName} ➡️`}
            value={`${p.pctVitórias.toFixed(1)}%`}
          />
        ))}
      </StatSection>

      <StatSection title="💰 Recebimentos">
        <p className="mb-3 text-xs text-zinc-500">
          Vitórias × valor da rodada (R$ {roundValue.toFixed(2)}).
        </p>
        {players.map((p) => (
          <LineRow
            key={p.userId}
            label={`${p.displayName} ➡️`}
            value={formatBRL(p.recebimentos)}
          />
        ))}
      </StatSection>

      <StatSection title="💸 Perdas">
        <p className="mb-3 text-xs text-zinc-500">
          −({SEASON_TOTAL_ROUNDS} − vitórias) × (valor da rodada ÷ {memberCount} participante
          {memberCount === 1 ? "" : "s"}) = contribuição nas rodadas em que não venceu.
        </p>
        {players.map((p) => (
          <LineRow
            key={p.userId}
            label={`${p.displayName} ➡️`}
            value={formatBRL(p.perdas)}
          />
        ))}
      </StatSection>

      <StatSection title="💵 Lucros">
        <p className="mb-3 text-xs text-zinc-500">Recebimentos + perdas (valores estimados).</p>
        {players.map((p) => (
          <LineRow
            key={p.userId}
            label={`${p.displayName} ➡️`}
            value={formatBRL(p.lucro)}
          />
        ))}
      </StatSection>
    </>
  );
}
