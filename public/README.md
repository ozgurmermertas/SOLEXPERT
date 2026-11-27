# SolExpert — Frontend

Saf HTML/CSS/JS. Kurulum yok, build yok. Herhangi bir backend'in yanına konur.

## Çalıştırma
```bash
npx serve .        # ya da: python3 -m http.server
```
`index.html` doğrudan dosyadan açılırsa mock JSON'lar yüklenmez; bir yerel sunucu kullanın.

## Dosyalar
| Dosya | Ne yapar |
|---|---|
| `js/config.js` | **Tek ayar dosyası.** Mock/gerçek API, endpoint yolları, partner listesi |
| `js/app.js` | Form, analiz adımları, rapor çizimi, sayaçlar, paylaşım linki (`?address=`) |
| `js/mascot.js` | Ekspi baykuşu: kaydırınca yay hareketiyle takip eder, bölüme göre konuşur, tıklayınca sesli okur |
| `js/voice.js` | Ses: `audioUrl` → `/api/tts` (ElevenLabs) → tarayıcı sesi (yedek) |
| `js/coins.js` | Arka planda dönen coinler (canvas) |
| `js/i18n.js` | Türkçe / İngilizce metinler ve dil düğmesi |
| `js/facts.js` | Ekspi'nin anlattığı istatistikler (TR + EN) |
| `mocks/*.json` | Backend gelene kadar kullanılan örnek raporlar |
| `assets/logos/` | Sponsor logoları buraya: `solana.svg`, `elevenlabs.svg`, `vercel.svg` |

## Backend ile birleştirme (yarın)
1. `js/config.js` içinde `USE_MOCK: false` yap.
2. Backend şu iki endpoint'i sağlamalı:
   - `POST /api/analyze` · body `{ "address": "...", "lang": "tr" | "en" }` → rapor JSON'u (metinler `lang` dilinde yazılmalı)
   - `POST /api/tts` · body `{ "text": "..." }` → `audio/mpeg` (ElevenLabs). İsteğe bağlı: rapor zaten `audioUrl` döndürüyorsa gerekmez.
3. Backend Next.js ise bu klasörün içeriğini `public/` altına koyun; aynı origin olduğu için CORS gerekmez.

### Rapor JSON'u (backend'in döndürmesi gereken)
Önceki sözleşmeye ek alanlar var: `verdictLabel`, `checks[].raw`, `holders`, `siteFlags`.
```json
{
  "address": "…",
  "riskScore": 82,                    // 0–100
  "verdict": "danger",                // danger | warn | ok
  "verdictLabel": "UZAK DUR",         // opsiyonel
  "summary": "Sade Türkçe özet",
  "checks": [{ "id": "mint_authority", "label": "…", "status": "danger", "detail": "…", "raw": "teknik değer" }],
  "holders": [{ "label": "Cüzdan #1", "pct": 41 }],
  "siteFlags": [{ "text": "\"Garanti 100x\"", "level": "warn" }],
  "audioUrl": "https://…/report.mp3"  // veya null
}
```

## Logolar
Resmi logoları sponsorların marka kitlerinden indirin (hackathon sponsor sayfası genelde verir). Dosya yoksa site otomatik olarak ismi gradyanla yazar.

## Ekspi'nin sesi: ElevenLabs
Zip'teki `solexpert-api/` klasöründe iki hazır route var:
- `tts/route.ts` → `app/api/tts/route.ts` (metni ElevenLabs sesiyle mp3'e çevirir)
- `voices/route.ts` → `app/api/voices/route.ts` (hesaptaki sesleri baykuşun paneline listeler)

`.env.local` içine `ELEVENLABS_API_KEY=...` koyun (repoya girmez). `npm run dev` ile açınca baykuşa tıklayıp paneldeki ses listesinden seçin, "Sesi dene" ile dinleyin.
Analiz mock'ta olsa bile ses ElevenLabs'tan gelir. Route yoksa site kendiliğinden tarayıcı sesine düşer.

Not: ElevenLabs varsayılan sesleri (Elli, Bella, Domi, Antoni, Rachel) 31 Aralık 2026'da kaldırılıyor. Sonrası için Voice Library'den ses ekleyin; `/api/voices` onları otomatik listeler.
