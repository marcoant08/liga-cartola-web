"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/contexts/auth-context";
import { usersApi } from "@/lib/api/users";
import { ApiError } from "@/lib/api/error";
import type { User } from "@/lib/types/api";

function ProfileForm({
  user: initial,
  email,
  emailVerified,
  onSaved,
}: {
  user: Pick<User, "name" | "teamName" | "pixKey">;
  email: string;
  emailVerified: boolean;
  onSaved: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [teamName, setTeamName] = useState(initial.teamName);
  const [pixKey, setPixKey] = useState(initial.pixKey);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => usersApi.updateProfile({ name, teamName, pixKey }),
    onSuccess: async () => {
      setSaved(true);
      setError(null);
      await onSaved();
      qc.invalidateQueries({ queryKey: ["profile"] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else setError("Não foi possível salvar.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <>
      <p className="text-sm text-zinc-500">{email}</p>
      <form
        className="mt-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        onSubmit={handleSubmit}
      >
        <label className="block text-sm font-medium">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm font-medium">
          Nome do time (Cartola)
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm font-medium">
          Chave Pix
          <input
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <p className="text-xs text-zinc-500">
          E-mail verificado: {emailVerified ? "sim" : "não"}
        </p>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Perfil atualizado.</p>
        )}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </>
  );
}

function ProfilePageContent() {
  const { refreshUser } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => usersApi.getProfile(),
  });

  if (isLoading || !data) {
    return <p className="text-zinc-500">Carregando perfil…</p>;
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <ProfileForm
        key={data.updatedAt}
        user={{
          name: data.name,
          teamName: data.teamName,
          pixKey: data.pixKey,
        }}
        email={data.email}
        emailVerified={data.emailVerified}
        onSaved={refreshUser}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfilePageContent />
    </RequireAuth>
  );
}
