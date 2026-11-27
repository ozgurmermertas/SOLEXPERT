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

export interface TokenReport {
  token: TokenInfo;
  score: number;            // 0–100, kural tabanlı (lib/scoring/score.ts)
  level: RiskLevel;
  checks: CheckResult[];
  positiveSignals: string[]; // Örn: "Jupiter doğrulanmış listesinde"
  summary: string | null;    // LLM'in yazdığı Türkçe özet (lib/ai/report.ts)
  attestationTx: string | null; // Devnet memo işlem imzası
  analyzedAt: string;        // ISO tarih
}
