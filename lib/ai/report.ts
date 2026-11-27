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
  let text = (await generate(prompt)).trim();
  if (!BANNED[lang].test(text)) return text;

  // Yasaklı kelime geçtiyse bir kez daha, daha sert uyarıyla dene.
  const retry = prompt + (lang === "tr"
    ? `\n\nÖNEMLİ: Önceki denemende "güvenli" kelimesini kullandın. Bu kelimeyi ve türevlerini ASLA kullanma.`
    : `\n\nIMPORTANT: Your previous attempt used the word "safe". NEVER use "safe" or any of its forms.`);
  text = (await generate(retry)).trim();
  if (!BANNED[lang].test(text)) return text;

  // Son çare: yasaklı kelimenin geçtiği cümleleri çıkar.
  const kept = (text.match(/[^.!?]+[.!?]*/g) ?? [text]).filter((s) => !BANNED[lang].test(s));
  const cleaned = kept.join("").trim();
  return cleaned || null;
}

function buildPrompt(r: Omit<TokenReport, "summary">, lang: Lang): string {
  const findings = r.checks.map((c) => `- [${c.status}] ${c.title}: ${c.detail}`).join("\n");
  const positives = r.positiveSignals.length ? r.positiveSignals.join("\n- ") : "";

  if (lang === "en") {
    const level = r.level === "yuksek" ? "high risk" : r.level === "dikkat" ? "caution" : "low risk";
    return `A risk analysis was run on a Solana token. The findings below are in Turkish.
Summarise them for an ordinary user in plain English, in 3-4 sentences.

Token: ${r.token.name ?? "Unnamed"} (${r.token.symbol ?? "?"})
Risk score: ${r.score}/100 (${level})

Findings (status: gecti = passed, dikkat = caution, tehlikeli = dangerous, bilinmiyor = unknown):
${findings}
${positives ? "\nPositive signals:\n- " + positives : ""}

Rules:
- Use ONLY the findings above, add no new information.
- First sentence states the risk level, then explain the 2-3 most important reasons.
- Mention "unknown" checks briefly without exaggerating.
- NEVER use the word "safe" (or "safely", "safer", "safest"), not even in a negative sentence.
- If the risk is low, say something like: "the basic checks found no notable risk, but this is not a guarantee".
- Give no buy/sell advice. Explain any technical term in parentheses.
- Plain text, no bullet points or headings.`;
  }

  const level = r.level === "yuksek" ? "yüksek risk" : r.level === "dikkat" ? "dikkat" : "düşük risk";
  return `Bir Solana token'ı için risk analizi yapıldı. Sonuçları sıradan bir kullanıcıya
sade Türkçe ile 3-4 cümlede özetle.

Token: ${r.token.name ?? "İsimsiz"} (${r.token.symbol ?? "?"})
Risk skoru: ${r.score}/100 (${level})

Bulgular:
${findings}
${positives ? "\nOlumlu sinyaller:\n- " + positives : ""}

Kurallar:
- SADECE yukarıdaki bulguları kullan, yeni bilgi ekleme.
- İlk cümlede risk seviyesini söyle, sonra en önemli 2-3 nedeni açıkla.
- "bilinmiyor" olanlardan kısaca bahset ama abartma.
- "güvenli" kelimesini ve türevlerini (güvenlidir, güvenle vb.) ASLA kullanma, olumsuz cümlede bile.
- Risk düşükse şöyle bir ifade kullan: "temel kontrollerde belirgin bir risk bulunamadı, ama bu bir garanti değil".
- Al/sat tavsiyesi verme. Teknik terim kullanırsan parantezle açıkla.
- Düz metin yaz, madde işareti veya başlık kullanma.`;
}
