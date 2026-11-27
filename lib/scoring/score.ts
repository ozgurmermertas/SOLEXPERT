// TÜM puan kuralları burada. Ham gerçekler → kontrol kartları → 0–100 risk skoru.
// Kural değişirse CLAUDE.md'deki tabloyu da güncelle.
import type { CheckResult, RiskLevel } from "../types";
import type { Facts } from "../facts";
import { isDangerousGroup } from "../onchain/bundle";

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const usd = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " $";

const unknown = (base: Omit<CheckResult, "status" | "points" | "detail">, why = "Veri alınamadı."): CheckResult => ({
  ...base, status: "bilinmiyor", points: 0, detail: why,
});

export function buildChecks(f: Facts): CheckResult[] {
  const checks: CheckResult[] = [];

  // ---- 1. Anahtarlar ----
  checks.push(
    f.mint.mintAuthority
      ? { id: "mint_authority", group: "anahtarlar", title: "Basma yetkisi", status: "tehlikeli", points: 25,
          detail: "Yetki hâlâ açık: geliştirici istediği an yeni token basabilir." }
      : { id: "mint_authority", group: "anahtarlar", title: "Basma yetkisi", status: "gecti", points: 0,
          detail: "Yetki kapatılmış, yeni token basılamaz." },
  );
  checks.push(
    f.mint.freezeAuthority
      ? { id: "freeze_authority", group: "anahtarlar", title: "Dondurma yetkisi", status: "tehlikeli", points: 15,
          detail: "Yetki hâlâ açık: cüzdanındaki token'lar dondurulabilir." }
      : { id: "freeze_authority", group: "anahtarlar", title: "Dondurma yetkisi", status: "gecti", points: 0,
          detail: "Yetki kapatılmış." },
  );

  const t = f.mint.token2022;
  const t22Base = { id: "token2022", group: "anahtarlar", title: "Gizli ayarlar" } as const;
  if (!t) {
    checks.push({ ...t22Base, status: "gecti", points: 0, detail: "Standart SPL token, gizli ayar yok." });
  } else {
    const issues: string[] = [];
    if (t.permanentDelegate) issues.push("token'ları senden alabilecek kalıcı yetkili var (permanent delegate)");
    if (t.transferFeeBps > 0) issues.push(`her transferde %${fmt(t.transferFeeBps / 100)} vergi kesiliyor`);
    if (t.transferHook) issues.push("transferleri engelleyebilecek özel kod (transfer hook) bağlı");
    if (t.nonTransferable) issues.push("token transfer edilemiyor");
    if (t.defaultFrozen) issues.push("yeni hesaplar donmuş olarak açılıyor");
    checks.push(
      issues.length
        ? { ...t22Base, status: "tehlikeli", points: 20, detail: cap(issues.join("; ")) + "." }
        : { ...t22Base, status: "gecti", points: 0, detail: "Token-2022, ama tehlikeli bir ayar yok." },
    );
  }

  // ---- 2. Dağılım ----
  const top10Base = { id: "top10", group: "dagilim", title: "İlk 10 holder" } as const;
  if (!f.holders) checks.push(unknown(top10Base));
  else {
    const p = f.holders.top10Pct;
    const note = " (likidite havuzu da bu listede olabilir)";
    checks.push(
      p > 50 ? { ...top10Base, status: "tehlikeli", points: 15, detail: `İlk 10 hesabın payı: %${fmt(p)}${note}.` }
      : p > 30 ? { ...top10Base, status: "dikkat", points: 7, detail: `İlk 10 hesabın payı: %${fmt(p)}${note}.` }
      : { ...top10Base, status: "gecti", points: 0, detail: `İlk 10 hesabın payı: %${fmt(p)}, dağılım makul.` },
    );
  }

  const devBase = { id: "dev_share", group: "dagilim", title: "Geliştirici payı" } as const;
  if (!f.creator) checks.push(unknown(devBase, "Oluşturan cüzdan bulunamadı (token çok eski veya çok aktif)."));
  else {
    const p = f.creator.creatorPct;
    checks.push(
      p > 10
        ? { ...devBase, status: "tehlikeli", points: 10, detail: `Oluşturan cüzdanın payı: %${fmt(p)}.` }
        : { ...devBase, status: "gecti", points: 0, detail: `Oluşturan cüzdanın payı: %${fmt(p)}.` },
    );
  }

  // Bağlantılı cüzdanlar: en büyük holderlardan aynı kaynaktan fonlananlar.
  // 3+ cüzdan veya grubun payı > %15 → tehlikeli (20); 2 cüzdan → dikkat (5).
  const bundleBase = { id: "bundle", group: "dagilim", title: "Bağlantılı cüzdanlar" } as const;
  if (!f.bundle) {
    checks.push(unknown(bundleBase, "Cüzdan bağlantıları 12 saniye içinde incelenemedi."));
  } else {
    const b = f.bundle;
    const g = b.groups[0]; // en kalabalık grup
    const danger = b.groups.find(isDangerousGroup);
    const worst = danger ?? g;
    const skippedNote =
      (b.partial ? " (Süre dolduğu için kısmi inceleme: sadece bitirilebilen cüzdanlara bakıldı.)" : "") +
      (b.skipped ? ` (${b.skipped} cüzdan çok aktif olduğu ya da okunamadığı için incelenmedi.)` : "");
    const detail = worst
      ? `En büyük holderlardan ${worst.wallets.length} cüzdan aynı kaynaktan fonlanmış (doğrudan ya da bir ara cüzdan üzerinden), toplam payları %${fmt(worst.pct)}.${skippedNote}`
      : "";
    if (b.walletsChecked === 0 && !worst) {
      checks.push(unknown(bundleBase, "İncelenebilecek holder cüzdanı bulunamadı." + skippedNote));
    } else if (danger) {
      checks.push({ ...bundleBase, status: "tehlikeli", points: 20, detail });
    } else if (worst) {
      checks.push({ ...bundleBase, status: "dikkat", points: 5, detail });
    } else {
      checks.push({ ...bundleBase, status: "gecti", points: 0,
        detail: `En büyük ${b.walletsChecked} holder cüzdanında aynı kaynaktan fonlanan cüzdan bulunamadı.${skippedNote}` });
    }
  }

  // ---- 3. Alım-satım ----
  const sellBase = { id: "sell_test", group: "alim_satim", title: "Satış testi" } as const;
  if (!f.sell) checks.push(unknown(sellBase, "Jupiter'e ulaşılamadı."));
  else if (!f.sell.routeFound) {
    checks.push({ ...sellBase, status: "tehlikeli", points: 30,
      detail: "Jupiter satış rotası bulamadı: alınıp satılamayan bir token (honeypot) olabilir." });
  } else {
    const impact = f.sell.priceImpactPct;
    checks.push(
      impact !== null && impact > 10
        ? { ...sellBase, status: "dikkat", points: 0,
            detail: `Satılabiliyor, ama ~10 $'lık satış fiyatı %${fmt(impact)} düşürüyor.` }
        : { ...sellBase, status: "gecti", points: 0, detail: "Jupiter üzerinden satış rotası bulundu." },
    );
  }

  const liqBase = { id: "liquidity", group: "alim_satim", title: "Likidite" } as const;
  if (!f.market) {
    checks.push({ ...liqBase, status: "tehlikeli", points: 10, detail: "Hiçbir DEX'te işlem gören bir havuz yok." });
  } else {
    const l = f.market.liquidityUsd;
    checks.push(
      l < 10_000
        ? { ...liqBase, status: "tehlikeli", points: 10, detail: `Likidite sadece ${usd(l)}.` }
        : { ...liqBase, status: "gecti", points: 0, detail: `Toplam likidite ${usd(l)}.` },
    );
  }

  const lpBase = { id: "lp_lock", group: "alim_satim", title: "Likidite kilidi" } as const;
  if (!f.lp) checks.push(unknown(lpBase));
  else if (f.lp.bondingCurve) {
    checks.push({ ...lpBase, status: "gecti", points: 0,
      detail: "pump.fun eğrisinde: havuzdaki para geliştirici tarafından çekilemez." });
  } else if (f.lp.lockedPct === null) {
    checks.push(unknown(lpBase, "Kilit bilgisi bulunamadı."));
  } else {
    const p = f.lp.lockedPct;
    checks.push(
      p >= 90 ? { ...lpBase, status: "gecti", points: 0, detail: `Kilitli/yakılmış likidite oranı: %${fmt(p)}.` }
      : { ...lpBase, status: "tehlikeli", points: 15,
          detail: `Kilitli likidite oranı sadece %${fmt(p)}: havuz çekilebilir (rug pull riski).` },
    );
  }

  // ---- 4. Proje ----
  const ageBase = { id: "age", group: "proje", title: "Token yaşı" } as const;
  const created = f.creator?.createdAt ?? f.market?.pairCreatedAt ?? null;
  if (!created) checks.push(unknown(ageBase));
  else {
    const hours = (Date.now() - new Date(created).getTime()) / 3_600_000;
    const label = hours < 48 ? `${fmt(hours)} saat` : `${fmt(hours / 24)} gün`;
    checks.push(
      hours < 24
        ? { ...ageBase, status: "dikkat", points: 5, detail: `Token ${label} önce oluşturuldu, çok yeni.` }
        : { ...ageBase, status: "gecti", points: 0, detail: `Token ${label} önce oluşturuldu.` },
    );
  }

  const webBase = { id: "website", group: "proje", title: "Resmi site" } as const;
  if (!f.website) checks.push(unknown(webBase, "Site analizi yapılmadı (AI kapalı ya da site okunamadı)."));
  else if (!f.website.url) checks.push({ ...webBase, status: "dikkat", points: 0, detail: "Resmi bir site yok." });
  else {
    const w = f.website;
    const flags = [
      w.contradictsChain && "sitedeki iddialar zincirle çelişiyor",
      w.unrealisticPromises && "gerçekçi olmayan kazanç vaatleri var",
      w.templateText && "içerik jenerik/şablon",
    ].filter(Boolean) as string[];
    const notes = w.notes.length ? " " + w.notes.join(" ") : "";
    checks.push(
      flags.length
        ? { ...webBase, status: "tehlikeli", points: 10, detail: cap(flags.join(", ")) + "." + notes }
        : { ...webBase, status: "gecti", points: 0, detail: "Belirgin bir kırmızı bayrak yok." + notes },
    );
  }

  return checks.map((c) => ({ ...c, titleEn: TITLE_EN[c.id] }));
}

