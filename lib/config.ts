// Tüm ortam değişkenleri tek yerden okunur. Anahtarlar .env.local dosyasındadır.

export const config = {
  heliusKey: process.env.HELIUS_API_KEY || "",
  // İsteğe bağlı yedek anahtar: ilk anahtar yoğunken (429 / overloaded / 5xx) istek bununla tekrar denenir.
  heliusKey2: process.env.HELIUS_API_KEY_2 || "",
  geminiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
  // AI Studio'da hangi model ücretsizse adını buraya (veya .env.local'e) yaz.
  geminiModel: process.env.GEMINI_MODEL || "gemini-flash-latest",
  firecrawlKey: process.env.FIRECRAWL_API_KEY || "",
  elevenLabsKey: process.env.ELEVENLABS_API_KEY || "",
  // ElevenLabs panelinden Türkçe konuşabilen bir ses seçip ID'sini yaz.
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "",
  jupiterQuoteUrl: process.env.JUPITER_QUOTE_URL || "https://lite-api.jup.ag/swap/v1/quote",
};

/** Helius RPC adresleri: önce ana anahtar, varsa ikinci anahtar (HELIUS_API_KEY_2). */
export function heliusRpcUrls(): string[] {
  if (!config.heliusKey) {
    throw new Error("HELIUS_API_KEY eksik. .env.local dosyasına ekle.");
  }
  const keys = [config.heliusKey];
  if (config.heliusKey2 && config.heliusKey2 !== config.heliusKey) keys.push(config.heliusKey2);
  return keys.map((k) => `https://mainnet.helius-rpc.com/?api-key=${k}`);
}

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
