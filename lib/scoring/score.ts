// TÜM puan kuralları burada. Ham gerçekler → kontrol kartları → 0–100 risk skoru.
// Kural değişirse CLAUDE.md'deki tabloyu da güncelle.
// Her kontrol: Türkçe detail + İngilizce detailEn + kısa teknik değer (arayüzde "Teknik detay").
import type { CheckResult, RiskLevel, TokenInfo, WebsiteNote } from "../types";
import type { Facts } from "../facts";
import { isDangerousGroup } from "../onchain/bundle";

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const fmtEn = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
// Okunur para: 2,4 milyon $ / 747 bin $ / 8.500 $  —  $2.4 million / $747K / $8,500
const usd = (n: number) =>
  n >= 1e6 ? `${fmt(n / 1e6)} milyon $` : n >= 1e4 ? `${Math.round(n / 1e3).toLocaleString("tr-TR")} bin $`
  : n.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " $";
const usdEn = (n: number) =>
  n >= 1e6 ? `$${fmtEn(n / 1e6)} million` : n >= 1e4 ? `$${Math.round(n / 1e3).toLocaleString("en-US")}K`
  : "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

type Base = Pick<CheckResult, "id" | "group" | "title">;
type Text = { tr: string; en: string };

const result = (
  base: Base, status: CheckResult["status"], points: number, t: Text, technical?: string,
): CheckResult => ({ ...base, status, points, detail: t.tr, detailEn: t.en, ...(technical ? { technical } : {}) });

const unknown = (base: Base, t: Text = { tr: "Veri alınamadı.", en: "Data could not be retrieved." }) =>
  result(base, "bilinmiyor", 0, t);

// Sahibi milyonlarca olan token'larda (ör. Wrapped SOL) en büyük hesaplar RPC'den alınamaz.
const TOO_MANY_HOLDERS: Text = {
  tr: "Çok fazla sahibi olduğu için dağılım hesaplanamadı.",
  en: "The distribution could not be calculated because the token has too many holders.",
};

