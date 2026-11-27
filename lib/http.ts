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

// Helius hız limiti (429) dolunca bu aralıklarla tekrar denenir (ücretsiz katmanda sık olur).
const RATE_LIMIT_BACKOFF_MS = [300, 700, 1500, 3000];

/** Helius üzerinden Solana JSON-RPC çağrısı (standart RPC ve DAS metotları). */
export async function rpc<T>(method: string, params: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const json = await fetchJson<{ result?: T; error?: { message: string } }>(heliusRpcUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
      });
      if (json.error) {
        // Helius yoğunken "... overloaded, please try again" döner: hız limiti gibi tekrar denenir.
        const transient = /overloaded|try again|rate limit/i.test(json.error.message);
        throw transient ? new HttpError(429, `RPC ${method}: ${json.error.message}`) : new Error(`RPC ${method}: ${json.error.message}`);
      }
      return json.result as T;
    } catch (e) {
      const wait = RATE_LIMIT_BACKOFF_MS[attempt];
      if (!(e instanceof HttpError && e.status === 429) || wait === undefined) throw e;
      await new Promise((r) => setTimeout(r, wait + Math.random() * 200));
    }
  }
}
