// ===== SolExpert ayarları =====
// Backend hazır olunca USE_MOCK = false yapın; API_BASE backend'in adresi
// (aynı Next.js / Vercel projesindeyse boş bırakın).
window.SOLEXPERT_CONFIG = {
  USE_MOCK: true,
  API_BASE: "",
  // POST {API_BASE}/api/analyze  body: { address }  -> rapor JSON'u (mocks/*.json ile aynı yapı)
  ANALYZE_PATH: "/api/analyze",
  // POST {API_BASE}/api/tts  body: { text }  -> audio/mpeg (ElevenLabs). Yoksa tarayıcı sesi kullanılır.
  TTS_PATH: "/api/tts",

  // Partner / sponsor kartları. Logoyu assets/logos/ altına koyun; dosya yoksa isim yazılır.
  PARTNERS: [
    { name: "Solana", logo: "assets/logos/solana.svg", url: "https://solana.com", role: "Blockchain altyapısı" },
    { name: "ElevenLabs", logo: "assets/logos/elevenlabs.svg", url: "https://elevenlabs.io", role: "Sesli rapor" },
    { name: "Vercel", logo: "assets/logos/vercel.svg", url: "https://vercel.com", role: "Yayın ve barındırma" },
  ],
};
