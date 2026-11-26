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
| `mocks/*.json` | Backend gelene kadar kullanılan örnek raporlar |
| `assets/logos/` | Sponsor logoları buraya: `solana.svg`, `elevenlabs.svg`, `vercel.svg` |

## Backend ile birleştirme (yarın)
1. `js/config.js` içinde `USE_MOCK: false` yap.
2. Backend şu iki endpoint'i sağlamalı:
   - `POST /api/analyze` · body `{ "address": "..." }` → rapor JSON'u
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

## Ekspi'nin sesi: ElevenLabs (`/api/tts`) — backend için hazır route
Tarayıcı sesi sadece yedek. Asıl ses için Next.js'e şu dosyayı ekleyin: `app/api/tts/route.ts`
```ts
export async function POST(req: Request) {
  const { text } = await req.json();
  const voiceId = process.env.ELEVENLABS_VOICE_ID!; // ElevenLabs Voice Library'den seçtiğiniz sesin ID'si
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",          // Türkçe destekli
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5 },
    }),
  });
  if (!r.ok) return new Response(await r.text(), { status: r.status });
  return new Response(r.body, { headers: { "Content-Type": "audio/mpeg" } });
}
```
- `.env.local` içine `ELEVENLABS_API_KEY` ve `ELEVENLABS_VOICE_ID` koyun. **Anahtar asla frontend'e girmesin.**
- Baykuşa uygun ses: Voice Library'de "playful / cartoon / young" diye filtreleyip birkaçını Türkçe metinle deneyin.
- Sonra `js/config.js` → `USE_MOCK: false`. Site otomatik olarak ElevenLabs sesine geçer, gaga da gerçek sese göre oynar.
