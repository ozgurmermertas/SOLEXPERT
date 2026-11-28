// ===== SolExpert ayarları =====
// Arayüz aynı Next.js projesindeki backend'i çağırır (bkz. API.md).
// API_BASE backend'in adresi (aynı Next.js / Vercel projesindeyse boş bırakın).
window.SOLEXPERT_CONFIG = {
  API_BASE: "",
  // POST {API_BASE}/api/analyze  body: { address }  -> TokenReport (lib/types.ts); app.js tasarıma çevirir
  ANALYZE_PATH: "/api/analyze",
  // Analiz isteği bu süreden uzun sürerse iptal edilir (ms). Backend maxDuration = 60 sn.
  ANALYZE_TIMEOUT_MS: 65000,
  // POST {API_BASE}/api/voice  body: { text }  -> audio/mpeg (ElevenLabs, sunucudaki ELEVENLABS_VOICE_ID ile).
  // Anahtar yoksa (503) tarayıcı sesine düşer.
  TTS_PATH: "/api/voice",
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

  // "Örnek riskli / temiz token" butonlarının analiz ettiği gerçek adresler.
  // Boşsa buton tıklanınca Ekspi "henüz eklenmedi" der. Hackathon günü risky'ye bilinen bir scam adresi yazılabilir.
  DEMO_ADDRESSES: {
    risky: "CmVUoJUt7hMGc9ze7s8zYdnA7enMfCAFdQCggxcbACWU", // CWU (bilinen rug pull)
    safe: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  },

  // "Kullanılan teknolojiler" kartları. Logoyu assets/logos/ altına koyun; dosya yoksa isim yazılır.
  PARTNERS: [
    { name: "Solana", logo: "assets/logos/solana.svg", url: "https://solana.com", role: "Zincir üstü token verisi", roleEn: "On-chain token data" },
    { name: "Firecrawl", logo: "assets/logos/firecrawl.svg", url: "https://firecrawl.dev", role: "Proje sitesinin taranması", roleEn: "Project website scanning" },
    { name: "ElevenLabs", logo: "assets/logos/elevenlabs.svg", url: "https://elevenlabs.io", role: "Sesli rapor", roleEn: "Voice reports" },
    { name: "Supabase", logo: "assets/logos/supabase.svg", url: "https://supabase.com", role: "Rapor kayıtları", roleEn: "Report storage" },
    { name: "Vercel", logo: "assets/logos/vercel.svg", url: "https://vercel.com", role: "Yayın ve barındırma", roleEn: "Deployment and hosting" },
  ],
};
