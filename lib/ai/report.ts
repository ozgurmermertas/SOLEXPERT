// LLM sadece AÇIKLAMA yazar: skoru ve bulguları değiştirmez, yeni bulgu uydurmaz.
import { generate } from "./gemini";
import type { TokenReport } from "../types";

export async function writeSummary(r: Omit<TokenReport, "summary">): Promise<string> {
  const findings = r.checks
    .map((c) => `- [${c.status}] ${c.title}: ${c.detail}`)
    .join("\n");

  const prompt = `Bir Solana token'ı için güvenlik analizi yapıldı. Sonuçları sıradan bir kullanıcıya
sade Türkçe ile 3-4 cümlede özetle.

Token: ${r.token.name ?? "İsimsiz"} (${r.token.symbol ?? "?"})
Risk skoru: ${r.score}/100 (${r.level === "yuksek" ? "yüksek risk" : r.level === "dikkat" ? "dikkat" : "düşük risk"})

Bulgular:
${findings}
${r.positiveSignals.length ? "\nOlumlu sinyaller:\n- " + r.positiveSignals.join("\n- ") : ""}

Kurallar:
- SADECE yukarıdaki bulguları kullan, yeni bilgi ekleme.
- İlk cümlede risk seviyesini söyle, sonra en önemli 2-3 nedeni açıkla.
- "bilinmiyor" olanlardan kısaca bahset ama abartma.
- Al/sat tavsiyesi verme. Teknik terim kullanırsan parantezle açıkla.
- Düz metin yaz, madde işareti veya başlık kullanma.`;

  return (await generate(prompt)).trim();
}
