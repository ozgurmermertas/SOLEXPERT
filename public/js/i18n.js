// Türkçe / İngilizce dil desteği.
// HTML'de: data-i18n="anahtar" (içerik), data-i18n-ph (placeholder), data-i18n-title, data-i18n-aria.
// JS'de: I18N.t("anahtar"), I18N.lang, I18N.onChange(fn).
window.I18N = (() => {
  const DICT = {
    tr: {
      "meta.title": "SolExpert — Kripto için ekspertiz raporu",
      "nav.how": "Nasıl Çalışır", "nav.why": "Neden Önemli", "nav.tech": "Teknolojiler", "nav.scan": "Token Tara",
      "hero.l1": "TOKENIN İÇİN", "hero.l2": "EKSPERTİZ", "hero.l3": "RAPORU",
      "hero.sub": "Token adresini yapıştırın. SolExpert zincir üstü verileri, cüzdan dağılımını ve projenin web sitesini inceler; sonucu sade bir raporla sunar.",
      "hero.ph": "Solana token adresini yapıştır…", "hero.btn": "Tara →",
      "chips.label": "Dene:", "chips.risky": "Örnek riskli token", "chips.safe": "Örnek temiz token",
      "step.chain": "Zincir okunuyor", "step.mint": "Para basma ve dondurma yetkisi kontrol ediliyor",
      "step.holders": "Cüzdan dağılımı inceleniyor", "step.site": "Web sitesi okunuyor", "step.ai": "Rapor yazılıyor",
      "rep.listen": "🔊 Raporu dinle", "rep.share": "Linki kopyala", "rep.copied": "Kopyalandı ✓",
      "rep.holders": "Para kimin elinde?", "rep.flags": "Web sitesinde bulunanlar",
      "rep.noSite": "Web sitesi bulunamadı veya incelenemedi.", "rep.tech": "Teknik detay",
      "rep.disc": "SolExpert yatırım tavsiyesi vermez. Rapor, zincir üstü veriye ve sitenin içeriğine dayalı otomatik bir risk değerlendirmesidir.",
      "verdict.danger": "UZAK DUR", "verdict.warn": "DİKKATLİ OL", "verdict.ok": "TEMİZ GÖRÜNÜYOR",
      "how.kicker": "Nasıl çalışır",
      "c1.h": "Zinciri okur", "c1.p": "Yaratıcı istediği an yeni para basabiliyor mu? Satışını dondurabiliyor mu? Solana üzerinden tek sorguda.",
      "c2.h": "Cüzdanları sayar", "c2.p": "Arzın çoğu birkaç kişinin elinde mi? En büyük holder'ların payını hesaplar.",
      "c3.h": "Siteyi inceler", "c3.p": "\"Garanti 100x\" gibi vaatleri, kopya içerikleri yakalar. Firecrawl ile.",
      "c4.h": "Sesli anlatır", "c4.p": "Raporu sade bir dille yazar ve ElevenLabs ile size okur.",
      "why.kicker": "Neden önemli", "why.h": "Sorun küçük değil.",
      "why.lead": "2025'in ilk yarısında Solana'da çıkan her 4 tokenın 3'ü rug pull adayı olarak işaretlendi.",
      "s1.l": "rug pull adayı token", "s1.n": "100.063 yeni tokendan · Ocak–Haziran 2025 · aday, kesinleşmiş bulgu değil",
      "s2.l": "doğrudan kayıp (en az)", "s2.n": "7.322 kârlı adresin çektiği; gerçekleşmemiş düşüşler hariç",
      "s3.l": "freeze tuzağı", "s3.n": "Alıcının satışını donduran tokenlar. SolExpert bunu tek sorguda yakalar.",
      "s4.l": "likidite çöküşü", "s4.n": "Pump.fun'daki 7M+ tokenın 1.000 $ likiditenin altına düşenleri",
      "src.label": "Kaynak:",
      "tech.kicker": "Altyapı", "tech.h": "Kullanılan teknolojiler",
      "foot.tag": "Solana tokenları için yapay zekâ destekli risk analizi.",
      "foot.how": "Nasıl çalışır", "foot.why": "Neden önemli", "foot.tech": "Teknolojiler", "foot.scan": "Token tara",
      "foot.note": "SolExpert yatırım tavsiyesi vermez. Raporlar otomatik risk değerlendirmesidir.<br />© 2026 SolExpert. Tüm hakları saklıdır.",
      "panel.aria": "Ekspi paneli", "panel.close": "Kapat", "panel.addr": "Token adresini yapıştır", "panel.ph": "Adres…",
      "panel.paste": "Panodan yapıştır", "panel.scan": "Tara →", "panel.voice": "Ekspi'nin sesi",
      "panel.rate": "Hız", "panel.pitch": "Ton", "panel.test": "🔊 Sesi dene", "panel.fact": "💡 Bir bilgi ver",
      "bubble.fact": "· Biliyor muydunuz?", "bubble.src": "Kaynak: ", "owl.stop": "Sesi durdur",
    },
    en: {
      "meta.title": "SolExpert — An inspection report for crypto tokens",
      "nav.how": "How it works", "nav.why": "Why it matters", "nav.tech": "Technology", "nav.scan": "Scan a token",
      "hero.l1": "YOUR TOKEN'S", "hero.l2": "INSPECTION", "hero.l3": "REPORT",
      "hero.sub": "Paste a token address. SolExpert examines on-chain data, wallet distribution and the project's website, then delivers the verdict in a plain-language report.",
      "hero.ph": "Paste a Solana token address…", "hero.btn": "Scan →",
      "chips.label": "Try:", "chips.risky": "Sample risky token", "chips.safe": "Sample clean token",
      "step.chain": "Reading the chain", "step.mint": "Checking mint and freeze authority",
      "step.holders": "Analysing wallet distribution", "step.site": "Reading the website", "step.ai": "Writing the report",
      "rep.listen": "🔊 Listen to the report", "rep.share": "Copy link", "rep.copied": "Copied ✓",
      "rep.holders": "Who holds the supply?", "rep.flags": "Found on the website",
      "rep.noSite": "No website found, or it could not be inspected.", "rep.tech": "Technical detail",
      "rep.disc": "SolExpert does not give investment advice. The report is an automated risk assessment based on on-chain data and website content.",
      "verdict.danger": "STAY AWAY", "verdict.warn": "BE CAREFUL", "verdict.ok": "LOOKS CLEAN",
      "how.kicker": "How it works",
      "c1.h": "Reads the chain", "c1.p": "Can the creator mint new tokens at will? Freeze your sale? Checked in a single query on Solana.",
      "c2.h": "Counts the wallets", "c2.p": "Is most of the supply held by a few people? Calculates the share of the top holders.",
      "c3.h": "Inspects the website", "c3.p": "Catches promises like \"guaranteed 100x\" and copied content. Powered by Firecrawl.",
      "c4.h": "Explains out loud", "c4.p": "Writes the report in plain language and reads it to you with ElevenLabs.",
      "why.kicker": "Why it matters", "why.h": "The problem is not small.",
      "why.lead": "In the first half of 2025, 3 out of every 4 new Solana tokens were flagged as rug pull candidates.",
      "s1.l": "rug pull candidate tokens", "s1.n": "out of 100,063 new tokens · Jan–Jun 2025 · candidates, not confirmed findings",
      "s2.l": "direct losses (at least)", "s2.n": "cashed out by 7,322 profitable addresses; unrealised drops excluded",
      "s3.l": "freeze traps", "s3.n": "Tokens that froze buyers' ability to sell. SolExpert catches this in one query.",
      "s4.l": "liquidity collapse", "s4.n": "of 7M+ Pump.fun tokens fell below $1,000 in liquidity",
      "src.label": "Sources:",
      "tech.kicker": "Infrastructure", "tech.h": "Technology we use",
      "foot.tag": "AI-powered risk analysis for Solana tokens.",
      "foot.how": "How it works", "foot.why": "Why it matters", "foot.tech": "Technology", "foot.scan": "Scan a token",
      "foot.note": "SolExpert does not give investment advice. Reports are automated risk assessments.<br />© 2026 SolExpert. All rights reserved.",
      "panel.aria": "Ekspi panel", "panel.close": "Close", "panel.addr": "Paste the token address", "panel.ph": "Address…",
      "panel.paste": "Paste from clipboard", "panel.scan": "Scan →", "panel.voice": "Ekspi's voice",
      "panel.rate": "Speed", "panel.pitch": "Pitch", "panel.test": "🔊 Test voice", "panel.fact": "💡 Tell me a fact",
      "bubble.fact": "· Did you know?", "bubble.src": "Source: ", "owl.stop": "Stop speaking",
    },
  };

  const store = {
    get() { try { return localStorage.getItem("solexpert.lang"); } catch (_) { return null; } },
    set(v) { try { localStorage.setItem("solexpert.lang", v); } catch (_) {} },
  };
  let lang = store.get() || "tr";
  if (!DICT[lang]) lang = "tr";
  const listeners = [];

  const t = (k) => (DICT[lang][k] ?? DICT.tr[k] ?? k);

  function apply() {
    document.documentElement.lang = lang;
    document.title = t("meta.title");
    // Sözlük metinleri bizim yazdığımız sabit metinler (kullanıcı verisi değil), bu yüzden innerHTML güvenli.
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  }

  function set(l) {
    if (!DICT[l] || l === lang) return;
    lang = l; store.set(l); apply();
    listeners.forEach((f) => f(l));
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (b) set(b.dataset.lang);
  });
  apply();

  return { t, set, get lang() { return lang; }, onChange: (f) => listeners.push(f) };
})();
