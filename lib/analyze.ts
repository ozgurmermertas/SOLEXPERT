// ANA AKIŞ: adres → zincir kontrolleri → site analizi → skor → AI özeti → TokenReport
import { getMintFacts } from "./onchain/mint";
import { getMetadataFacts } from "./onchain/metadata";
import { getCreatorFacts, getHolderFacts } from "./onchain/holders";
import { getBundleFacts } from "./onchain/bundle";
import { getMarketFacts } from "./onchain/market";
import { getSellFacts } from "./onchain/sellTest";
import { getLpFacts } from "./onchain/lpLock";
import { getWebsiteFacts } from "./offchain/website";
import { aiEnabled } from "./ai/gemini";
import { writeSummary } from "./ai/report";
import { buildChecks, computeScore, positiveSignals } from "./scoring/score";
import type { Facts } from "./facts";
import type { TokenReport } from "./types";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export class InvalidAddressError extends Error {}

export interface AnalyzeOptions {
  /** false: site analizi ve AI özeti atlanır (hızlı test için). */
  withAi?: boolean;
  /** AI özetinin dili. Kontrol metinleri şimdilik sadece Türkçe. */
  lang?: "tr" | "en";
}

// ---- Bellek içi önbellek: aynı token 10 dk içinde tekrar sorulursa analiz tekrarlanmaz ----
// Sunucu süreci yeniden başlarsa (ör. yeni deploy) boşalır. Kalıcı cache için TODO: Supabase.
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; report: Promise<TokenReport> }>();

export async function analyzeToken(rawAddress: string, opts: AnalyzeOptions = {}): Promise<TokenReport> {
  const address = rawAddress.trim();
  if (!BASE58.test(address)) throw new InvalidAddressError("Geçersiz Solana adresi.");
  const withAi = (opts.withAi ?? true) && aiEnabled();
  const lang = opts.lang ?? "tr";

  const key = `${address}|${withAi ? "ai" : "noai"}|${lang}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.report; // devam eden analiz de paylaşılır

  for (const [k, v] of cache) if (now - v.at >= CACHE_TTL_MS) cache.delete(k);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);

  const report = runAnalysis(address, withAi, lang);
  cache.set(key, { at: now, report });
  report.catch(() => { if (cache.get(key)?.report === report) cache.delete(key); }); // hata önbelleğe alınmaz
  return report;
}

async function runAnalysis(address: string, withAi: boolean, lang: "tr" | "en"): Promise<TokenReport> {

  // 1) Mint bilgisi şart: token değilse burada durur.
  const mint = await getMintFacts(address);

  // 2) Birbirinden bağımsız kontroller paralel çalışır; biri çökerse diğerleri devam eder.
  const [metadata, holders, creator, bundle, market] = await Promise.all([
    safe("metadata", getMetadataFacts(address)),
    safe("holders", getHolderFacts(address, mint.supply)),
    safe("creator", getCreatorFacts(address, mint.supply)),
    safe("bundle", getBundleFacts(address, mint.supply)), // en fazla 12 sn, aşarsa null → "bilinmiyor"
    safe("market", getMarketFacts(address)),
  ]);

  // 3) Fiyat ve DEX bilgisine ihtiyaç duyanlar.
  const [sell, lp] = await Promise.all([
    safe("sell", getSellFacts(address, mint.decimals, market?.priceUsd ?? null)),
    safe("lp", getLpFacts(address, market?.mainDexId ?? null)),
  ]);

  // 4) Resmi site: önce token metadata'sındaki link, yoksa DexScreener'daki.
  const websiteUrl = metadata?.website ?? market?.website ?? null;
  const website = withAi
    ? await safe("website", getWebsiteFacts(websiteUrl, {
        mintAuthorityOpen: !!mint.mintAuthority,
        freezeAuthorityOpen: !!mint.freezeAuthority,
        lpLockedPct: lp?.lockedPct ?? null,
        top10Pct: holders?.top10Pct ?? null,
      }))
    : null;

  const facts: Facts = { address, mint, metadata, holders, creator, bundle, market, sell, lp, website };

  // 5) Kural tabanlı skor.
  const checks = buildChecks(facts);
  const { score, level } = computeScore(checks);

  const report: Omit<TokenReport, "summary"> = {
    token: {
      address,
      name: metadata?.name ?? null,
      symbol: metadata?.symbol ?? null,
      imageUrl: metadata?.imageUrl ?? null,
      website: websiteUrl,
      twitter: metadata?.twitter ?? market?.twitter ?? null,
      telegram: metadata?.telegram ?? market?.telegram ?? null,
      createdAt: creator?.createdAt ?? market?.pairCreatedAt ?? null,
      priceUsd: market?.priceUsd ?? null,
      liquidityUsd: market?.liquidityUsd ?? null,
    },
    score,
    level,
    checks,
    positiveSignals: positiveSignals(facts),
    attestationTx: null, // TODO (hackathon): rapor hash'ini devnet'e memo olarak yaz.
    analyzedAt: new Date().toISOString(),
  };

  // 6) AI özeti (başarısız olursa rapor yine döner).
  const summary = withAi ? await safe("summary", writeSummary(report, lang)) : null;
  return { ...report, summary };
}

/** Bir kontrol hata verirse null döner ve sunucu loguna yazar. */
async function safe<T>(name: string, p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    console.warn(`[analyze] ${name} başarısız:`, e instanceof Error ? e.message : e);
    return null;
  }
}
