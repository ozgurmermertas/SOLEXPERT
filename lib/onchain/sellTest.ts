// Kontrol: satılabilirlik. Jupiter'den "bu token'ı SOL'a satarsam ne olur?" teklifi istenir.
// Rota çıkmıyorsa token honeypot olabilir. (Gerçek işlem YAPILMAZ, sadece teklif alınır.)
import { config, WSOL_MINT } from "../config";
import { fetchJson, HttpError } from "../http";
import type { SellFacts } from "../facts";

interface Quote {
  outAmount?: string;
  priceImpactPct?: string;
}

export async function getSellFacts(
  address: string,
  decimals: number,
  priceUsd: number | null,
): Promise<SellFacts | null> {
  if (address === WSOL_MINT) return { routeFound: true, priceImpactPct: 0 };

  // ~10 $ değerinde satış dene; fiyat bilinmiyorsa 1000 token.
  const tokens = priceUsd && priceUsd > 0 ? Math.ceil(10 / priceUsd) : 1000;
  const amount = BigInt(tokens) * 10n ** BigInt(decimals);

  const url =
    `${config.jupiterQuoteUrl}?inputMint=${address}&outputMint=${WSOL_MINT}` +
    `&amount=${amount}&slippageBps=1500`;

  try {
    const q = await fetchJson<Quote>(url);
    const found = !!q.outAmount && q.outAmount !== "0";
    return {
      routeFound: found,
      priceImpactPct: q.priceImpactPct ? Number(q.priceImpactPct) * 100 : null,
    };
  } catch (e) {
    // Jupiter rota bulamayınca 400 döner: bu bir SONUÇTUR, hata değil.
    if (e instanceof HttpError && e.status === 400 && /ROUTE|route/.test(e.message)) {
      return { routeFound: false, priceImpactPct: null };
    }
    throw e;
  }
}
