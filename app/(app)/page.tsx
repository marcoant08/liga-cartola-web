"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { leaguesApi } from "@/lib/api/leagues";

export default function HomePage() {
  const { data: leagues, isLoading, error } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => leaguesApi.list(),
  });

  if (isLoading) {
    return <p className="text-zinc-500">Carregando ligas…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-red-800 dark:bg-red-950/40 dark:text-red-200">
        Não foi possível carregar as ligas.
      </p>
    );
  }

  if (!leagues?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">Nenhuma liga ainda</h1>
        <p className="mt-2 text-zinc-500">
          Crie uma liga ou entre com um convite para começar o campeonato.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/leagues/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Nova liga
          </Link>
          <Link
            href="/leagues/join"
            className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Entrar com convite
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Minhas ligas</h1>
          <p className="text-sm text-zinc-500">Escolha uma liga para ver detalhes e rodadas.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/leagues/join"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Entrar com convite
          </Link>
          <Link
            href="/leagues/new"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Nova liga
          </Link>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {leagues.map((league) => (
          <li key={league.id}>
            <Link
              href={`/leagues/${league.id}`}
              className="block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
            >
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{league.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{league.description}</p>
              <dl className="mt-3 flex gap-4 text-xs text-zinc-500">
                <div>
                  <dt className="font-medium text-zinc-400">Valor rodada</dt>
                  <dd>R$ {Number(league.roundValue).toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-400">Membros</dt>
                  <dd>
                    {league.members?.length ?? 0} / {league.maxParticipants}
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
