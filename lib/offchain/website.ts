// Kontrol: resmi site. Firecrawl siteyi okur, Gemini sabit 3 kırmızı bayrağı işaretler.
// Puanı LLM VERMEZ: LLM sadece evet/hayır işaretler, puan score.ts'te sabittir.
import { config } from "../config";
import { fetchJson } from "../http";
import { generate } from "../ai/gemini";
import type { WebsiteFacts } from "../facts";

interface ScrapeResult {
  success?: boolean;
  data?: { markdown?: string };
}

/** Zincirden bilinen gerçekler; sitedeki iddialarla karşılaştırmak için. */
export interface ChainSummary {
  mintAuthorityOpen: boolean;
  freezeAuthorityOpen: boolean;
  lpLockedPct: number | null;
  top10Pct: number | null;
}

export async function getWebsiteFacts(url: string | null, chain: ChainSummary): Promise<WebsiteFacts> {
  if (!url) {
    return { url: null, templateText: false, unrealisticPromises: false, contradictsChain: false, notes: [] };
  }
  if (!config.firecrawlKey) throw new Error("FIRECRAWL_API_KEY eksik.");

  const scrape = await fetchJson<ScrapeResult>(
    "https://api.firecrawl.dev/v1/scrape",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.firecrawlKey}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    },
    30_000,
  );
  const markdown = (scrape.data?.markdown ?? "").slice(0, 15_000);
  if (!markdown.trim()) {
    return {
      url, templateText: false, unrealisticPromises: false, contradictsChain: false,
      notes: ["Site açılamadı ya da içeriği boş."],
    };
  }

  const prompt = `Bir kripto token projesinin web sitesini inceliyorsun.

ZİNCİRDEN BİLİNEN GERÇEKLER (kesin doğru):
- Basma yetkisi açık mı: ${chain.mintAuthorityOpen ? "EVET" : "HAYIR"}
- Dondurma yetkisi açık mı: ${chain.freezeAuthorityOpen ? "EVET" : "HAYIR"}
- Likidite kilit oranı: ${chain.lpLockedPct === null ? "bilinmiyor" : "%" + chain.lpLockedPct}
- İlk 10 cüzdanın payı: ${chain.top10Pct === null ? "bilinmiyor" : "%" + chain.top10Pct}

GÖREV: Aşağıdaki site metnine bakıp şu 3 soruyu cevapla. Sadece metinde açıkça görünen şeylere dayan, tahmin etme.
1. templateText: Metin içi boş, jenerik ya da hazır şablon gibi mi (somut ürün/ekip/plan yok)?
2. unrealisticPromises: Garanti kazanç, "100x", "kesin yükselecek" gibi gerçekçi olmayan vaatler var mı?
3. contradictsChain: Sitedeki bir iddia yukarıdaki zincir gerçekleriyle çelişiyor mu? (ör. "likidite kilitli" diyor ama kilit yok)

Yanıtı SADECE şu JSON şeklinde ver:
{"templateText": bool, "unrealisticPromises": bool, "contradictsChain": bool, "notes": ["en fazla 3 kısa Türkçe gözlem"]}

SİTE METNİ:
"""
${markdown}
"""`;

  const raw = await generate(prompt, { json: true });
  const parsed = JSON.parse(raw) as Partial<Omit<WebsiteFacts, "url">>;
  return {
    url,
    templateText: parsed.templateText === true,
    unrealisticPromises: parsed.unrealisticPromises === true,
    contradictsChain: parsed.contradictsChain === true,
    notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 3).map(String) : [],
  };
}
