// Kontrol: bağlantılı cüzdanlar ("bundle").
// En büyük holder cüzdanlarının ilk işlemine bakar; aynı kaynaktan fonlanan cüzdanları gruplar.
// 2 adımlı iz: doğrudan aynı kaynaktan ya da ara cüzdanlar üzerinden aynı kaynaktan fonlananlar.
// 1000+ işlemli (borsa/bot olabilecek) kaynaklar sadece ilk işlemleri ≤ 1 saat arayla olan
// cüzdanları bağlar (alakasız borsa kullanıcıları gruplanmasın).
// Bir ekibin arzı birçok cüzdana bölüp "dağılım iyi" görüntüsü vermesini yakalamaya çalışır.
//
// Sınırlar: en büyük 12 hesap, aynı anda en fazla 3 RPC isteği (Helius 429'unu azaltır), en fazla 12 sn.
// Süre dolunca: o ana kadar incelenen cüzdanlarda "tehlikeli" bir grup bulunduysa kısmi sonuç
// döner (partial: true); bulunmadıysa hata fırlatır → analyze.ts'te null → kontrol "bilinmiyor".
import { rpc } from "../http";
import type { BundleFacts, BundleGroup } from "../facts";

const TOP_N = 12;
const CONCURRENCY = 3;
const DEADLINE_MS = 12_000;
const MAX_SIGNATURES = 1000; // bu kadar (veya fazla) işlemi olan cüzdan atlanır
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const WEAK_WINDOW_SEC = 3600; // çok aktif bir kaynak, ilk işlemleri ≤ 1 saat arayla olan cüzdanları bağlar

/** Skorlamadaki "tehlikeli" eşiği ile aynı (kısmi sonuç sadece bu durumda kullanılır). */
export const isDangerousGroup = (g: BundleGroup) => g.wallets.length >= 3 || g.pct > 15;

interface FirstTx {
  funder: string | null;
  time: number | null; // unix saniye
}

interface Link {
  strong: string[]; // normal kaynaklar (1. ve 2. adım)
  weak: string[];   // çok aktif kaynaklar: sadece zamanca yakın cüzdanları bağlar
  time: number | null; // cüzdanın ilk işlem zamanı
}

/** Kontrol sürerken doldurulan durum: süre dolunca kısmi sonuç buradan hesaplanır. */
interface State {
  supply: bigint;
  wallets: string[];
  held: Map<string, bigint>;
  links: (Link | undefined)[]; // undefined = bu cüzdan henüz bitmedi
  skipped: number;
}

export class BundleTimeoutError extends Error {}

interface LargestAccounts {
  value: { address: string; amount: string }[];
}

interface AccountInfo {
  owner: string;
  executable: boolean;
  lamports: number;
  data: unknown;
}

interface Signature {
  signature: string;
  err: unknown;
  blockTime?: number | null;
}

interface ParsedIx {
  program?: string;
  programId?: string;
  parsed?: { type?: string; info?: Record<string, unknown> };
}

interface ParsedTx {
  blockTime?: number | null;
  meta: {
    preBalances: number[];
    postBalances: number[];
    innerInstructions?: { instructions: ParsedIx[] }[];
  } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string }[];
      instructions: ParsedIx[];
    };
  };
}

