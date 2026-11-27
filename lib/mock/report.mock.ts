// Arayüz ve AI tarafı, gerçek on-chain kod hazır olana kadar bu sahte raporla çalışır.
import type { TokenReport } from "../types";

export const mockRiskyReport: TokenReport = {
  token: {
    address: "SahteAdres1111111111111111111111111111111111",
    name: "Moon Doge Rocket",
    symbol: "MDR",
    imageUrl: null,
    website: "https://moondogerocket.example",
    twitter: "https://x.com/moondogerocket",
    telegram: null,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    priceUsd: 0.00004,
    liquidityUsd: 6200,
  },
  score: 92,
  level: "yuksek",
  checks: [
    { id: "mint_authority", group: "anahtarlar", title: "Basma yetkisi", status: "tehlikeli", points: 25, detail: "Yetki hâlâ açık: geliştirici yeni token basabilir." },
    { id: "freeze_authority", group: "anahtarlar", title: "Dondurma yetkisi", status: "gecti", points: 0, detail: "Yetki kapatılmış." },
    { id: "token2022", group: "anahtarlar", title: "Gizli ayarlar", status: "gecti", points: 0, detail: "Standart SPL token, gizli ayar yok." },
    { id: "top10", group: "dagilim", title: "İlk 10 holder", status: "tehlikeli", points: 15, detail: "Arzın %71'i ilk 10 cüzdanda." },
    { id: "dev_share", group: "dagilim", title: "Geliştirici payı", status: "tehlikeli", points: 10, detail: "Geliştirici cüzdanı arzın %18'ini tutuyor." },
    { id: "sell_test", group: "alim_satim", title: "Satış testi", status: "gecti", points: 0, detail: "Jupiter üzerinden satış rotası bulundu." },
    { id: "liquidity", group: "alim_satim", title: "Likidite", status: "tehlikeli", points: 10, detail: "Likidite sadece 6.200 $." },
    { id: "lp_lock", group: "alim_satim", title: "Likidite kilidi", status: "tehlikeli", points: 15, detail: "LP token'ları kilitli değil: havuz çekilebilir." },
    { id: "age", group: "proje", title: "Token yaşı", status: "dikkat", points: 5, detail: "Token 5 saat önce oluşturuldu." },
    { id: "website", group: "proje", title: "Resmi site", status: "tehlikeli", points: 10, detail: "Sitede 'garanti 100x' vaadi var; 'likidite kilitli' iddiası zincirle çelişiyor." },
  ],
  positiveSignals: [],
  holderDistribution: [
    { kind: "pool", rank: 1, pct: 41 },
    { kind: "wallet", rank: 2, pct: 14 },
    { kind: "wallet", rank: 3, pct: 9 },
    { kind: "wallets4to10", rank: null, pct: 7 },
    { kind: "others", rank: null, pct: 29 },
  ],
  topHolders: null,
  priceHistory: null,
  liquidityToMcapPct: 3.2,
  websiteNotes: [
    { text: "Sitedeki iddialar zincirle çelişiyor.", textEn: "Claims on the site contradict on-chain data.", level: "warn" },
    { text: "Site likiditenin kilitli olduğunu söylüyor ama zincirde kilit yok.", textEn: "The site says liquidity is locked, but there is no lock on-chain.", level: "warn" },
  ],
  summary:
    "Bu token yüksek riskli. Geliştirici hâlâ yeni token basabilir, havuzdaki parayı çekebilir ve arzın %71'i 10 cüzdanda. Sitesi likiditenin kilitli olduğunu söylüyor ama zincirde kilit yok.",
  attestationTx: null,
  analyzedAt: new Date().toISOString(),
};