export function buildChecks(f: Facts): CheckResult[] {
  const checks: CheckResult[] = [];

  // ---- 1. Anahtarlar ----
  const mintBase = { id: "mint_authority", group: "anahtarlar", title: "Basma yetkisi" } as const;
  checks.push(
    f.mint.mintAuthority
      ? result(mintBase, "tehlikeli", 25, {
          tr: "Evet. Basma yetkisi hâlâ açık: geliştirici istediği an yeni token basabilir.",
          en: "Yes. Mint authority is still active: the developer can mint new tokens at any time.",
        }, `mintAuthority: ${short(f.mint.mintAuthority)}`)
      : result(mintBase, "gecti", 0, {
          tr: "Hayır. Basma yetkisi kapatılmış, yeni token basılamaz.",
          en: "No. Mint authority has been revoked; no new tokens can be minted.",
        }, "mintAuthority: null"),
  );

  const freezeBase = { id: "freeze_authority", group: "anahtarlar", title: "Dondurma yetkisi" } as const;
  checks.push(
    f.mint.freezeAuthority
      ? result(freezeBase, "tehlikeli", 15, {
          tr: "Evet. Dondurma yetkisi açık: cüzdanındaki token'lar dondurulabilir, satamazsın.",
          en: "Yes. Freeze authority is active: the tokens in your wallet can be frozen so you can't sell.",
        }, `freezeAuthority: ${short(f.mint.freezeAuthority)}`)
      : result(freezeBase, "gecti", 0, {
          tr: "Hayır. Dondurma yetkisi kapatılmış.",
          en: "No. Freeze authority has been revoked.",
        }, "freezeAuthority: null"),
  );

  const t = f.mint.token2022;
  const t22Base = { id: "token2022", group: "anahtarlar", title: "Gizli ayarlar" } as const;
  if (!t) {
    checks.push(result(t22Base, "gecti", 0,
      { tr: "Standart SPL token, gizli ayar yok.", en: "Standard SPL token, no hidden settings." }, "program: SPL Token"));
  } else {
    const issues: Text[] = [];
    if (t.permanentDelegate) issues.push({ tr: "token'ları senden alabilecek kalıcı yetkili var (permanent delegate)", en: "a permanent delegate can take tokens from you" });
    if (t.transferFeeBps > 0) issues.push({ tr: `her transferde %${fmt(t.transferFeeBps / 100)} vergi kesiliyor`, en: `every transfer is taxed ${fmtEn(t.transferFeeBps / 100)}%` });
    if (t.transferHook) issues.push({ tr: "transferleri engelleyebilecek özel kod (transfer hook) bağlı", en: "custom code (transfer hook) can block transfers" });
    if (t.nonTransferable) issues.push({ tr: "token transfer edilemiyor", en: "the token cannot be transferred" });
    if (t.defaultFrozen) issues.push({ tr: "yeni hesaplar donmuş olarak açılıyor", en: "new accounts start frozen" });
    // Şu an zararsız ama ileride değiştirilebilecek ayarlar: her yetkili "dikkat", 5 puan.
    const mutable: Text[] = [];
    if (t.transferFeeAuthority) mutable.push(t.transferFeeBps > 0
      ? { tr: "transfer vergisi ileride değiştirilebilir: yetkili cüzdan oranı yükseltebilir", en: "the transfer tax can be changed later: an authority can raise the rate" }
      : { tr: "transfer vergisi şu an %0 ama ileride değiştirilebilir: yetkili cüzdan vergi koyabilir", en: "the transfer tax is 0% now but can be changed later: an authority can add a tax" });
    if (t.transferHookAuthority) mutable.push({
      tr: "transferlere bağlı program (transfer hook) ileride değiştirilebilir",
      en: "the program attached to transfers (transfer hook) can be changed later",
    });
    if (t.defaultStateAuthority) mutable.push({
      tr: "yeni hesapların varsayılan durumu ileride değiştirilebilir: yeni hesaplar donmuş açılabilir",
      en: "the default account state can be changed later: new accounts could start frozen",
    });
    const tech = [
      "program: Token-2022",
      `transferFeeBps: ${t.transferFeeBps}`,
      `permanentDelegate: ${t.permanentDelegate ? short(t.permanentDelegate) : "null"}`,
      `transferFeeConfigAuthority: ${t.transferFeeAuthority ? short(t.transferFeeAuthority) : "null"}`,
      `transferHookAuthority: ${t.transferHookAuthority ? short(t.transferHookAuthority) : "null"}`,
      t.defaultStateAuthority ? `defaultAccountStateAuthority: ${short(t.defaultStateAuthority)}` : "",
    ].filter(Boolean).join(", ");
    const all = [...issues, ...mutable];
    const joined: Text = { tr: cap(all.map((i) => i.tr).join("; ")) + ".", en: cap(all.map((i) => i.en).join("; ")) + "." };
    const points = (issues.length ? 20 : 0) + mutable.length * 5;
    checks.push(
      issues.length ? result(t22Base, "tehlikeli", points, joined, tech)
      : mutable.length ? result(t22Base, "dikkat", points, joined, tech)
      : result(t22Base, "gecti", 0, { tr: "Token-2022, ama tehlikeli bir ayar yok.", en: "Token-2022, but no dangerous settings." }, tech),
    );
  }

  // ---- 2. Dağılım ----
  const top10Base = { id: "top10", group: "dagilim", title: "İlk 10 holder" } as const;
  if (!f.holders) {
    checks.push(f.holdersTooMany
      ? unknown(top10Base, TOO_MANY_HOLDERS)
      : unknown(top10Base));
  }
  else {
    const p = f.holders.top10Pct;
    const tech = `top10Share: ${(p / 100).toFixed(2)}`;
    const text: Text = {
      tr: `İlk 10 cüzdanın arzdaki payı %${fmt(p)}.`,
      en: `The top 10 wallets hold ${fmtEn(p)}% of the supply.`,
    };
    // Havuz/program hesapları artık tespit ediliyor (lib/onchain/owners.ts): not sadece gerçekten varsa yazılır.
    const poolPct = f.holders.distribution.filter((r) => r.kind === "pool").reduce((s, r) => s + r.pct, 0);
    const poolNote: Text = poolPct > 0
      ? { tr: ` (Bunun %${fmt(poolPct)} kadarı likidite havuzu.)`, en: ` (${fmtEn(poolPct)}% of this is a liquidity pool.)` }
      : { tr: "", en: "" };
    checks.push(
      p > 50 ? result(top10Base, "tehlikeli", 15, { tr: text.tr + poolNote.tr, en: text.en + poolNote.en }, tech)
      : p > 30 ? result(top10Base, "dikkat", 7, { tr: text.tr + poolNote.tr, en: text.en + poolNote.en }, tech)
      : result(top10Base, "gecti", 0, text, tech),
    );
  }

  const devBase = { id: "dev_share", group: "dagilim", title: "Geliştirici payı" } as const;
  if (!f.creator) {
    // Oluşturan cüzdan, token'ın en eski işleminden bulunur (en fazla 3.000 işlem geriye gidilir).
    // Neden bulunamadığını token yaşına göre doğru söyle: yeni token'da "çok eski" demek yanlış olur.
    const pairAt = f.market?.pairCreatedAt ? new Date(f.market.pairCreatedAt).getTime() : null;
    const ageDays = pairAt ? (Date.now() - pairAt) / 86_400_000 : null;
    checks.push(unknown(devBase,
      ageDays === null
        ? { tr: "Oluşturan cüzdan tespit edilemedi.", en: "The creator wallet could not be identified." }
        : ageDays < 7
          ? {
              tr: "Oluşturan cüzdan tespit edilemedi: token yeni ama çok hızlı işlem gördüğü için ilk işlemine ulaşılamadı.",
              en: "The creator wallet could not be identified: the token is new but trades so fast that its first transaction could not be reached.",
            }
          : {
              tr: "Oluşturan cüzdan tespit edilemedi: token eski ve çok işlem görmüş, ilk işlemine ulaşılamadı.",
              en: "The creator wallet could not be identified: the token is old and heavily traded, so its first transaction could not be reached.",
            },
    ));
  } else {
    const p = f.creator.creatorPct;
    const text: Text = { tr: `Oluşturan cüzdanın payı: %${fmt(p)}.`, en: `The creator wallet holds ${fmtEn(p)}%.` };
    const tech = `creator: ${short(f.creator.creator)}, creatorShare: ${(p / 100).toFixed(3)}`;
    checks.push(p > 10 ? result(devBase, "tehlikeli", 10, text, tech) : result(devBase, "gecti", 0, text, tech));
  }

  // Bağlantılı cüzdanlar: en büyük holderlardan aynı kaynaktan fonlananlar.
  // 3+ cüzdan veya grubun payı > %15 → tehlikeli (20, skor en az 61); 2 cüzdan → dikkat (5).
  const bundleBase = { id: "bundle", group: "dagilim", title: "Bağlantılı cüzdanlar" } as const;
  if (!f.bundle && f.holdersTooMany) {
    checks.push(unknown(bundleBase, TOO_MANY_HOLDERS));
  } else if (!f.bundle) {
    checks.push(unknown(bundleBase, {
      tr: "Cüzdan bağlantıları 12 saniye içinde incelenemedi.",
      en: "Wallet links could not be checked within 12 seconds.",
    }));
  } else {
    const b = f.bundle;
    const danger = b.groups.find(isDangerousGroup);
    const worst = danger ?? b.groups[0];
    const tech = [
      `walletsChecked: ${b.walletsChecked}`,
      `skipped: ${b.skipped}`,
      worst ? `linkedWallets: ${worst.wallets.length}, linkedShare: ${(worst.pct / 100).toFixed(3)}, funder: ${short(worst.funder)}` : "linkedWallets: 0",
      b.partial ? "partial: true" : "",
    ].filter(Boolean).join(", ");
    const linked = (n: number, p: number): Text => ({
      tr: `${n} cüzdan aynı kaynaktan fonlanmış (toplam pay %${fmt(p)}).`,
      en: `${n} wallets were funded from the same source (${fmtEn(p)}% of the supply combined).`,
    });
    if (b.walletsChecked === 0 && !worst) {
      checks.push(unknown(bundleBase, { tr: "İncelenebilecek holder cüzdanı bulunamadı.", en: "No holder wallets could be inspected." }));
    } else if (danger) {
      checks.push(result(bundleBase, "tehlikeli", 20, linked(danger.wallets.length, danger.pct), tech));
    } else if (worst) {
      checks.push(result(bundleBase, "dikkat", 5, linked(worst.wallets.length, worst.pct), tech));
    } else {
      checks.push(result(bundleBase, "gecti", 0, {
        tr: "Büyük holderlar arasında aynı kaynaktan fonlanan cüzdan bulunamadı.",
        en: "No large holders were funded from the same source.",
      }, tech));
    }
  }

  // ---- 3. Alım-satım ----
  const sellBase = { id: "sell_test", group: "alim_satim", title: "Satış testi" } as const;
  if (!f.sell) checks.push(unknown(sellBase, { tr: "Jupiter'e ulaşılamadı.", en: "Jupiter could not be reached." }));
  else if (!f.sell.routeFound) {
    checks.push(result(sellBase, "tehlikeli", 30, {
      tr: "Jupiter satış rotası bulamadı: alınıp satılamayan bir token (honeypot) olabilir.",
      en: "Jupiter found no sell route: this may be a token you can buy but not sell (honeypot).",
    }, "sellRoute: none"));
  } else {
    const impact = f.sell.priceImpactPct;
    const tech = `sellRoute: found, priceImpactPct: ${impact === null ? "null" : impact.toFixed(2)}`;
    checks.push(
      impact !== null && impact > 10
        ? result(sellBase, "dikkat", 0, {
            tr: `Satılabiliyor, ama ~10 $'lık satış fiyatı %${fmt(impact)} düşürüyor.`,
            en: `It can be sold, but a ~$10 sale moves the price down ${fmtEn(impact)}%.`,
          }, tech)
        : result(sellBase, "gecti", 0, {
            tr: "Jupiter üzerinden satış rotası bulundu.",
            en: "A sell route was found on Jupiter.",
          }, tech),
    );
  }

  const liqBase = { id: "liquidity", group: "alim_satim", title: "Likidite" } as const;
  if (!f.market) {
    checks.push(result(liqBase, "tehlikeli", 20, { // havuz yok = 0 $ → 5.000 $ altı kuralı
      tr: "Hiçbir DEX'te işlem gören bir havuz yok.",
      en: "No pool is trading on any DEX.",
    }, "liquidityUsd: 0"));
  } else {
    const l = f.market.liquidityUsd;
    const tech = `liquidityUsd: ${Math.round(l)}`;
    checks.push(
      l < 5_000
        ? result(liqBase, "tehlikeli", 20, { tr: `Havuzda sadece ${usd(l)} likidite var, çok sığ.`, en: `The pool holds only ${usdEn(l)} in liquidity; very thin.` }, tech)
      : l < 10_000
        ? result(liqBase, "tehlikeli", 10, { tr: `Havuzda sadece ${usd(l)} likidite var.`, en: `The pool holds only ${usdEn(l)} in liquidity.` }, tech)
        : result(liqBase, "gecti", 0, { tr: `Havuzda yaklaşık ${usd(l)} likidite var.`, en: `The pool holds about ${usdEn(l)} in liquidity.` }, tech),
    );
  }

  const lpBase = { id: "lp_lock", group: "alim_satim", title: "Likidite kilidi" } as const;
  if (!f.lp) checks.push(unknown(lpBase));
  else if (f.lp.bondingCurve) {
    checks.push(result(lpBase, "gecti", 0, {
      tr: "pump.fun eğrisinde: havuzdaki para geliştirici tarafından çekilemez.",
      en: "On the pump.fun curve: the developer cannot pull the pool's funds.",
    }, "bondingCurve: true"));
  } else if (f.lp.lockedPct === null) {
    checks.push(unknown(lpBase, { tr: "Kilit bilgisi bulunamadı.", en: "No lock information was found." }));
  } else {
    const p = f.lp.lockedPct;
    const tech = `lpLockedPct: ${p}`;
    checks.push(
      p >= 90
        ? result(lpBase, "gecti", 0, { tr: `Kilitli veya yakılmış likidite oranı: %${fmt(p)}.`, en: `${fmtEn(p)}% of the liquidity is locked or burned.` }, tech)
        : result(lpBase, "tehlikeli", 15, {
            tr: `Kilitli likidite oranı sadece %${fmt(p)}: havuz çekilebilir (rug pull riski).`,
            en: `Only ${fmtEn(p)}% of the liquidity is locked: the pool can be pulled (rug pull risk).`,
          }, tech),
    );
  }

  // ---- 4. Proje ----
  const ageBase = { id: "age", group: "proje", title: "Token yaşı" } as const;
  const created = f.creator?.createdAt ?? f.market?.pairCreatedAt ?? null;
  if (!created) checks.push(unknown(ageBase));
  else {
    const hours = (Date.now() - new Date(created).getTime()) / 3_600_000;
    const tr = hours < 48 ? `${fmt(hours)} saat` : `${fmt(hours / 24)} gün`;
    const en = hours < 48 ? `${fmtEn(hours)} hours` : `${fmtEn(hours / 24)} days`;
    const tech = `createdAt: ${created.slice(0, 10)}`;
    checks.push(
      hours < 24
        ? result(ageBase, "dikkat", 5, { tr: `Token ${tr} önce oluşturuldu, çok yeni.`, en: `The token was created ${en} ago; it is very new.` }, tech)
        : result(ageBase, "gecti", 0, { tr: `Token ${tr} önce oluşturuldu.`, en: `The token was created ${en} ago.` }, tech),
    );
  }

  const webBase = { id: "website", group: "proje", title: "Resmi site" } as const;
  if (!f.website) {
    checks.push(unknown(webBase, {
      tr: "Site analizi yapılmadı (AI kapalı ya da site okunamadı).",
      en: "The website was not analysed (AI disabled or the site could not be read).",
    }));
  } else if (!f.website.url) {
    checks.push(result(webBase, "dikkat", 0, { tr: "Resmi bir site yok.", en: "There is no official website." }, "website: null"));
  } else {
    const flags = siteFlags(f);
    const tech = `flags: ${flags.length}`;
    // Tehlikeli (10) sadece gerçekçi olmayan vaat ya da zincirle çelişki varsa.
    // "Şablon içerik" tek başına dikkat (0 puan): birçok meşru projenin sitesi de kısa/jenerik.
    const serious = f.website.unrealisticPromises || f.website.contradictsChain;
    const flagText: Text = { tr: cap(flags.map((x) => x.tr).join(", ")) + ".", en: cap(flags.map((x) => x.en).join(", ")) + "." };
    checks.push(
      serious ? result(webBase, "tehlikeli", 10, flagText, tech)
      : flags.length ? result(webBase, "dikkat", 0, flagText, tech)
        : result(webBase, "gecti", 0, {
            tr: "Şüpheli bir vaat bulunmadı; sitede belirgin bir kırmızı bayrak yok.",
            en: "No suspicious promises found; no obvious red flags on the website.",
          }, tech),
    );
  }

  // Metadata güncelleme yetkisi: açıksa ad, logo ve site linki sonradan değiştirilebilir ("dikkat", 5 puan).
  const metaBase = { id: "metadata", group: "proje", title: "Metadata yetkisi" } as const;
  const ua = f.metadata?.updateAuthority;
  if (ua === undefined) checks.push(unknown(metaBase));
  else if (ua) {
    checks.push(result(metaBase, "dikkat", 5, {
      tr: "Token'ın adı, logosu ve site linki sonradan değiştirilebilir (metadata güncelleme yetkisi açık).",
      en: "The token's name, logo and website link can be changed later (metadata update authority is active).",
    }, `updateAuthority: ${short(ua)}`));
  } else {
    checks.push(result(metaBase, "gecti", 0, {
      tr: "Token'ın adı, logosu ve linkleri kilitli; değiştirilemez.",
      en: "The token's name, logo and links are locked and cannot be changed.",
    }, "updateAuthority: null (immutable)"));
  }

  return checks.map((c) => ({ ...c, titleEn: TITLE_EN[c.id] }));
}

