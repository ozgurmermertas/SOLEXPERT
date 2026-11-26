// Kontroller: ilk 10 holder payı ve geliştiricinin (oluşturanın) payı.
import { rpc } from "../http";
import type { CreatorFacts, HolderFacts } from "../facts";

interface LargestAccounts {
  value: { address: string; amount: string }[];
}

export async function getHolderFacts(address: string, supply: bigint): Promise<HolderFacts> {
  const res = await rpc<LargestAccounts>("getTokenLargestAccounts", [address]);
  if (supply === 0n) return { top10Pct: 0, largestPct: 0 };

  const amounts = res.value.map((a) => BigInt(a.amount));
  const top10 = amounts.slice(0, 10).reduce((s, a) => s + a, 0n);
  // Not: listede likidite havuzunun hesabı da olabilir; detay metninde belirtilir.
  return {
    top10Pct: pct(top10, supply),
    largestPct: pct(amounts[0] ?? 0n, supply),
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
