// Kontroller: ilk 10 holder payı ve geliştiricinin (oluşturanın) payı.
import { rpc } from "../http";
import type { CreatorFacts, HolderFacts } from "../facts";
import type { HolderRow } from "../types";
import { getLargestAccounts, isWalletOwner, tokenAccountOwners } from "./owners";

export async function getHolderFacts(address: string, supply: bigint): Promise<HolderFacts> {
  const res = { value: await getLargestAccounts(address) };
  if (supply === 0n) return { top10Pct: 0, largestPct: 0, distribution: [], topHolders: [] };

  const top20 = res.value.slice(0, 20); // RPC en fazla 20 hesap döndürür
  const top = top20.slice(0, 10);
  const amounts = top.map((a) => BigInt(a.amount));
  const top10 = amounts.reduce((s, a) => s + a, 0n);

  // Hangi hesaplar likidite havuzu / program? (bundle kontrolüyle aynı yöntem)
  // Okunamazsa hepsi cüzdan sayılır: panel yine dolar, sadece etiket "havuz" olmaz.
  let isPool = top20.map(() => false);
  try {
    const owners = await tokenAccountOwners(top20.map((a) => a.address));
    const known = owners.filter((o): o is string => !!o);
    const flags = await isWalletOwner(known);
    const wallet = new Map(known.map((o, i) => [o, flags[i]]));
    isPool = owners.map((o) => !!o && wallet.get(o) === false);
  } catch (e) {
    console.warn("[holders] havuz tespiti başarısız:", e instanceof Error ? e.message : e);
  }

  const rows: HolderRow[] = [];
  amounts.slice(0, 3).forEach((a, i) =>
    rows.push({ kind: isPool[i] ? "pool" : "wallet", rank: i + 1, pct: pct(a, supply) }));
  let wallets4to10 = 0n;
  amounts.slice(3).forEach((a, j) => {
    const i = j + 3;
    if (isPool[i]) rows.push({ kind: "pool", rank: i + 1, pct: pct(a, supply) });
    else wallets4to10 += a;
  });
  if (amounts.length > 3) rows.push({ kind: "wallets4to10", rank: null, pct: pct(wallets4to10, supply) });
  // "Diğer herkes" = 100 − ilk 10 (yuvarlama farkı burada toplanır, toplam tam 100 olur)
  const shown = rows.reduce((s, r) => s + r.pct, 0);
  rows.push({ kind: "others", rank: null, pct: Math.max(0, Math.round((100 - shown) * 100) / 100) });

  // İlk 20 hesap tek tek (arayüzdeki dağılım grafiği için)
  const topHolders: HolderRow[] = top20.map((a, i) => ({
    kind: isPool[i] ? "pool" : "wallet", rank: i + 1, pct: Number((BigInt(a.amount) * 1_000_000n) / supply) / 10_000, // 4 ondalık: toplamı kartla tutsun
  }));

  return {
    top10Pct: pct(top10, supply),
    largestPct: pct(amounts[0] ?? 0n, supply),
    distribution: rows,
    topHolders,
  };
}

interface Signature {
  signature: string;
  blockTime: number | null;
}

interface TxResult {
  blockTime: number | null;
  transaction: { message: { accountKeys: (string | { pubkey: string })[] } };
}

interface TokenAccountsByOwner {
  value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[];
}

/**
 * Token'ı oluşturan cüzdanı bulur: mint adresinin EN ESKİ işleminin ücretini ödeyen hesap.
 * Yeni token'larda hızlıdır. Çok eski/aktif token'larda 3 sayfadan sonra vazgeçer (null döner).
 */
export async function getCreatorFacts(address: string, supply: bigint): Promise<CreatorFacts | null> {
  let before: string | undefined;
  let oldest: Signature | undefined;

  for (let page = 0; page < 3; page++) {
    const sigs = await rpc<Signature[]>("getSignaturesForAddress", [
      address,
      { limit: 1000, ...(before ? { before } : {}) },
    ]);
    if (sigs.length === 0) {
      before = undefined; // Önceki sayfanın sonu gerçekten ilk işlemmiş.
      break;
    }
    oldest = sigs[sigs.length - 1];
    if (sigs.length < 1000) {
      before = undefined;
      break;
    }
    before = oldest.signature;
  }
  // Hâlâ devam eden sayfa varsa gerçek ilk işleme ulaşamadık.
  if (!oldest || before) return null;

  const tx = await rpc<TxResult | null>("getTransaction", [
    oldest.signature,
    { encoding: "json", maxSupportedTransactionVersion: 0 },
  ]);
  const first = tx?.transaction.message.accountKeys[0];
  if (!first) return null;
  const creator = typeof first === "string" ? first : first.pubkey;

  const accounts = await rpc<TokenAccountsByOwner>("getTokenAccountsByOwner", [
    creator,
    { mint: address },
    { encoding: "jsonParsed" },
  ]);
  const held = accounts.value.reduce(
    (s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount),
    0n,
  );

  const blockTime = tx?.blockTime ?? oldest.blockTime;
  return {
    creator,
    createdAt: blockTime ? new Date(blockTime * 1000).toISOString() : null,
    creatorPct: supply === 0n ? 0 : pct(held, supply),
  };
}

/** a / b yüzdesi, 2 ondalık hassasiyetle (bigint taşmasını önler). */
function pct(a: bigint, b: bigint): number {
  return Number((a * 10_000n) / b) / 100;
}
