// LLM sadece AÇIKLAMA yazar: skoru ve bulguları değiştirmez, yeni bulgu uydurmaz.
// Kural: özet hiçbir zaman "güvenli" / "safe" demez. Düşük risk bir garanti değildir.
import { generate } from "./gemini";
import type { TokenReport } from "../types";

type Lang = "tr" | "en";

// "güvenli", "güvenlidir", "güvenle"… ama "güvenlik"/"güvenliği" (security) serbest.
const BANNED: Record<Lang, RegExp> = {
  tr: /güven(li(?![kğ])|le\b|ilir)/iu,
  en: /\b(safe|safely|safest|safer)\b/i,
};

export async function writeSummary(r: Omit<TokenReport, "summary">, lang: Lang = "tr"): Promise<string | null> {
  const prompt = buildPrompt(r, lang);
  let text = (await generate(prompt, { temperature: 0 })).trim();
  if (!BANNED[lang].test(text)) return text;

  // Yasaklı kelime geçtiyse bir kez daha, daha sert uyarıyla dene.
  const retry = prompt + (lang === "tr"
    ? `\n\nÖNEMLİ: Önceki denemende "güvenli" kelimesini kullandın. Bu kelimeyi ve türevlerini ASLA kullanma.`
    : `\n\nIMPORTANT: Your previous attempt used the word "safe". NEVER use "safe" or any of its forms.`);
  text = (await generate(retry, { temperature: 0 })).trim();
  if (!BANNED[lang].test(text)) return text;

  // Son çare: yasaklı kelimenin geçtiği cümleleri çıkar.
  const kept = (text.match(/[^.!?]+[.!?]*/g) ?? [text]).filter((s) => !BANNED[lang].test(s));
  const cleaned = kept.join("").trim();
  return cleaned || null;
}

function buildPrompt(r: Omit<TokenReport, "summary">, lang: Lang): string {
  // Bulgular özetin dilinde verilir: model kontrol adlarını çevirmeden, birebir kullanabilsin.
  // (Olumlu sinyaller ayrıca verilmez: bulguların tekrarıdır ve farklı kelimelere yol açıyordu.)
  if (lang === "en") {
    const status = { gecti: "passed", dikkat: "caution", tehlikeli: "dangerous", bilinmiyor: "unknown" } as const;
    const findings = r.checks
      .map((c) => `- [${status[c.status]}] ${c.titleEn ?? c.title}: ${c.detailEn ?? c.detail}`)
      .join("\n");
    const level = r.level === "yuksek" ? "high risk" : r.level === "dikkat" ? "caution" : "low risk";
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
- First sentence states the risk level, then give the most important 1-2 reasons.
- Mention "unknown" checks only if they matter, in a few words.
- NEVER use the word "safe" (or "safely", "safer", "safest"), not even in a negative sentence.
- If the risk is low, say something like: "the basic checks found no notable risk, but this is not a guarantee".
- Give no buy/sell advice. Plain text, no bullet points or headings.`;
  }

  const findings = r.checks.map((c) => `- [${c.status}] ${c.title}: ${c.detail}`).join("\n");
  const level = r.level === "yuksek" ? "yüksek risk" : r.level === "dikkat" ? "dikkat" : "düşük risk";
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
- İlk cümlede risk seviyesini söyle, sonra en önemli 1-2 nedeni açıkla.
- "bilinmiyor" olanlardan sadece önemliyse, birkaç kelimeyle bahset.
- "güvenli" kelimesini ve türevlerini (güvenlidir, güvenle vb.) ASLA kullanma, olumsuz cümlede bile.
- Risk düşükse şöyle bir ifade kullan: "temel kontrollerde belirgin bir risk bulunamadı, ama bu bir garanti değil".
- Al/sat tavsiyesi verme. Düz metin yaz, madde işareti veya başlık kullanma.`;
}
