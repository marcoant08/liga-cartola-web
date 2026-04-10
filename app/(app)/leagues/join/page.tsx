"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { leaguesApi } from "@/lib/api/leagues";
import { ApiError } from "@/lib/api/error";

export default function JoinLeaguePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [inviteToken, setInviteToken] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      leaguesApi.join({
        inviteToken: inviteToken.trim(),
        pixKey,
        teamName,
        isGuest: false,
      }),
    onSuccess: (league) => {
      qc.invalidateQueries({ queryKey: ["leagues"] });
      router.push(`/leagues/${league.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else setError("Não foi possível entrar na liga.");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div>
      <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
        ← Minhas ligas
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Entrar com convite</h1>
      <p className="text-sm text-zinc-500">Use o token que o administrador gerou para a liga.</p>
      <form
        onSubmit={onSubmit}
        className="mt-8 max-w-xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="block text-sm font-medium">
          Token de convite *
          <input
            required
            value={inviteToken}
            onChange={(e) => setInviteToken(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-950"
            placeholder="ex: a1b2c3d"
          />
        </label>
        <label className="block text-sm font-medium">
          Sua chave Pix *
          <input
            required
            maxLength={200}
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm font-medium">
          Nome do seu time no Cartola *
          <input
            required
            maxLength={100}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Entrando…" : "Entrar na liga"}
        </button>
      </form>
    </div>
  );
}
