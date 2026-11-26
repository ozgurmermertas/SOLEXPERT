import { heliusRpcUrl } from "./config";

const DEFAULT_TIMEOUT_MS = 12_000;

/** Zaman aşımlı JSON fetch. HTTP hatasında gövdeyle birlikte hata fırlatır. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(res.status, `${res.status} ${url.split("?")[0]}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Helius üzerinden Solana JSON-RPC çağrısı (standart RPC ve DAS metotları). */
export async function rpc<T>(method: string, params: unknown): Promise<T> {
  const json = await fetchJson<{ result?: T; error?: { message: string } }>(heliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
  });
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result as T;
}
