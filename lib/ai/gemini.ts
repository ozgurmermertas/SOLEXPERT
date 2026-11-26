// Google Gemini (ücretsiz katman) ile metin üretimi. SDK yerine doğrudan REST.
// Sunucu yoğunsa (503) veya limit dolduysa (429) önce tekrar dener, sonra yedek modele geçer.
import { config } from "../config";
import { fetchJson, HttpError } from "../http";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

// Ana model yoğunsa sırayla bunlar denenir.
const FALLBACK_MODELS = ["gemini-flash-lite-latest"];
const RETRYABLE = new Set([429, 500, 503]);

export function aiEnabled(): boolean {
  return !!config.geminiKey;
}

export async function generate(prompt: string, opts: { json?: boolean } = {}): Promise<string> {
  if (!config.geminiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY eksik.");

  // Sıra: ana model → yedek model → ana model (son bir şans). Her deneme en fazla 15 sn.
  const fallbacks = FALLBACK_MODELS.filter((m) => m !== config.geminiModel);
  const plan = [config.geminiModel, ...fallbacks, config.geminiModel];
  let lastError: unknown;

  for (let i = 0; i < plan.length; i++) {
    const model = plan[i];
    try {
      return await callModel(model, prompt, opts);
    } catch (e) {
      lastError = e;
      if (!isRetryable(e)) throw e; // Kalıcı hata (ör. yanlış anahtar): dur.
      console.warn(`[gemini] ${model} cevap vermedi (${reason(e)}), sıradaki deneniyor...`);
      if (i < plan.length - 1) await sleep(1000);
    }
  }
  throw lastError;
}

function isRetryable(e: unknown): boolean {
  if (e instanceof HttpError) return RETRYABLE.has(e.status);
  // fetch zaman aşımı veya bağlantı kopması
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError" || /timeout|fetch failed/i.test(e.message));
}

function reason(e: unknown): string {
  if (e instanceof HttpError) return String(e.status);
  return e instanceof Error && /timeout|abort/i.test(e.name + e.message) ? "zaman aşımı" : "bağlantı";
}

async function callModel(model: string, prompt: string, opts: { json?: boolean }): Promise<string> {
  const res = await fetchJson<GeminiResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.geminiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
    15_000,
  );

  const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini boş yanıt döndü.");
  return text;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
