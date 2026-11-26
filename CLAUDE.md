# Token Ekspertiz Ajanı — Proje Rehberi

> Bu dosya iki takım üyesinin Claude'u için ortak bağlamdır. Her oturumun başında okunur.
> Bir karar değişirse ÖNCE bu dosyayı güncelle, sonra kodu.

## Proje nedir?
Kullanıcı bir Solana token adresi yapıştırır; ajan token'ı zincirden ve resmi sitesinden
"muayene eder", 0–100 arası bir risk skoru ve sade Türkçe bir rapor üretir.
Hedef: borsalara (Binance vb.) listelenmeden önceki yeni token'lar (pump.fun, Jupiter).

Hackathon: Dev3pack (Solana), 27–29 Kasım 2026. Sponsorlar: Solana, Firecrawl, ElevenLabs, Supabase.

## Temel kurallar
1. **Skoru LLM hesaplamaz.** Skor `lib/scoring/score.ts` içinde sabit kurallarla hesaplanır.
   LLM sadece bulguları okuyup Türkçe açıklama yazar. Aynı token → her zaman aynı skor.
2. **Zincir verisi sadece okunur.** Token analizleri mainnet'ten OKUNUR (gerçek token'lar orada).
   Zincire YAZMA (rapor hash'i) sadece devnet'te yapılır. Gerçek para harcayan kod yazılmaz.
3. **Ortak sözleşme `lib/types.ts`.** Bu dosya iki kişinin anlaşmasıdır; tek taraflı değiştirilmez.
   Değişiklik gerekiyorsa önce takım arkadaşına haber ver.
4. Bir kontrol hata verirse tüm analiz çökmesin: o kontrol `durum: "bilinmiyor"` döner.
5. API anahtarları sadece `.env.local` içinde. Asla commit'lenmez.
6. Arayüz metinleri Türkçe. Kod (değişken/fonksiyon adları) İngilizce olabilir.

## Teknoloji
- Next.js (App Router) + TypeScript
- Solana verisi: Helius RPC + DAS, doğrudan `fetch` ile (SDK yok)
- DexScreener API, Jupiter quote API, RugCheck raporu (anahtarsız)
- Yapay zekâ: Google Gemini ücretsiz katmanı (REST, `lib/ai/gemini.ts`)
- Firecrawl (site tarama), ElevenLabs (sesli rapor)

## Dallar (branch)
- `main` → her zaman çalışan, birleştirilmiş sürüm
- `backend` → Özgür
- `frontend` → takım arkadaşı

## Klasör yapısı ve sahiplik
```
app/
  page.tsx, components/     ← FRONTEND (arkadaş)
  api/analyze/route.ts      ← BACKEND  POST {address} → TokenReport
  api/voice/route.ts        ← BACKEND  POST {text} → audio/mpeg
lib/
  types.ts                  ← ORTAK    (sözleşme — birlikte değiştirilir)
  mock/report.mock.ts       ← ORTAK    (arayüz geliştirme için sahte rapor)
  analyze.ts                ← BACKEND  (ana akış, tüm kontrolleri sırayla çağırır)
  facts.ts                  ← BACKEND  (kontrollerin topladığı ham veri tipleri)
  config.ts, http.ts        ← BACKEND
  onchain/                  ← BACKEND
    mint.ts                 (basma/dondurma yetkisi + Token-2022 ayarları)
    metadata.ts             (isim, sembol, resmi site/twitter/telegram linkleri)
    holders.ts              (ilk 10 holder + oluşturan cüzdan ve payı)
    market.ts               (DexScreener: likidite, yaş, linkler)
    sellTest.ts             (Jupiter satış teklifi)
    lpLock.ts               (likidite kilidi: pump.fun eğrisi / RugCheck)
  offchain/website.ts       ← BACKEND  (Firecrawl + Gemini kırmızı bayrak işaretleme)
  scoring/score.ts          ← BACKEND  (TÜM puan kuralları)
  ai/gemini.ts, ai/report.ts← BACKEND  (LLM çağrısı + Türkçe özet)
scripts/test-token.ts       ← BACKEND  (terminalden test: npm run test:token -- ADRES)
API.md                      ← Frontend'in backend'i nasıl çağıracağı
```

## Yapılacaklar (TODO)
- [ ] `attestationTx`: rapor hash'ini devnet'e memo olarak yazmak (@solana/web3.js + devnet cüzdanı)
- [ ] Supabase ile rapor cache'i (aynı token 10 dk içinde tekrar sorulursa)
- [ ] (Opsiyonel) X API ile bot hesap tespiti

## Kontroller ve puanlar (risk puanı; toplam 100'de kesilir)
| id | Kontrol | Tehlikeli durum | Puan |
|---|---|---|---|
| mint_authority | Basma yetkisi | Açık | 25 |
| freeze_authority | Dondurma yetkisi | Açık | 15 |
| token2022 | Gizli ayarlar | Transfer vergisi veya permanent delegate | 20 |
| top10 | İlk 10 holder payı | >%50 → 15, %30–50 → 7 | 15 |
| dev_share | Geliştirici payı | >%10 | 10 |
| sell_test | Satılabilirlik | Satış rotası yok | 30 |
| liquidity | Likidite | < 10.000 $ | 10 |
| lp_lock | Likidite kilidi | LP kilitli/yakılmış değil | 15 |
| age | Token yaşı | < 24 saat | 5 |
| website | Resmi site | Kopya içerik / abartılı vaat / zincirle çelişki | 10 |

Skor aralıkları: 0–30 düşük (yeşil), 31–60 dikkat (sarı), 61–100 yüksek (kırmızı).
Büyük bir borsada listeliyse rapora olumlu sinyal olarak yazılır (skoru düşürmez).

## Git kuralları
- `main` her zaman çalışır durumda olur.
- Herkes kendi dalında çalışır (`backend` / `frontend`), bitince main'e birleştirir.
- Küçük, sık commit. Birleştirmeden önce `npm run typecheck` geçmeli.

## Komutlar
- `npm run dev` — geliştirme sunucusu (http://localhost:3000)
- `npm run typecheck` — tip kontrolü
- `npm run test:token -- ADRES` — tek bir token'ı terminalde analiz et (`--no-ai` ile hızlı)

## Test için token adresleri
(Hackathon günü buraya 1 güvenilir + 1 bilinen scam token adresi ekleyin.)
