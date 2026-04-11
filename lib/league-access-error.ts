import { ApiError } from "@/lib/api/error";

export function leagueAccessErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "Liga não encontrada.";
    if (error.status === 401) {
      return "Esta liga é privada. Faça login na sua conta ou peça ao administrador que torne a liga pública.";
    }
    if (error.status === 403) return "Você não é membro desta liga.";
    return error.message;
  }
  return "Não foi possível carregar os dados da liga.";
}
