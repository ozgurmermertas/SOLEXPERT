// ORTAK SÖZLEŞME — iki takım üyesi birlikte değiştirir.
// On-chain taraf (Özgür) bu şekilde veri üretir, arayüz/AI tarafı bu şekli tüketir.

export type CheckStatus = "gecti" | "dikkat" | "tehlikeli" | "bilinmiyor";

export type CheckId =
  | "mint_authority"
  | "freeze_authority"
  | "token2022"
  | "top10"
  | "dev_share"
  | "bundle"
  | "sell_test"
  | "liquidity"
  | "lp_lock"
  | "age"
  | "website";

export type CheckGroup = "anahtarlar" | "dagilim" | "alim_satim" | "proje";

export interface CheckResult {
  id: CheckId;
  group: CheckGroup;
  title: string;        // Örn: "Basma yetkisi"
  titleEn?: string;     // İngilizce başlık (arayüz EN modunda kullanır). Örn: "Mint authority"
  status: CheckStatus;
  points: number;       // Bu kontrolün skora eklediği risk puanı
  detail: string;       // Kısa, insan okunur açıklama. Örn: "Yetki hâlâ açık"
  detailEn?: string;    // detail'in İngilizcesi (arayüz EN modunda kullanır)
  technical?: string;   // Kısa teknik değer, arayüzde "Teknik detay" altında. Örn: "mintAuthority: null"
  raw?: unknown;        // Ham veri (hata ayıklama için, arayüzde gösterilmez)
}

export interface TokenInfo {
  address: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  website: string | null;   // Metadata veya DexScreener'dan gelen RESMİ link
  twitter: string | null;
  telegram: string | null;
  createdAt: string | null; // ISO tarih
  priceUsd: number | null;
  liquidityUsd: number | null;
}

export type RiskLevel = "dusuk" | "dikkat" | "yuksek";

/**
 * Arzın dağılımında bir satır (toplam arzın yüzdesi, 0–100). Sıra:
 * 1.–3. hesap tek tek ("wallet" ya da "pool"), 4.–10. arasındaki havuzlar ("pool"),
 * 4.–10. arasındaki cüzdanların toplamı ("wallets4to10"), geri kalan herkes ("others").
 * "pool" = likidite havuzu / program hesabı (bundle kontrolüyle aynı yöntem, lib/onchain/owners.ts).
 */
export interface HolderRow {
  kind: "wallet" | "pool" | "wallets4to10" | "others";
  rank: number | null; // wallet/pool için sıra (1–10), diğerlerinde null
  pct: number;
}

export type HolderDistribution = HolderRow[];

/** Fiyat geçmişinde bir nokta (eskiden yeniye). */
export interface PricePoint {
  t: string;        // ISO zaman
  priceUsd: number;
}

/** Resmi site analizinden bir gözlem. */
export interface WebsiteNote {
  text: string;          // Türkçe
  textEn: string | null; // İngilizce (yoksa null)
  level: "ok" | "warn";  // ok = olumlu/nötr, warn = kırmızı bayrak
}

export interface TokenReport {
  token: TokenInfo;
  score: number;            // 0–100, kural tabanlı (lib/scoring/score.ts)
  level: RiskLevel;
  checks: CheckResult[];
  positiveSignals: string[]; // Örn: "Jupiter doğrulanmış listesinde"
  holderDistribution: HolderDistribution | null; // ilk 10'un özet dağılımı; alınamazsa null
  topHolders: HolderRow[] | null;   // ilk 20 hesap tek tek (dağılım grafiği); alınamazsa null
  priceHistory: PricePoint[] | null; // son 7 gün, 4 saatlik (fiyat grafiği; GeckoTerminal); yoksa null
  websiteNotes: WebsiteNote[]; // "Web sitesinde bulunanlar" paneli; site incelenmediyse boş
  summary: string | null;    // LLM'in yazdığı özet, istenen dilde (lib/ai/report.ts)
  attestationTx: string | null; // Devnet memo işlem imzası
  analyzedAt: string;        // ISO tarih
}
