import { heliusRpcUrls } from "./config";

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

// Helius yoğunluk hatasında (429 / "overloaded") bu aralıklarla tekrar denenir (ücretsiz katmanda sık olur).
const RATE_LIMIT_BACKOFF_MS = [300, 700, 1500, 3000];

// İki anahtar varsa en son başarılı olanla başlanır (yoğun anahtarı boşuna zorlamamak için).
let preferredKey = 0;

/** Bu hatada aynı istek diğer anahtarla denenebilir mi? (429, "overloaded" gibi geçici RPC hatası, 5xx) */
function isKeyRetryable(e: unknown): boolean {
  return e instanceof HttpError && (e.status === 429 || e.status >= 500);
}

/**
 * Helius üzerinden Solana JSON-RPC çağrısı (standart RPC ve DAS metotları).
 * Bir anahtar 429 / "overloaded" / 5xx verirse istek hemen diğer anahtarla (HELIUS_API_KEY_2) denenir.
 * İkisi de 429 / "overloaded" verirse bekleyip tekrar denenir. Tek anahtar varsa eskisi gibi çalışır.
 */
export async function rpc<T>(method: string, params: unknown): Promise<T> {
  const urls = heliusRpcUrls();
  const body = JSON.stringify({ jsonrpc: "2.0", id: method, method, params });
  for (let round = 0; ; round++) {
    let lastError: unknown;
    let rateLimited = false;
    const first = preferredKey % urls.length;
    for (let i = 0; i < urls.length; i++) {
      const k = (first + i) % urls.length;
      try {
        const json = await fetchJson<{ result?: T; error?: { message: string } }>(urls[k], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (json.error) {
          // Helius yoğunken "... overloaded, please try again" döner: hız limiti gibi tekrar denenir.
          const transient = /overloaded|try again|rate limit/i.test(json.error.message);
          throw transient ? new HttpError(429, `RPC ${method}: ${json.error.message}`) : new Error(`RPC ${method}: ${json.error.message}`);
        }
        preferredKey = k;
        return json.result as T;
      } catch (e) {
        if (!isKeyRetryable(e)) throw e;
        lastError = e;
        if ((e as HttpError).status === 429) rateLimited = true;
      }
    }
    // Tüm anahtarlar denendi. Sadece yoğunluk hatasında beklenip tekrar denenir (5xx tekrarlanmaz, eskisi gibi).
    const wait = RATE_LIMIT_BACKOFF_MS[round];
    if (!rateLimited || wait === undefined) throw lastError;
    await new Promise((r) => setTimeout(r, wait + Math.random() * 200));
  }
}
