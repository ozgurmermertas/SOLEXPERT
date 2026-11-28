// ANA AKIŞ: adres → zincir kontrolleri → site analizi → skor → AI özeti → TokenReport
import { getMintFacts } from "./onchain/mint";
import { getMetadataFacts } from "./onchain/metadata";
import { getCreatorFacts, getHolderFacts } from "./onchain/holders";
import { getBundleFacts } from "./onchain/bundle";
import { isTooManyAccountsError } from "./onchain/owners";
import { getMarketFacts } from "./onchain/market";
import { getSellFacts } from "./onchain/sellTest";
import { getLpFacts } from "./onchain/lpLock";
import { getPriceHistory } from "./onchain/priceHistory";
import { getWebsiteFacts } from "./offchain/website";
import { aiEnabled } from "./ai/gemini";
import { writeSummary } from "./ai/report";
import { buildChecks, computeScore, DATA_GAP_NOTE, positiveSignals, websiteNotes } from "./scoring/score";
import type { Facts } from "./facts";
import type { TokenReport } from "./types";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export class InvalidAddressError extends Error {}

export interface AnalyzeOptions {
  /** false: site analizi ve AI özeti atlanır (hızlı test için). */
  withAi?: boolean;
  /** AI özetinin dili. Kontrol metinleri her zaman iki dilde gelir (detail / detailEn). */
  lang?: "tr" | "en";
}

// ---- Bellek içi önbellek: aynı token 10 dk içinde tekrar sorulursa analiz tekrarlanmaz ----
// İki katman: zincir + site analizi (dilden bağımsız) ve AI özeti (dile göre).
// Böylece arayüzde dil değişince sadece özet yeniden yazılır (birkaç saniye).
// Sunucu süreci yeniden başlarsa (ör. yeni deploy) boşalır. Kalıcı cache için TODO: Supabase.
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;
type Base = Omit<TokenReport, "summary">;
const baseCache = new Map<string, { at: number; value: Promise<Base> }>();
const summaryCache = new Map<string, { at: number; value: Promise<string | null> }>();

/** Önbellekten al ya da üret; devam eden iş de paylaşılır, hata önbelleğe alınmaz. */
function cached<T>(map: Map<string, { at: number; value: Promise<T> }>, key: string, make: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = map.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
  for (const [k, v] of map) if (now - v.at >= CACHE_TTL_MS) map.delete(k);
  if (map.size >= CACHE_MAX) map.delete(map.keys().next().value!);
  const value = make();
  map.set(key, { at: now, value });
  value.catch(() => { if (map.get(key)?.value === value) map.delete(key); });
  return value;
}

export async function analyzeToken(rawAddress: string, opts: AnalyzeOptions = {}): Promise<TokenReport> {
  const address = rawAddress.trim();
  if (!BASE58.test(address)) throw new InvalidAddressError("Geçersiz Solana adresi.");
  const withAi = (opts.withAi ?? true) && aiEnabled();
  const lang = opts.lang ?? "tr";

  const baseKey = `${address}|${withAi ? "ai" : "noai"}`;
  const base = await cached(baseCache, baseKey, () => runAnalysis(address, withAi));
  // 6) AI özeti, istenen dilde (başarısız olursa rapor yine döner).
  const aiSummary = withAi
    ? await cached(summaryCache, `${baseKey}|${lang}`, () => safe("summary", writeSummary(base, lang)))
    : null;
  // Seviye sadece eksik veri yüzünden "dikkat"e çıktıysa özet bunu açıkça söyler (AI kapalıyken de).
  const note = computeScore(base.checks, base.token).dataGap ? DATA_GAP_NOTE[lang] : null;
  const summary = note ? (aiSummary ? `${note} ${aiSummary}` : note) : aiSummary;
  return { ...base, summary };
}

async function runAnalysis(address: string, withAi: boolean): Promise<Base> {

  // 1) Mint bilgisi şart: token değilse burada durur.
  const mint = await getMintFacts(address);

  // 2) Birbirinden bağımsız kontroller paralel çalışır; biri çökerse diğerleri devam eder.
  let holdersTooMany = false;
  const [metadata, holders, creator, bundle, market] = await Promise.all([
    safe("metadata", getMetadataFacts(address)),
    safe("holders", getHolderFacts(address, mint.supply).catch((e) => {
      if (isTooManyAccountsError(e)) holdersTooMany = true;
      throw e;
    })),
    safe("creator", getCreatorFacts(address, mint.supply)),
    safe("bundle", getBundleFacts(address, mint.supply)), // en fazla 12 sn, aşarsa null → "bilinmiyor"
    safe("market", getMarketFacts(address)),
  ]);

  // 3) Fiyat ve DEX bilgisine ihtiyaç duyanlar.
  const [sell, lp, priceHistory] = await Promise.all([
    safe("sell", getSellFacts(address, mint.decimals, market?.priceUsd ?? null)),
    safe("lp", getLpFacts(address, market?.mainDexId ?? null)),
    safe("priceHistory", getPriceHistory(market?.mainPairAddress ?? null)), // sadece grafik, puanı etkilemez
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

  const facts: Facts = { address, mint, metadata, holders, holdersTooMany, creator, bundle, market, sell, lp, website };

  // 5) Kural tabanlı skor.
  const checks = buildChecks(facts);

  const token: Base["token"] = {
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
  };
  const { score, level } = computeScore(checks, token);

  const report: Base = {
    token,
    score,
    level,
    checks,
    positiveSignals: positiveSignals(facts),
    holderDistribution: holders?.distribution ?? null,
    topHolders: holders?.topHolders ?? null,
    priceHistory: priceHistory ?? null,
    websiteNotes: websiteNotes(facts),
    attestationTx: null, // TODO (hackathon): rapor hash'ini devnet'e memo olarak yaz.
    analyzedAt: new Date().toISOString(),
  };
  return report;
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
