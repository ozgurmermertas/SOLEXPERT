// Sunucu açmadan terminalden test:
//   npm run test:token -- <TOKEN_ADRESI>          (AI dahil)
//   npm run test:token -- <TOKEN_ADRESI> --no-ai  (sadece zincir kontrolleri)
import { readFileSync, existsSync } from "node:fs";

// .env.local'i elle yükle (Next.js dışında çalıştığımız için).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const address = process.argv[2];
  if (!address) {
    console.log("Kullanım: npm run test:token -- <TOKEN_ADRESI> [--no-ai]");
    process.exit(1);
  }
  // config, env yüklendikten SONRA okunmalı: dinamik import.
  const { analyzeToken } = await import("../lib/analyze");
  const started = Date.now();
  const r = await analyzeToken(address, { withAi: !process.argv.includes("--no-ai") });

  const icon = { gecti: "🟢", dikkat: "🟡", tehlikeli: "🔴", bilinmiyor: "⚪" } as const;
  console.log(`\n${r.token.name ?? "?"} (${r.token.symbol ?? "?"})  —  Risk: ${r.score}/100 [${r.level}]\n`);
  for (const c of r.checks) console.log(`${icon[c.status]} ${c.title.padEnd(18)} +${String(c.points).padEnd(3)} ${c.detail}`);
  if (r.positiveSignals.length) console.log("\nOlumlu:", r.positiveSignals.join(" | "));
  if (r.summary) console.log("\nÖzet:", r.summary);
  console.log(`\n(${((Date.now() - started) / 1000).toFixed(1)} sn)`);
}

main().catch((e) => {
  console.error("Hata:", e instanceof Error ? e.message : e);
  process.exit(1);
});