/** Sitedeki 3 sabit kırmızı bayrak (Gemini işaretler, puanı score.ts verir). */
function siteFlags(f: Facts): Text[] {
  const w = f.website;
  if (!w || !w.url) return [];
  return [
    w.contradictsChain && { tr: "sitedeki iddialar zincirle çelişiyor", en: "claims on the site contradict on-chain data" },
    w.unrealisticPromises && { tr: "gerçekçi olmayan kazanç vaatleri var", en: "there are unrealistic profit promises" },
    w.templateText && { tr: "içerik jenerik/şablon", en: "the content is generic or templated" },
  ].filter(Boolean) as Text[];
}

/**
 * "Web sitesinde bulunanlar" paneli: önce sabit kırmızı bayraklar, sonra AI gözlemleri.
 * Bayrak yoksa en başta "Şüpheli bir vaat bulunmadı." yazar. Site incelenmediyse boş döner.
 */
export function websiteNotes(f: Facts): WebsiteNote[] {
  const w = f.website;
  if (!w) return [];
  if (!w.url) return [{ text: "Resmi bir site yok.", textEn: "There is no official website.", level: "warn" }];
  const flags = siteFlags(f).map((x): WebsiteNote => ({ text: cap(x.tr) + ".", textEn: cap(x.en) + ".", level: "warn" }));
  const head: WebsiteNote[] = flags.length
    ? flags
    : [{ text: "Şüpheli bir vaat bulunmadı.", textEn: "No suspicious promises found.", level: "ok" }];
  return [...head, ...w.notes];
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
  metadata: "Metadata authority",
};

