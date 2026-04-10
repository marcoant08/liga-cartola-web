"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { leaguesApi } from "@/lib/api/leagues";
import { ApiError } from "@/lib/api/error";

export default function NewLeaguePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roundValue, setRoundValue] = useState("5");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [pixKey, setPixKey] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      leaguesApi.create({
        name,
        description,
        roundValue: Number(roundValue),
        maxParticipants: Number(maxParticipants),
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
      else setError("Erro ao criar liga.");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div>
      <Link
        href="/"
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Voltar às ligas
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Nova liga</h1>
      <p className="text-sm text-zinc-500">
        Você será o administrador. Campos seguem as regras da API (valores mínimos, tamanhos máximos).
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-8 max-w-xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="block text-sm font-medium">
          Nome da liga *
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm font-medium">
          Descrição *
          <textarea
            required
            maxLength={500}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Valor da rodada (R$) *
            <input
              type="number"
              required
              min={1}
              step="0.01"
              value={roundValue}
              onChange={(e) => setRoundValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <label className="block text-sm font-medium">
            Máx. participantes *
            <input
              type="number"
              required
              min={2}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Chave Pix da liga (repasse) *
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
          {mutation.isPending ? "Criando…" : "Criar liga"}
        </button>
      </form>
    </div>
  );
}
