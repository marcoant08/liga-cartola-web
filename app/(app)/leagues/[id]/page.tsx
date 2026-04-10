"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { leaguesApi } from "@/lib/api/leagues";
import { roundsApi } from "@/lib/api/rounds";
import { ApiError } from "@/lib/api/error";
import { roundsSorted } from "@/lib/stats";

export default function LeagueDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: league, isLoading, error } = useQuery({
    queryKey: ["league", id],
    queryFn: () => leaguesApi.get(id),
  });

  const isAdmin = league && user && league.adminId === user.id;
  const sortedRounds = useMemo(
    () => roundsSorted(league?.rounds ?? []),
    [league?.rounds],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRoundValue, setEditRoundValue] = useState("");
  const [editMax, setEditMax] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestPix, setGuestPix] = useState("");
  const [guestTeam, setGuestTeam] = useState("");

  const [roundNumber, setRoundNumber] = useState("1");
  const [winnerId, setWinnerId] = useState("");

  const [inviteInfo, setInviteInfo] = useState<{ inviteToken: string; expiresAt: string } | null>(
    null,
  );

  const updateMutation = useMutation({
    mutationFn: () =>
      leaguesApi.update(id, {
        name: editName || undefined,
        description: editDescription || undefined,
        roundValue: editRoundValue ? Number(editRoundValue) : undefined,
        maxParticipants: editMax ? Number(editMax) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["league", id] });
      qc.invalidateQueries({ queryKey: ["leagues"] });
      setEditOpen(false);
      setFormError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError("Erro ao atualizar.");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => leaguesApi.generateInviteToken(id, {}),
    onSuccess: (data) => {
      setInviteInfo(data);
      qc.invalidateQueries({ queryKey: ["league", id] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setFormError(err.message);
    },
  });

  const addGuestMutation = useMutation({
    mutationFn: () =>
      leaguesApi.addGuest(id, {
        name: guestName,
        pixKey: guestPix,
        teamName: guestTeam,
        isGuest: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["league", id] });
      qc.invalidateQueries({ queryKey: ["leagues"] });
      setGuestName("");
      setGuestPix("");
      setGuestTeam("");
      setFormError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setFormError(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => leaguesApi.removeMember(id, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["league", id] });
      qc.invalidateQueries({ queryKey: ["leagues"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setFormError(err.message);
    },
  });

  const registerRoundMutation = useMutation({
    mutationFn: () =>
      roundsApi.registerWinner({
        leagueId: id,
        roundNumber: Number(roundNumber),
        winnerId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["league", id] });
      setFormError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setFormError(err.message);
    },
  });

  function openEdit() {
    if (!league) return;
    setEditName(league.name);
    setEditDescription(league.description);
    setEditRoundValue(String(league.roundValue));
    setEditMax(String(league.maxParticipants));
    setEditOpen(true);
    setFormError(null);
  }

  if (isLoading) {
    return <p className="text-zinc-500">Carregando liga…</p>;
  }

  if (error || !league) {
    return (
      <div>
        <Link href="/" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">
          ← Ligas
        </Link>
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          Liga não encontrada ou você não tem acesso.
        </p>
      </div>
    );
  }

  const members = league.members ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">
            ← Minhas ligas
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{league.name}</h1>
          <p className="mt-1 max-w-2xl text-zinc-600 dark:text-zinc-400">{league.description}</p>
        </div>
        <Link
          href={`/leagues/${id}/estatisticas`}
          className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          Estatísticas e gráficos
        </Link>
      </div>

      <dl className="mt-6 flex flex-wrap gap-6 text-sm">
        <div>
          <dt className="text-zinc-500">Valor da rodada</dt>
          <dd className="font-medium">R$ {Number(league.roundValue).toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Participantes</dt>
          <dd className="font-medium">
            {members.length} / {league.maxParticipants}
          </dd>
        </div>
        {isAdmin && (
          <div>
            <dt className="text-zinc-500">Você</dt>
            <dd className="font-medium text-emerald-700 dark:text-emerald-400">Administrador</dd>
          </div>
        )}
      </dl>

      {formError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {formError}
        </p>
      )}

      {isAdmin && (
        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Administração</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openEdit}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Editar liga
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                inviteMutation.mutate();
              }}
              disabled={inviteMutation.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {inviteMutation.isPending ? "Gerando…" : "Gerar token de convite"}
            </button>
          </div>

          {inviteInfo && (
            <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">Token de convite</p>
              <p className="mt-2 font-mono text-lg tracking-wide">{inviteInfo.inviteToken}</p>
              <p className="mt-1 text-emerald-800/80 dark:text-emerald-200/80">
                Expira em {new Date(inviteInfo.expiresAt).toLocaleString("pt-BR")}
              </p>
            </div>
          )}

          {editOpen && (
            <form
              className="mt-6 grid max-w-lg gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700"
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
            >
              <label className="text-sm font-medium">
                Nome
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="text-sm font-medium">
                Descrição
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Valor rodada
                  <input
                    type="number"
                    min={1}
                    value={editRoundValue}
                    onChange={(e) => setEditRoundValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <label className="text-sm font-medium">
                  Máx. participantes
                  <input
                    type="number"
                    min={2}
                    value={editMax}
                    onChange={(e) => setEditMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
            <h3 className="font-medium">Adicionar membro convidado</h3>
            <form
              className="mt-3 grid max-w-lg gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                addGuestMutation.mutate();
              }}
            >
              <input
                required
                placeholder="Nome"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
              <input
                required
                placeholder="Chave Pix"
                value={guestPix}
                onChange={(e) => setGuestPix(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
              <input
                required
                placeholder="Nome do time"
                value={guestTeam}
                onChange={(e) => setGuestTeam(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
              />
              <button
                type="submit"
                disabled={addGuestMutation.isPending}
                className="w-fit rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-200 dark:text-zinc-900"
              >
                {addGuestMutation.isPending ? "Adicionando…" : "Adicionar convidado"}
              </button>
            </form>
          </div>

          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
            <h3 className="font-medium">Registrar campeão da rodada</h3>
            <form
              className="mt-3 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!winnerId) return;
                registerRoundMutation.mutate();
              }}
            >
              <label className="text-sm font-medium">
                Rodada (1–38)
                <input
                  type="number"
                  min={1}
                  max={38}
                  required
                  value={roundNumber}
                  onChange={(e) => setRoundNumber(e.target.value)}
                  className="mt-1 block w-24 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="text-sm font-medium">
                Campeão
                <select
                  required
                  value={winnerId}
                  onChange={(e) => setWinnerId(e.target.value)}
                  className="mt-1 block min-w-[200px] rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                >
                  <option value="">Selecione…</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.teamName} ({m.userName}
                      {m.isGuest ? ", convidado" : ""})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={registerRoundMutation.isPending}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {registerRoundMutation.isPending ? "Salvando…" : "Registrar"}
              </button>
            </form>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Membros</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
              <tr>
                <th className="px-4 py-3 font-medium">Nome / time</th>
                <th className="px-4 py-3 font-medium">Pix</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-zinc-100 dark:border-zinc-800/80">
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.teamName}</div>
                    <div className="text-zinc-500">{m.userName}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{m.pixKey}</td>
                  <td className="px-4 py-3">{m.isGuest ? "Convidado" : "Cadastrado"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {m.userId !== league.adminId ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                `Remover ${m.userName} da liga?`,
                              )
                            ) {
                              removeMutation.mutate(m.userId);
                            }
                          }}
                          className="text-red-600 hover:underline dark:text-red-400"
                        >
                          Remover
                        </button>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Rodadas</h2>
        {sortedRounds.length === 0 ? (
          <p className="mt-2 text-zinc-500">Nenhuma rodada registrada ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {sortedRounds.map((r) => (
              <li key={r.roundNumber} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">Rodada {r.roundNumber}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{r.winnerName}</span>
                <span className="text-xs text-zinc-400">
                  {new Date(r.registeredAt).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
