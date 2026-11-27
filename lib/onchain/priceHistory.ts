// Fiyat geçmişi: en derin havuzun son 7 günü, 4 saatlik mumların kapanış fiyatı.
// Kaynak: GeckoTerminal (anahtarsız, dakikada ~30 istek). Arayüzdeki fiyat grafiğini doldurur.
// Puanlamada KULLANILMAZ: sadece gösterim içindir. Alınamazsa null → grafik gizlenir.
import { fetchJson } from "../http";
import type { PricePoint } from "../types";

interface Ohlcv {
  data?: { attributes?: { ohlcv_list?: [number, number, number, number, number, number][] } };
}

const CANDLE_HOURS = 4;
const CANDLES = (7 * 24) / CANDLE_HOURS; // 42 nokta = 7 gün

export async function getPriceHistory(pairAddress: string | null): Promise<PricePoint[] | null> {
  if (!pairAddress) return null;
  const res = await fetchJson<Ohlcv>(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pairAddress}/ohlcv/hour` +
      `?aggregate=${CANDLE_HOURS}&limit=${CANDLES}&currency=usd`,
    { headers: { Accept: "application/json" } },
    8_000,
  );
  const list = res.data?.attributes?.ohlcv_list ?? [];
  // [zaman(sn), açılış, yüksek, düşük, kapanış, hacim] — en yeni önce gelir; eskiden yeniye çevir.
  // İşlem olmayan saatler için mum gelmez: az işlem gören token'da liste 7 günden geriye taşar,
  // bu yüzden sadece son 7 gün tutulur.
  const since = Date.now() / 1000 - 7 * 24 * 3600;
  const points = list
    .filter((c) => Number.isFinite(c[0]) && c[0] >= since && Number.isFinite(c[4]) && c[4] > 0)
    .map((c) => ({ t: new Date(c[0] * 1000).toISOString(), priceUsd: c[4] }))
    .sort((a, b) => a.t.localeCompare(b.t));
  return points.length >= 2 ? points : null;
}
