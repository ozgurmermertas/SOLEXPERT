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
7. AI özeti asla "güvenli" / "safe" demez (TR ve EN). Düşük riskte: "temel kontrollerde belirgin
   bir risk bulunamadı, ama bu bir garanti değil". `lib/ai/report.ts` yasaklı kelimeyi yakalarsa yeniden üretir.
   Tehlikeli bulgu varsa "belirgin risk bulunamadı" demez; önce riskleri söyler (yakalanırsa yeniden üretilir).

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
    bundle.ts               (bağlantılı cüzdanlar: aynı kaynaktan fonlanan büyük holderlar)
    owners.ts               (cüzdan mı havuz/program mı? + en büyük hesaplar, paylaşılan sorgu)
    priceHistory.ts         (GeckoTerminal: son 7 gün fiyat, sadece grafik için)
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
- [x] Rapor cache'i (10 dk, bellek içi — `lib/analyze.ts`)
- [ ] Supabase ile kalıcı rapor cache'i (sunucu yeniden başlasa da kalsın)
- [ ] (Opsiyonel) X API ile bot hesap tespiti

## Kontroller ve puanlar (risk puanı; toplam 100'de kesilir)
| id | Kontrol | Tehlikeli durum | Puan |
|---|---|---|---|
| mint_authority | Basma yetkisi | Açık | 25 |
| freeze_authority | Dondurma yetkisi | Açık | 15 |
| token2022 | Gizli ayarlar | Transfer vergisi veya permanent delegate | 20 |
| top10 | İlk 10 holder payı | >%50 → 15, %30–50 → 7 | 15 |
| dev_share | Geliştirici payı | >%10 | 10 |
| bundle | Bağlantılı cüzdanlar (EN: Linked wallets) | Aynı kaynaktan fonlanan 3+ büyük holder **veya** grubun payı >%15 → 20 ve skor en az 61; 2 cüzdan → dikkat, 5 | 20 (+taban 61) |
| sell_test | Satılabilirlik | Satış rotası yok | 30 |
| liquidity | Likidite | < 5.000 $ (ya da havuz yok) → 20; < 10.000 $ → 10 | 20 |
| lp_lock | Likidite kilidi | LP kilitli/yakılmış değil | 15 |
| age | Token yaşı | < 24 saat | 5 |
| website | Resmi site | Abartılı vaat veya zincirle çelişki → 10; sadece şablon/jenerik içerik → dikkat, 0 | 10 |

Skor aralıkları: 0–30 düşük (yeşil), 31–60 dikkat (sarı), 61–100 yüksek (kırmızı).
Özel kurallar (skor tabanları — skor seviyenin alt sınırına çıkar, gösterge ile seviye hep tutarlı):
- `bundle` "tehlikeli" → skor en az **61** (yüksek).
- 3 ya da daha fazla "tehlikeli" kontrol → skor en az **61** (yüksek); 2 tane → en az **31** (dikkat).
- Token 24 saatten yeni (`age` "dikkat") **ve** likidite 10.000 $ altı (`liquidity` "tehlikeli") → skor en az **61** (yüksek).
- `sell_test`, `liquidity` veya `top10` "bilinmiyor" ise skor en az **31** (dikkat) olur ve özetin başına
  "Bazı kontrollerin verisi alınamadı, bu yüzden dikkatli olunmalı." eklenir (AI kapalıyken özet bu cümledir).
  İstisna — köklü token: basma ve dondurma yetkisi kapalı, likidite > 1 milyon $ ve 90 günden eski → bu kural uygulanmaz.
- Sahibi milyonlarca olan token'larda (ör. Wrapped SOL) Helius `getTokenLargestAccounts` reddeder ("Too many accounts"):
  `top10` ve `bundle` "bilinmiyor" kalır, metin "Çok fazla sahibi olduğu için dağılım hesaplanamadı." olur.

`bundle` yöntemi (`lib/onchain/bundle.ts`): en büyük 12 token hesabı → sahip cüzdanlar
(havuz/program hesapları çıkarılır: sadece System Program'a ait cüzdanlar) → 2 adımlı iz:
1. adım = cüzdanın ilk işleminde ona SOL gönderen (yoksa o işlemi ödeyen) hesap,
2. adım = 1. adımın kendi ilk işlemindeki fonlayanı. Ortak 1. adımı olan cüzdanlar aynı gruba girer.
2. adım kaynakları ve 1000+ işlemli 1. adım kaynakları (borsa/bot olabilir) sadece ilk işlemleri
birbirine ≤ 1 saat olan cüzdanları bağlar. 1000+ işlemli holder cüzdanı atlanır.
Aynı anda en fazla 3 RPC isteği (Helius 429'u azaltmak için); tüm kontrol en fazla 12 sn.
Süre dolunca o ana kadar incelenenlerde tehlikeli grup varsa kısmi sonuç kullanılır, yoksa "bilinmiyor".
`lib/http.ts`: `.env.local`de `HELIUS_API_KEY_2` varsa, bir anahtar 429 / "overloaded" / 5xx verince
aynı istek hemen diğer anahtarla denenir (en son başarılı anahtarla başlanır). İkisi de 429 / "overloaded"
verirse istek 4 kez tekrar denenir (0,3 / 0,7 / 1,5 / 3 sn). İkinci anahtar yoksa tek anahtarla aynı şekilde çalışır.

Önbellek: `analyzeToken` sonucu 10 dk bellekte tutulur (adres + AI açık/kapalı + dil).
Aynı anda gelen aynı istekler tek analizi paylaşır. Sunucu yeniden başlarsa boşalır.
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
