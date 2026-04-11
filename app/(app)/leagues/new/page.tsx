"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/require-auth";
import { leaguesApi } from "@/lib/api/leagues";
import { usersApi } from "@/lib/api/users";
import { ApiError } from "@/lib/api/error";

function NewLeagueForm({
  profileTeamName,
  profilePixKey,
}: {
  profileTeamName: string;
  profilePixKey: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roundValue, setRoundValue] = useState("5");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileOk =
    profileTeamName.trim().length > 0 && profilePixKey.trim().length > 0;

  const mutation = useMutation({
    mutationFn: () =>
      leaguesApi.create({
        name,
        description,
        roundValue: Number(roundValue),
        maxParticipants: Number(maxParticipants),
        isPublic,
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
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
      <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-1 rounded border-zinc-300 dark:border-zinc-600"
        />
        <span>
          Liga pública — qualquer pessoa pode ver esta liga e as rodadas <strong>sem</strong> estar logada
          (sem ver chaves Pix nem convites).
        </span>
      </label>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Seu cadastro na liga (do perfil, não editável aqui)
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">Chave Pix</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
              {profilePixKey.trim() ? profilePixKey : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Nome do time no Cartola</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
              {profileTeamName.trim() ? profileTeamName : "—"}
            </dd>
          </div>
        </dl>
        {!profileOk && (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            Preencha chave Pix e nome do time no{" "}
            <Link href="/profile" className="font-medium underline">
              perfil
            </Link>{" "}
            para poder criar uma liga.
          </p>
        )}
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending || !profileOk}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {mutation.isPending ? "Criando…" : "Criar liga"}
      </button>
    </form>
  );
}

function NewLeaguePageContent() {
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["profile"],
    queryFn: () => usersApi.getProfile(),
  });

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
      {isLoading && <p className="mt-8 text-zinc-500">Carregando seu perfil…</p>}
      {isError && (
        <p className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          Não foi possível carregar o perfil. Atualize a página ou confira se está autenticado.
        </p>
      )}
      {profile && (
        <NewLeagueForm
          key={profile.updatedAt}
          profileTeamName={profile.teamName}
          profilePixKey={profile.pixKey}
        />
      )}
    </div>
  );
}

export default function NewLeaguePage() {
  return (
    <RequireAuth>
      <NewLeaguePageContent />
    </RequireAuth>
  );
}