// Bunlardan biri "bilinmiyor" ise seviye en az "dikkat" olur, skor 31'e çıkar:
// satılabilirlik, likidite ve holder dağılımı bilinmeden "düşük risk" denmez.
// Köklü token'lar hariç (isEstablished): orada eksik veri genelde token'ın büyüklüğünden kaynaklanır.
const CRITICAL_IF_UNKNOWN: CheckResult["id"][] = ["sell_test", "liquidity", "top10"];

// Seviyelerin skor alt sınırları (CLAUDE.md: 0–30 düşük, 31–60 dikkat, 61–100 yüksek).
const MIN_DIKKAT = 31;
const MIN_YUKSEK = 61;

/**
 * Skor tabanları: bazı durumlar puan toplamından bağımsız olarak seviyeyi yükseltir.
 * Skor da o seviyenin alt sınırına çıkar, böylece gösterge ile seviye hep tutarlı kalır.
 */
function scoreFloor(checks: CheckResult[]): number {
  const is = (id: CheckResult["id"], status: CheckResult["status"]) =>
    checks.some((c) => c.id === id && c.status === status);
  const dangerCount = checks.filter((c) => c.status === "tehlikeli").length;
  let floor = 0;
  // Arzın koordineli cüzdanlara bölünmesi tek başına ciddi bir işaret.
  if (is("bundle", "tehlikeli")) floor = Math.max(floor, MIN_YUKSEK);
  // Birden çok tehlikeli bulgu: 2+ → en az dikkat, 3+ → en az yüksek.
  if (dangerCount >= 3) floor = Math.max(floor, MIN_YUKSEK);
  else if (dangerCount >= 2) floor = Math.max(floor, MIN_DIKKAT);
  // Çok yeni (< 24 saat; age "dikkat") VE sığ likidite (< 10.000 $; liquidity "tehlikeli"): tipik rug kurulumu.
  if (is("age", "dikkat") && is("liquidity", "tehlikeli")) floor = Math.max(floor, MIN_YUKSEK);
  return floor;
}