export async function getBundleFacts(mint: string, supply: bigint): Promise<BundleFacts> {
  const deadline = Date.now() + DEADLINE_MS;
  const state: State = { supply, wallets: [], held: new Map(), links: [], skipped: 0 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const TIMEOUT = Symbol("timeout");
  const timeout = new Promise<typeof TIMEOUT>((resolve) => { timer = setTimeout(() => resolve(TIMEOUT), DEADLINE_MS); });
  try {
    const result = await Promise.race([run(mint, state, deadline), timeout]);
    if (result !== TIMEOUT) return result;
    // Süre doldu: bitmiş cüzdanlarla grupla; tehlikeli grup varsa kısmi sonucu kullan.
    const done = state.links.filter(Boolean).length;
    const facts = summarize(state);
    if (facts.groups.some(isDangerousGroup)) {
      return { ...facts, walletsChecked: Math.max(0, done - state.skipped), partial: true };
    }
    throw new BundleTimeoutError("bundle: 12 sn içinde tamamlanamadı");
  } finally {
    clearTimeout(timer);
  }
}

async function run(mint: string, state: State, deadline: number): Promise<BundleFacts> {
  const call = <T>(method: string, params: unknown) => {
    // Süre dolduysa yeni istek açma (yarış zaten bitti).
    if (Date.now() > deadline) throw new BundleTimeoutError("bundle: süre doldu");
    return rpc<T>(method, params);
  };
  const { supply } = state;

  // 1) En büyük 12 token hesabı
  const largest = await call<LargestAccounts>("getTokenLargestAccounts", [mint]);
  const top = largest.value.slice(0, TOP_N).filter((a) => a.amount !== "0");
  if (top.length === 0 || supply === 0n) return { walletsChecked: 0, skipped: 0, groups: [] };

  // 2) Token hesaplarının sahipleri
  const tokenAccs = await call<{ value: (AccountInfo | null)[] }>("getMultipleAccounts", [
    top.map((a) => a.address),
    { encoding: "jsonParsed" },
  ]);
  const held = state.held; // sahip → toplam miktar
  tokenAccs.value.forEach((acc, i) => {
    const owner = (acc?.data as { parsed?: { info?: { owner?: string } } } | undefined)?.parsed?.info?.owner;
    if (!owner) return;
    held.set(owner, (held.get(owner) ?? 0n) + BigInt(top[i].amount));
  });
  const owners = [...held.keys()];
  if (owners.length === 0) return { walletsChecked: 0, skipped: 0, groups: [] };

  // 3) Likidite havuzu / program hesaplarını çıkar:
  //    gerçek cüzdan = System Program'a ait, çalıştırılabilir olmayan, var olan hesap.
  //    Havuz kasalarının sahibi PDA'dır: ya zincirde hesabı yoktur ya da bir programa aittir.
  const ownerAccs = await call<{ value: (AccountInfo | null)[] }>("getMultipleAccounts", [
    owners,
    { encoding: "base64", dataSlice: { offset: 0, length: 0 } },
  ]);
  const wallets = owners.filter((_, i) => {
    const a = ownerAccs.value[i];
    return !!a && a.owner === SYSTEM_PROGRAM && !a.executable;
  });
  state.wallets = wallets;
  state.links = new Array(wallets.length).fill(undefined);

  // Adres başına "ilk işlem" sonucu önbelleklenir: aynı ara cüzdan/kaynak birden çok holder için
  // tekrar sorgulanmaz.  undefined → çok aktif (1000+ işlem)  ·  null → işlem yok / okunamadı
  const firstCache = new Map<string, Promise<FirstTx | null | undefined>>();
  const first = (addr: string) => {
    let p = firstCache.get(addr);
    if (!p) {
      p = (async () => {
        const sigs = await call<Signature[]>("getSignaturesForAddress", [addr, { limit: MAX_SIGNATURES }]);
        if (sigs.length >= MAX_SIGNATURES) return undefined;
        const oldest = sigs[sigs.length - 1];
        if (!oldest) return null;
        const tx = await call<ParsedTx | null>("getTransaction", [
          oldest.signature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ]);
        return tx ? { funder: findFunder(tx, addr), time: tx.blockTime ?? oldest.blockTime ?? null } : null;
      })();
      firstCache.set(addr, p);
    }
    return p;
  };

  // 4) 2 adımlı iz (aynı anda en fazla 3 istek):
  //    cüzdan → 1. adım: ilk işleminde ona SOL gönderen (yoksa işlemi ödeyen)
  //           → 2. adım: 1. adımın kendi ilk işlemindeki fonlayanı
  //    Ara cüzdan kullanılarak dağıtılan arzı da yakalar.
  //    "Zayıf kaynak" = çok aktif 1. adım (1000+ işlem: borsa, bot, dağıtıcı) ve her 2. adım
  //    (bir ara cüzdan + borsa çekimi sıradan kullanıcılarda da olur). Zayıf kaynak sadece
  //    ilk işlemleri birbirine 1 saat içinde olan cüzdanları bağlar.
  await pool(wallets.map((w, i) => [w, i] as const), CONCURRENCY, async ([wallet, i]) => {
    const none: Link = { strong: [], weak: [], time: null };
    try {
      const w = await first(wallet);
      if (w === undefined) { state.skipped++; state.links[i] = none; return; } // çok aktif cüzdan
      if (!w || !w.funder) { state.links[i] = none; return; }
      const hop1 = w.funder;
      const link: Link = { strong: [], weak: [], time: w.time };
      const h = await first(hop1);
      if (h === undefined) link.weak.push(hop1); // 1. adım çok aktif
      else {
        link.strong.push(hop1);
        const hop2 = h?.funder;
        if (hop2 && hop2 !== wallet) link.weak.push(hop2);
      }
      state.links[i] = link;
    } catch (e) {
      if (e instanceof BundleTimeoutError) throw e;
      state.skipped++; // tek cüzdanın hatası tüm kontrolü düşürmesin
      state.links[i] = none;
    }
  });

  return summarize(state);
}

/** 5) Ortak kaynağı paylaşan cüzdanları birleştir (union-find). Bitmemiş cüzdanlar yok sayılır. */
function summarize(state: State): BundleFacts {
  const { wallets, held, supply } = state;
  const links = state.links.map((l) => l ?? { strong: [], weak: [], time: null });
  const parent = wallets.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => { parent[find(i)] = find(j); };
  const sourceCount = new Map<string, number>();
  const strongBy = new Map<string, number[]>();
  const weakBy = new Map<string, number[]>();
  links.forEach((l, i) => {
    for (const s of l.strong) strongBy.set(s, [...(strongBy.get(s) ?? []), i]);
    for (const s of l.weak) weakBy.set(s, [...(weakBy.get(s) ?? []), i]);
  });
  for (const [s, idx] of strongBy) {
    sourceCount.set(s, idx.length);
    idx.slice(1).forEach((i) => union(i, idx[0]));
  }
  for (const [s, idx] of weakBy) {
    // Zaman sırasına diz; ardışık ilk işlemler arası ≤ 1 saat ise bağla.
    const timed = idx.filter((i) => links[i].time !== null).sort((a, b) => links[a].time! - links[b].time!);
    let joined = 0;
    for (let k = 1; k < timed.length; k++) {
      if (links[timed[k]].time! - links[timed[k - 1]].time! <= WEAK_WINDOW_SEC) { union(timed[k], timed[k - 1]); joined++; }
    }
    if (joined) sourceCount.set(s, joined + 1);
  }

  const components = new Map<number, number[]>();
  wallets.forEach((_, i) => {
    const r = find(i);
    components.set(r, [...(components.get(r) ?? []), i]);
  });
  const groups: BundleGroup[] = [...components.values()]
    .filter((idx) => idx.length >= 2)
    .map((idx) => {
      // Grubu en çok cüzdanın paylaştığı kaynakla etiketle
      const funder = [...new Set(idx.flatMap((i) => [...links[i].strong, ...links[i].weak]))]
        .sort((a, b) => (sourceCount.get(b) ?? 0) - (sourceCount.get(a) ?? 0))[0];
      const ws = idx.map((i) => wallets[i]);
      return { funder, wallets: ws, pct: pct(ws.reduce((s, w) => s + (held.get(w) ?? 0n), 0n), supply) };
    })
    .sort((a, b) => b.wallets.length - a.wallets.length || b.pct - a.pct);

  return { walletsChecked: wallets.length - state.skipped, skipped: state.skipped, groups };
}

/**
 * O işlemde cüzdana SOL gönderen hesap. Önce sistem transfer talimatlarına, yoksa bakiye farkına bakar;
 * ikisi de yoksa işlemi ödeyen hesabı (cüzdanın kendisi değilse) döndürür.
 */
function findFunder(tx: ParsedTx, wallet: string): string | null {
  const ixs = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions ?? []).flatMap((x) => x.instructions),
  ];
  for (const ix of ixs) {
    if (ix.program !== "system" || !ix.parsed?.info) continue;
    const info = ix.parsed.info;
    const type = ix.parsed.type ?? "";
    const to = (info.destination ?? info.newAccount) as string | undefined;
    const from = info.source as string | undefined;
    if (to === wallet && from && from !== wallet && /transfer|createAccount/i.test(type)) return from;
  }

  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
  // Son çare: cüzdan bu işlemi kendisi ödemediyse ödeyen hesap (ör. başkası cüzdanın token
  // hesabını açıp ona token göndermiş). Arzı birçok cüzdana dağıtan ekiplerin tipik deseni.
  const payer = keys[0] && keys[0] !== wallet ? keys[0] : null;

  // Yedek: cüzdanın SOL'u arttıysa, en çok SOL kaybeden diğer hesap fonlayandır.
  const meta = tx.meta;
  if (!meta) return payer;
  const wi = keys.indexOf(wallet);
  if (wi < 0 || meta.postBalances[wi] <= meta.preBalances[wi]) return payer;
  let best: string | null = null;
  let bestDrop = 0;
  keys.forEach((k, i) => {
    if (i === wi) return;
    const drop = meta.preBalances[i] - meta.postBalances[i];
    if (drop > bestDrop) { bestDrop = drop; best = k; }
  });
  return best ?? payer;
}

/** Eş zamanlı en fazla `limit` iş çalıştırır; sonuçları girdi sırasıyla döndürür. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function pct(a: bigint, b: bigint): number {
  return Number((a * 10_000n) / b) / 100;
}
