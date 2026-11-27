// ===== SolExpert ayarları =====
// Backend hazır olunca USE_MOCK = false yapın; API_BASE backend'in adresi
// (aynı Next.js / Vercel projesindeyse boş bırakın).
window.SOLEXPERT_CONFIG = {
  USE_MOCK: true,
  API_BASE: "",
  // POST {API_BASE}/api/analyze  body: { address }  -> rapor JSON'u (mocks/*.json ile aynı yapı)
  ANALYZE_PATH: "/api/analyze",
  // POST {API_BASE}/api/tts  body: { text, voiceId }  -> audio/mpeg (ElevenLabs).
  // Analiz mock'ta olsa bile ses her zaman önce buradan denenir; route yoksa tarayıcı sesine düşer.
  TTS_PATH: "/api/tts",
  // GET {API_BASE}/api/voices -> hesabınızdaki ElevenLabs sesleri [{ id, name, desc }]
  VOICES_PATH: "/api/voices",

  // /api/voices çalışmazsa panelde gösterilecek ElevenLabs sesleri (varsayılan sesler).
  // ElevenLabs varsayılan sesleri 31 Aralık 2026'da kaldırıyor; sonrası için kendi kütüphanenizden ID ekleyin.
  ELEVEN_VOICES: [
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", desc: "genç, sevimli · baykuşa en uygun", descEn: "young, cute · best for the owl" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", desc: "yumuşak, sıcak", descEn: "soft, warm" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", desc: "enerjik, net", descEn: "energetic, clear" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", desc: "erkek, samimi", descEn: "male, friendly" },
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "sakin anlatıcı", descEn: "calm narrator" },
  ],

  // "Kullanılan teknolojiler" kartları. Logoyu assets/logos/ altına koyun; dosya yoksa isim yazılır.
  PARTNERS: [
    { name: "Solana", logo: "assets/logos/solana.svg", url: "https://solana.com", role: "Zincir üstü token verisi", roleEn: "On-chain token data" },
    { name: "Firecrawl", logo: "assets/logos/firecrawl.svg", url: "https://firecrawl.dev", role: "Proje sitesinin taranması", roleEn: "Project website scanning" },
    { name: "ElevenLabs", logo: "assets/logos/elevenlabs.svg", url: "https://elevenlabs.io", role: "Sesli rapor", roleEn: "Voice reports" },
    { name: "Supabase", logo: "assets/logos/supabase.svg", url: "https://supabase.com", role: "Rapor kayıtları", roleEn: "Report storage" },
    { name: "Vercel", logo: "assets/logos/vercel.svg", url: "https://vercel.com", role: "Yayın ve barındırma", roleEn: "Deployment and hosting" },
  ],
};
