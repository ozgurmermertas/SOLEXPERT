// Kontrol modüllerinin topladığı HAM gerçekler.
// Puanlama bu gerçeklerden lib/scoring/score.ts içinde yapılır.

export interface Token2022Flags {
  transferFeeBps: number;          // 0 = vergi yok
  permanentDelegate: string | null; // null = yok
  transferHook: string | null;      // null = yok
  nonTransferable: boolean;
  defaultFrozen: boolean;
}

export interface MintFacts {
  isToken2022: boolean;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: bigint;
  decimals: number;
  token2022: Token2022Flags | null; // sadece Token-2022 için
}

export interface MetadataFacts {
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

export interface HolderFacts {
  top10Pct: number;   // 0–100
  largestPct: number; // en büyük tek hesap
}

export interface CreatorFacts {
  creator: string;
  createdAt: string | null; // ISO
  creatorPct: number;       // 0–100
}

export interface MarketFacts {
  priceUsd: number | null;
  liquidityUsd: number;      // tüm Solana havuzlarının toplamı
  pairCreatedAt: string | null;
  mainDexId: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

export interface SellFacts {
  routeFound: boolean;
  priceImpactPct: number | null;
}

export interface LpFacts {
  bondingCurve: boolean;     // pump.fun eğrisinde: LP çekilemez
  lockedPct: number | null;  // 0–100, bilinmiyorsa null
}

export interface WebsiteFacts {
  url: string | null;
  templateText: boolean;      // jenerik/şablon metin
  unrealisticPromises: boolean; // "garanti 100x" vb.
  contradictsChain: boolean;  // sitedeki iddia zincirle çelişiyor
  notes: string[];            // kısa Türkçe gözlemler
}

/** Her alan null olabilir: o kontrol başarısız olduysa "bilinmiyor" sayılır. */
export interface Facts {
  address: string;
  mint: MintFacts;
  metadata: MetadataFacts | null;
  holders: HolderFacts | null;
  creator: CreatorFacts | null;
  market: MarketFacts | null;
  sell: SellFacts | null;
  lp: LpFacts | null;
  website: WebsiteFacts | null;
}