// Arayüzün İngilizce modunda gösterilen başlıklar.
const TITLE_EN: Record<CheckResult["id"], string> = {
  mint_authority: "Mint authority",
  freeze_authority: "Freeze authority",
  token2022: "Hidden settings",
  top10: "Top 10 holders",
  dev_share: "Developer share",
  bundle: "Linked wallets",
  sell_test: "Sell test",
  liquidity: "Liquidity",
  lp_lock: "Liquidity lock",
  age: "Token age",
  website: "Official website",
};

// Bunlardan biri "bilinmiyor" ise seviye en az "dikkat" olur (skor değişmez):
// satılabilirlik, likidite ve holder dağılımı bilinmeden "düşük risk" denmez.
const CRITICAL_IF_UNKNOWN: CheckResult["id"][] = ["sell_test", "liquidity", "top10"];

// Arzın koordineli cüzdanlara bölünmesi tek başına ciddi bir işaret: skor en az bu değer olur (= yüksek).
const BUNDLE_DANGER_MIN_SCORE = 61;

export function computeScore(checks: CheckResult[]): { score: number; level: RiskLevel } {
  let score = Math.min(100, checks.reduce((s, c) => s + c.points, 0));
  if (checks.some((c) => c.id === "bundle" && c.status === "tehlikeli")) score = Math.max(score, BUNDLE_DANGER_MIN_SCORE);
  let level: RiskLevel = score <= 30 ? "dusuk" : score <= 60 ? "dikkat" : "yuksek";
  if (level === "dusuk" && checks.some((c) => c.status === "bilinmiyor" && CRITICAL_IF_UNKNOWN.includes(c.id))) {
    level = "dikkat";
  }
  return { score, level };
}

export function positiveSignals(f: Facts): string[] {
  const out: string[] = [];
  if (!f.mint.mintAuthority && !f.mint.freezeAuthority) out.push("Basma ve dondurma yetkileri kapatılmış.");
  if (f.lp && !f.lp.bondingCurve && (f.lp.lockedPct ?? 0) >= 90) out.push("Likidite kilitli veya yakılmış.");
  if (f.market && f.market.liquidityUsd >= 1_000_000) out.push("Derin likidite (1 milyon $ üzeri).");
  return out;
}

function cap(s: string): string {
  return s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
}
