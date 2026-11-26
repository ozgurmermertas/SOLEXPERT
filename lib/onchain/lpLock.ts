// Kontrol: likidite kilidi (geliştirici havuzdaki parayı çekip kaçabilir mi?).
// - pump.fun bonding curve aşamasındaki token'larda LP yoktur, çekilemez.
// - Diğerleri için kilit oranı RugCheck'in herkese açık raporundan okunur.
//   RugCheck'e ulaşılamazsa sonuç "bilinmiyor" olur.
import { fetchJson } from "../http";
import type { LpFacts } from "../facts";

interface RugcheckReport {
  markets?: { lp?: { lpLockedPct?: number } }[];
}

export async function getLpFacts(address: string, mainDexId: string | null): Promise<LpFacts> {
  if (mainDexId === "pumpfun") return { bondingCurve: true, lockedPct: null };

  const report = await fetchJson<RugcheckReport>(
    `https://api.rugcheck.xyz/v1/tokens/${address}/report`,
    {},
    8_000,
  );
  const values = (report.markets ?? [])
    .map((m) => m.lp?.lpLockedPct)
    .filter((v): v is number => typeof v === "number");

  return {
    bondingCurve: false,
    lockedPct: values.length ? Math.max(...values) : null,
  };
}
