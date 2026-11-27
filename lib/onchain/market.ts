// Kontroller: likidite, token yaşı. Ayrıca DexScreener'daki resmi linkler.
// DexScreener API anahtar gerektirmez.
import { fetchJson } from "../http";
import { normalizeUrl } from "./metadata";
import type { MarketFacts } from "../facts";

interface Pair {
  chainId: string;
  dexId: string;
  pairAddress?: string;
  baseToken: { address: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  info?: {
    websites?: { url: string }[];
    socials?: { type: string; url: string }[];
  };
}

export async function getMarketFacts(address: string): Promise<MarketFacts | null> {
  const res = await fetchJson<{ pairs: Pair[] | null }>(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`,
  );
  const pairs = (res.pairs ?? []).filter(
    (p) => p.chainId === "solana" && p.baseToken.address === address,
  );
  if (pairs.length === 0) return null; // Hiçbir DEX'te işlem görmüyor.

  const main = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const firstCreated = Math.min(...pairs.map((p) => p.pairCreatedAt ?? Infinity));
  const withInfo = pairs.find((p) => p.info) ?? main;
  const social = (type: string) =>
    normalizeUrl(withInfo.info?.socials?.find((s) => s.type === type)?.url);

  return {
    priceUsd: main.priceUsd ? Number(main.priceUsd) : null,
    liquidityUsd: pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0),
    // Ana havuzun piyasa değeri; yoksa tam seyreltilmiş değer (FDV). Sadece gösterge, puanı etkilemez.
    marketCapUsd: positive(main.marketCap) ?? positive(main.fdv) ?? null,
    pairCreatedAt: Number.isFinite(firstCreated) ? new Date(firstCreated).toISOString() : null,
    mainDexId: main.dexId,
    mainPairAddress: main.pairAddress ?? null,
    website: normalizeUrl(withInfo.info?.websites?.[0]?.url),
    twitter: social("twitter"),
    telegram: social("telegram"),
  };
}

const positive = (n: number | undefined): number | undefined =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
