"use client";

import { useQuery } from "@tanstack/react-query";
import { presenceApi } from "@/lib/api/presence";

function formatCount(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR");
}

export function SitePresenceStats() {
  const { data, isError, isPending } = useQuery({
    queryKey: ["presence-stats"],
    queryFn: () => presenceApi.getStats(),
    refetchInterval: 15_000,
    retry: 1,
  });

  const windowSeconds = data?.onlineWindowSeconds ?? 60;
  const visitorsWindowDays = data?.uniqueVisitorsWindowDays ?? 30;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Acessos ao site</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Visitantes no último mês</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {isPending || isError ? "—" : formatCount(data?.uniqueVisitors)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Navegadores distintos que abriram o site nos últimos {visitorsWindowDays} dias.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/90">
            Online agora
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-950 dark:text-emerald-50">
            {isPending || isError ? "—" : formatCount(data?.onlineNow)}
          </p>
          <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-200/80">
            {isError
              ? "Não foi possível carregar a presença."
              : `Quem está com o site aberto nos últimos ${windowSeconds} segundos.`}
          </p>
        </div>
      </div>
    </section>
  );
}
