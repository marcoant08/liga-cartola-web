import type { ApiErrorBody } from "@/lib/types/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function formatApiMessage(message: string | string[] | undefined): string {
  if (message == null) return "Erro desconhecido";
  return Array.isArray(message) ? message.join(" ") : String(message);
}

export async function parseErrorBody(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ApiErrorBody;
    return formatApiMessage(data.message);
  } catch {
    return res.statusText || "Erro na requisição";
  }
}