/** Seviye sadece eksik veri yüzünden yükseldiğinde özetin başına eklenen cümle. */
export const DATA_GAP_NOTE = {
  tr: "Bazı kontrollerin verisi alınamadı, bu yüzden dikkatli olunmalı.",
  en: "Data for some checks could not be retrieved, so caution is advised.",
} as const;

const ESTABLISHED_MIN_LIQUIDITY = 1_000_000;
const ESTABLISHED_MIN_AGE_DAYS = 90;

/**
 * Köklü token: basma ve dondurma yetkileri kapalı, likidite 1 milyon $ üzeri, 90 günden eski.
 * Bunlarda bilinmeyen kritik kontrol seviyeyi yükseltmez.
 */
export function isEstablished(checks: CheckResult[], token: Pick<TokenInfo, "liquidityUsd" | "createdAt">): boolean {
  const passed = (id: CheckResult["id"]) => checks.some((c) => c.id === id && c.status === "gecti");
  const created = token.createdAt ? new Date(token.createdAt).getTime() : NaN;
  const ageDays = (Date.now() - created) / 86_400_000;
  return passed("mint_authority") && passed("freeze_authority")
    && (token.liquidityUsd ?? 0) > ESTABLISHED_MIN_LIQUIDITY
    && Number.isFinite(ageDays) && ageDays > ESTABLISHED_MIN_AGE_DAYS;
}

/**
 * dataGap: seviye sadece bilinmeyen kritik kontrol yüzünden "dikkat"e çıktı (skor 31'e çekildi).
 * Bu durumda özet sebebini söyler (DATA_GAP_NOTE).
 */
export function computeScore(
  checks: CheckResult[],
  token: Pick<TokenInfo, "liquidityUsd" | "createdAt">,
): { score: number; level: RiskLevel; dataGap: boolean } {
  let score = Math.min(100, checks.reduce((s, c) => s + c.points, 0));
  score = Math.max(score, scoreFloor(checks));
  let dataGap = false;
  if (score < MIN_DIKKAT
    && checks.some((c) => c.status === "bilinmiyor" && CRITICAL_IF_UNKNOWN.includes(c.id))
    && !isEstablished(checks, token)) {
    score = MIN_DIKKAT; // gösterge ile seviye tutarlı kalsın
    dataGap = true;
  }
  const level: RiskLevel = score < MIN_DIKKAT ? "dusuk" : score < MIN_YUKSEK ? "dikkat" : "yuksek";
  return { score, level, dataGap };
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
