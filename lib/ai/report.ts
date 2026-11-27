// LLM sadece AÇIKLAMA yazar: skoru ve bulguları değiştirmez, yeni bulgu uydurmaz.
// Kurallar:
// - Özet hiçbir zaman "güvenli" / "safe" demez. Düşük risk bir garanti değildir.
// - Tehlikeli bulgu varsa önce riskleri söyler; "belirgin risk bulunamadı" demez.
import { generate } from "./gemini";
import type { TokenReport } from "../types";

type Lang = "tr" | "en";
type Report = Omit<TokenReport, "summary">;

// "güvenli", "güvenlidir", "güvenle"… ama "güvenlik"/"güvenliği" (security) serbest.
const BANNED: Record<Lang, RegExp> = {
  tr: /güven(li(?![kğ])|le\b|ilir)/iu,
  en: /\b(safe|safely|safest|safer)\b/i,
};

// Tehlikeli bulgu varken kullanılmaması gereken "risk yok" ifadeleri.
const NO_RISK: Record<Lang, RegExp> = {
  tr: /(belirgin|önemli|ciddi|kayda değer)\s+(bir\s+)?risk\s+(bulunamadı|bulunmadı|yok|görülmedi|tespit edilmedi)|risk\s+bulunamadı/iu,
  en: /\bno\s+(notable|significant|major|obvious|clear)?\s*risks?\b|found no (notable|significant)?\s*risks?/i,
};

const hasDanger = (r: Report) => r.checks.some((c) => c.status === "tehlikeli");

/** Özetteki kural ihlali olan cümleler için test. */
function violates(text: string, r: Report, lang: Lang): boolean {
  return BANNED[lang].test(text) || (hasDanger(r) && NO_RISK[lang].test(text));
}

export async function writeSummary(r: Report, lang: Lang = "tr"): Promise<string | null> {
  const prompt = buildPrompt(r, lang);
  let text = (await generate(prompt, { temperature: 0 })).trim();
  if (!violates(text, r, lang)) return text;

  // Kural ihlali varsa bir kez daha, daha sert uyarıyla dene.
  const retry = prompt + (lang === "tr"
    ? `\n\nÖNEMLİ: Önceki denemen kurallara uymadı. "güvenli" kelimesini ve türevlerini ASLA kullanma.` +
      (hasDanger(r) ? ` Tehlikeli bulgular var: "belirgin bir risk bulunamadı" gibi bir ifade ASLA kullanma, önce riskleri söyle.` : "")
    : `\n\nIMPORTANT: Your previous attempt broke the rules. NEVER use "safe" or any of its forms.` +
      (hasDanger(r) ? ` There are dangerous findings: NEVER say "no notable risk" or similar; state the risks first.` : ""));
  text = (await generate(retry, { temperature: 0 })).trim();
  if (!violates(text, r, lang)) return text;

  // Son çare: kural ihlali olan cümleleri çıkar.
  const kept = (text.match(/[^.!?]+[.!?]*/g) ?? [text]).filter((s) => !violates(s, r, lang));
  const cleaned = kept.join("").trim();
  return cleaned || null;
}

function buildPrompt(r: Report, lang: Lang): string {
  // Bulgular özetin dilinde verilir: model kontrol adlarını çevirmeden, birebir kullanabilsin.
  // (Olumlu sinyaller ayrıca verilmez: bulguların tekrarıdır ve farklı kelimelere yol açıyordu.)
  const danger = hasDanger(r);

  if (lang === "en") {
    const status = { gecti: "passed", dikkat: "caution", tehlikeli: "dangerous", bilinmiyor: "unknown" } as const;
    const findings = r.checks
      .map((c) => `- [${status[c.status]}] ${c.titleEn ?? c.title}: ${c.detailEn ?? c.detail}`)
      .join("\n");
    const level = r.level === "yuksek" ? "high risk" : r.level === "dikkat" ? "caution" : "low risk";
    const toneRule = danger
      ? `- There are [dangerous] findings: state the risk level, then name the dangerous findings FIRST.
  NEVER say "no notable risk", "no significant risk" or anything similar.`
      : r.level === "dusuk"
        ? `- The risk is low: say something like "the basic checks found no notable risk, but this is not a guarantee".`
        : `- State the risk level first, then the most important 1-2 reasons.`;
    return `A risk analysis was run on a Solana token. Summarise the findings for an ordinary user
in plain English, in 2-3 short sentences (at most 40 words).

Token: ${r.token.name ?? "Unnamed"} (${r.token.symbol ?? "?"})
Risk score: ${r.score}/100 (${level})

Findings (format: [status] Check name: detail):
${findings}

Rules:
- Use ONLY the findings above, add no new information.
- When you mention a check, use its check name EXACTLY as written above (the text before the colon).
  Do not use synonyms or any other term for it (e.g. say "Freeze authority", never "freezing controls").
${toneRule}
- Mention "unknown" checks only if they matter, in a few words.
- NEVER use the word "safe" (or "safely", "safer", "safest"), not even in a negative sentence.
- Give no buy/sell advice. Plain text, no bullet points or headings.`;
  }

  const findings = r.checks.map((c) => `- [${c.status}] ${c.title}: ${c.detail}`).join("\n");
  const level = r.level === "yuksek" ? "yüksek risk" : r.level === "dikkat" ? "dikkat" : "düşük risk";
  const toneRule = danger
    ? `- [tehlikeli] bulgular var: risk seviyesini söyle, sonra ÖNCE tehlikeli bulguları say.
  "belirgin bir risk bulunamadı", "önemli bir risk yok" gibi bir ifade ASLA kullanma.`
    : r.level === "dusuk"
      ? `- Risk düşük: şöyle bir ifade kullan: "temel kontrollerde belirgin bir risk bulunamadı, ama bu bir garanti değil".`
      : `- İlk cümlede risk seviyesini söyle, sonra en önemli 1-2 nedeni açıkla.`;
  return `Bir Solana token'ı için risk analizi yapıldı. Bulguları sıradan bir kullanıcıya
sade Türkçe ile 2-3 kısa cümlede (en fazla 35 kelime) özetle.

Token: ${r.token.name ?? "İsimsiz"} (${r.token.symbol ?? "?"})
Risk skoru: ${r.score}/100 (${level})

Bulgular (biçim: [durum] Kontrol adı: detay):
${findings}

Kurallar:
- SADECE yukarıdaki bulguları kullan, yeni bilgi ekleme.
- Bir kontrolden bahsederken kontrol adını yukarıda yazdığı gibi BİREBİR kullan (iki noktadan önceki ad).
  Eş anlamlı ya da başka bir terim kullanma (ör. "Dondurma yetkisi" de, "dondurma kontrolü" deme).
${toneRule}
- "bilinmiyor" olanlardan sadece önemliyse, birkaç kelimeyle bahset.
- "güvenli" kelimesini ve türevlerini (güvenlidir, güvenle vb.) ASLA kullanma, olumsuz cümlede bile.
- Al/sat tavsiyesi verme. Düz metin yaz, madde işareti veya başlık kullanma.`;
}
