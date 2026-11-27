// SolExpert ana akış: adres al → analiz adımları → rapor çiz.
(() => {
  const cfg = window.SOLEXPERT_CONFIG;
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Logo yoksa isim yaz ----------
  function bindLogo(img, name) {
    const swap = () => {
      if (!img.isConnected) return;
      const span = document.createElement("span");
      span.className = "logo-fallback";
      span.textContent = name || img.dataset.fallback || img.alt;
      img.replaceWith(span);
    };
    if (img.complete && img.naturalWidth === 0) swap(); // zaten 404 olduysa
    else img.addEventListener("error", swap, { once: true });
  }
  document.querySelectorAll("img.logo-img").forEach((img) => bindLogo(img));

  // ---------- Partnerler ----------
  const L = window.I18N;
  const T = (tr, en) => (L.lang === "en" ? en : tr);
  const pl = $("#partner-list");
  function renderPartners() {
    pl.innerHTML = "";
    cfg.PARTNERS.forEach((p) => {
      const a = document.createElement("a");
      a.className = "partner"; a.href = p.url; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = `<img class="logo-img" src="${esc(p.logo)}" alt="${esc(p.name)}" /><small>${esc(T(p.role, p.roleEn || p.role))}</small>`;
      pl.appendChild(a);
      bindLogo(a.querySelector("img"), p.name.toUpperCase());
    });
    window.SolReveal && window.SolReveal.scan();
  }
  renderPartners();

  // ---------- Sayaçlar ----------
  const counters = document.querySelectorAll(".stat-num");
  const fmt = (el, v) => {
    const Lg = L.lang === "en" ? "En" : "Tr", loc = L.lang === "en" ? "en-US" : "tr-TR";
    const pre = el.dataset["prefix" + Lg] ?? el.dataset.prefix ?? "", suf = el.dataset["suffix" + Lg] ?? el.dataset.suffix ?? "";
    let n;
    if (el.dataset.format === "dec") n = v.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    else n = Math.round(v).toLocaleString(loc);
    el.textContent = pre + n + suf;
  };
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const el = en.target;
      cancelAnimationFrame(el._raf);
      if (!en.isIntersecting) { fmt(el, 0); return; } // çıkınca sıfırla, girince yeniden say
      const end = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1600;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        fmt(el, end * e);
        if (k < 1) el._raf = requestAnimationFrame(step);
      };
      el._raf = requestAnimationFrame(step);
    });
  }, { threshold: 0.4 });
  counters.forEach((c) => cio.observe(c));

  // ---------- Veri katmanı: POST /api/analyze → TokenReport (lib/types.ts) ----------
  const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  class UserError extends Error {}

  // TokenReport → bu tasarımın beklediği rapor şekli
  const LEVEL = { dusuk: "ok", dikkat: "warn", yuksek: "danger" };
  const STATUS = { gecti: "ok", dikkat: "warn", tehlikeli: "danger", bilinmiyor: "unknown" };
  const SEVERITY = { tehlikeli: 3, dikkat: 2, bilinmiyor: 1, gecti: 0 };

  // Backend'in 11 kontrolü tasarımdaki 5 karta toplanır. İlk kontrol kartın ana konusu;
  // diğerleri sadece sorun varsa (dikkat/tehlikeli) kartın rengini ve metnini etkiler.
  const CARDS = [
    { id: "mint_authority", tr: "Yeni para basılabilir mi?", en: "Can new tokens be minted?", checks: ["mint_authority"] },
    { id: "freeze_authority", tr: "Satışın dondurulabilir mi?", en: "Can your sale be frozen?", checks: ["freeze_authority", "token2022", "sell_test"] },
    { id: "top_holders", tr: "Para kimin elinde?", en: "Who holds the supply?", checks: ["top10", "bundle", "dev_share"] },
    { id: "liquidity", tr: "Likidite yeterli mi?", en: "Is there enough liquidity?", checks: ["liquidity", "lp_lock"] },
    { id: "website", tr: "Web sitesi güvenilir mi?", en: "Is the website trustworthy?", checks: ["website", "age"] },
  ];

  // Kartta yeri olmayan (ileride eklenen) bir kontrol de kaybolmasın: grubunun kartına gider.
  const GROUP_CARD = { anahtarlar: "freeze_authority", dagilim: "top_holders", alim_satim: "liquidity", proje: "website" };

  function toCard(card, checks) {
    const [primary, ...rest] = checks;
    if (!primary) return null;
    // Backend'in döndürdüğü HER kontrol kartında görünür; en ciddi olan önce
    // (bundle tehlikeliyse metin onunla başlar). Renk: ana kontrol + sorunlu (dikkat/tehlikeli) yan kontroller.
    const shown = [primary, ...rest]
      .map((c, i) => ({ c, i }))
      .sort((a, b) => SEVERITY[b.c.status] - SEVERITY[a.c.status] || a.i - b.i)
      .map((x) => x.c);
    const worst = [primary, ...rest.filter((c) => SEVERITY[c.status] >= 2)]
      .reduce((w, c) => (SEVERITY[c.status] > SEVERITY[w.status] ? c : w));
    const text = (c) => (L.lang === "en" && c.detailEn) || c.detail;
    return {
      id: card.id,
      label: T(card.tr, card.en),
      status: STATUS[worst.status] || "unknown",
      detail: shown.map(text).join(" "),
      raw: shown.map((c) => c.technical).filter(Boolean).join(" · "),
    };
  }

  /** 5 karta dağıt: önce CARDS'taki eşleşme, eşleşmeyen kontroller grubunun kartına. */
  function toCards(checks) {
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    const mapped = new Set(CARDS.flatMap((card) => card.checks));
    return CARDS.map((card) => {
      const own = card.checks.map((id) => byId[id]).filter(Boolean);
      const extra = checks.filter((c) => !mapped.has(c.id) && (GROUP_CARD[c.group] || "website") === card.id);
      return toCard(card, [...own, ...extra]);
    }).filter(Boolean);
  }

  // Yüzdeleri tasarımdaki gibi tam sayı göster (1'in altındakiler tek ondalık); toplam 100 olsun.
  const pctView = (p) => (p >= 1 ? Math.round(p) : Math.round(p * 10) / 10);
  // holderDistribution satırları: likidite havuzu / program hesapları "Likidite havuzu" olarak etiketlenir.
  function toHolders(d) {
    if (!Array.isArray(d) || !d.length) return [];
    const label = (r) =>
      r.kind === "pool" ? T("Likidite havuzu", "Liquidity pool")
      : r.kind === "wallet" ? T("Cüzdan #" + r.rank, "Wallet #" + r.rank)
      : T("Cüzdan #4–10", "Wallets #4–10");
    const rows = d.filter((r) => r.kind !== "others").map((r) => ({ label: label(r), pct: pctView(r.pct) }));
    const others = Math.max(0, Math.round((100 - rows.reduce((s, r) => s + r.pct, 0)) * 10) / 10);
    rows.push({ label: T("Diğer herkes", "Everyone else"), pct: others });
    return rows;
  }

  // ---------- Grafikler (Rojin'in Peak Chart kartları) — sadece gerçek veriyle ----------
  // Fiyat: priceHistory (GeckoTerminal, son 7 gün) · Dağılım: topHolders (RPC, ilk 20 hesap).
  // Likidite geçmişi için gerçek bir kaynak yok: yerine "Havuzdaki para" (anlık likidite) çizilir.
  const pctFmt = (v, d) => v.toLocaleString(L.lang === "en" ? "en-US" : "tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const signed = (up) => (L.lang === "en" ? { prefix: up ? "+" : "−", suffix: "%" } : { prefix: up ? "+%" : "−%", suffix: "" });
  const pctAffix = () => (L.lang === "en" ? { prefix: "", suffix: "%" } : { prefix: "%", suffix: "" });
  const usdDecimals = (p) => (p < 0.0001 ? 8 : p < 0.01 ? 6 : p < 1 ? 4 : 2);
  const usdText = (p) => "$" + p.toLocaleString(L.lang === "en" ? "en-US" : "tr-TR", { maximumFractionDigits: usdDecimals(p) });

  function priceChart(points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const prices = points.map((p) => p.priceUsd);
    const first = prices[0], last = prices[prices.length - 1], peak = Math.max(...prices);
    const change = (last / first - 1) * 100;
    const fromPeak = (1 - last / peak) * 100;
    // Zirveden sert düşüş varsa onu göster (pump-and-dump izi), yoksa 7 günlük değişimi
    const showPeak = fromPeak >= 40;
    const value = showPeak ? fromPeak : Math.abs(change);
    const up = !showPeak && change >= 0;
    const tone = fromPeak >= 70 ? "danger" : fromPeak >= 40 || change <= -30 ? "warn" : "ok";
    const loc = L.lang === "en" ? "en-US" : "tr-TR";
    return {
      id: "price", tone,
      title: showPeak ? T("Zirveden fiyat değişimi", "Change from peak") : T("7 günlük fiyat değişimi", "7-day price change"),
      caption: T(`Zirve ${usdText(peak)} · şimdi ${usdText(last)}`, `Peak ${usdText(peak)} · now ${usdText(last)}`),
      status: T("Son 7 gün", "Last 7 days"), badge: T("7G", "7D"),
      value: Math.round(value * 10) / 10, decimals: 1, ...signed(up), trend: up ? "up" : "down",
      data: prices,
      labels: points.map((p) => new Date(p.t).toLocaleString(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })),
      hover: { prefix: "$", decimals: usdDecimals(Math.min(...prices)) },
    };
  }

  // "Havuzdaki para": tüm havuzlardaki toplam likidite (token.liquidityUsd, likidite kontrolüyle aynı sayı).
  // Likidite geçmişi için ücretsiz kaynak yok: tek bir değer, çizgi yatay (sahte geçmiş çizilmez).
  // Ton: 10.000 $ altı tehlikeli, 10.000–100.000 $ uyarı, üstü iyi. Puanlamayı etkilemez.
  function liquidityChart(usd) {
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd < 0) return null;
    const en = L.lang === "en";
    // Kart değeri tasarımdaki gibi kısa: $4.007 / $754K / $3,6M
    const [value, suffix, decimals] =
      usd >= 1e6 ? [Math.round(usd / 1e5) / 10, "M", 1]
      : usd >= 1e4 ? [Math.round(usd / 1e3), "K", 0]
      : [Math.round(usd), "", 0];
    // Açıklamadaki tutar: 4.007 $ / 754 bin $ / 3,6 milyon $  —  $4,007 / $754K / $3.6 million
    const loc = en ? "en-US" : "tr-TR";
    const amount = en
      ? usd >= 1e6 ? `$${(Math.round(usd / 1e5) / 10).toLocaleString(loc)} million`
        : usd >= 1e4 ? `$${Math.round(usd / 1e3).toLocaleString(loc)}K` : `$${Math.round(usd).toLocaleString(loc)}`
      : usd >= 1e6 ? `${(Math.round(usd / 1e5) / 10).toLocaleString(loc)} milyon $`
        : usd >= 1e4 ? `${Math.round(usd / 1e3).toLocaleString(loc)} bin $` : `${Math.round(usd).toLocaleString(loc)} $`;
    return {
      id: "liquidity", tone: usd < 10_000 ? "danger" : usd < 100_000 ? "warn" : "ok",
      title: T("Havuzdaki para", "Liquidity in pool"),
      caption: T(`Havuzda ${amount} var. Küçük havuzlarda tek bir satış fiyatı çökertebilir.`,
        `The pool holds ${amount}. In small pools a single sale can crash the price.`),
      status: T("Canlı", "Live"), badge: T("Likidite", "Liquidity"),
      value, prefix: "$", suffix, decimals, trend: "none",
      data: [usd, usd], labels: [T("Şimdi", "Now"), T("Şimdi", "Now")],
      hover: { prefix: "$", decimals: 0 },
    };
  }

  function holdersChart(rows, card) {
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const top10 = rows.slice(0, 10).reduce((s, r) => s + r.pct, 0);
    const a = pctAffix();
    return {
      id: "holders", tone: card && ["danger", "warn", "ok"].includes(card.status) ? card.status : "warn",
      title: T("İlk 10 cüzdanın payı", "Share held by top 10 wallets"),
      caption: card ? card.detail.split(/(?<=\.)\s+/)[0] : "", // tasarımdaki gibi tek cümle (en önemli bulgu)
      status: T("Canlı", "Live"), badge: T("İlk " + rows.length, "Top " + rows.length),
      value: Math.round(top10 * 10) / 10, decimals: 1, ...a, trend: "none", // kartla aynı hassasiyet
      data: rows.map((r) => r.pct),
      labels: rows.map((r) => (r.kind === "pool" ? T("Likidite havuzu", "Liquidity pool") : T("Cüzdan #" + r.rank, "Wallet #" + r.rank))),
      hover: { ...a, decimals: 2 },
    };
  }

  function toView(tr, address) {
    const score = Math.max(0, Math.min(100, Math.round(tr.score) || 0));
    const cards = toCards(tr.checks);
    const holdersCard = cards.find((c) => c.id === "top_holders");
    return {
      charts: [priceChart(tr.priceHistory), holdersChart(tr.topHolders, holdersCard), liquidityChart(tr.token && tr.token.liquidityUsd)].filter(Boolean),
      address: (tr.token && tr.token.address) || address,
      riskScore: score,
      // level yoksa CLAUDE.md aralıkları: 0–30 düşük, 31–60 dikkat, 61–100 yüksek
      verdict: LEVEL[tr.level] || (score >= 61 ? "danger" : score >= 31 ? "warn" : "ok"),
      summary: typeof tr.summary === "string" ? tr.summary.trim() : "",
      checks: cards,
      holders: toHolders(tr.holderDistribution),
      siteFlags: (tr.websiteNotes || []).map((n) => ({
        text: (L.lang === "en" && n.textEn) || n.text,
        level: n.level === "warn" ? "warn" : "ok",
      })),
      audioUrl: null,
    };
  }

  async function fetchReport(address) {
    if (!BASE58.test(address)) {
      throw new UserError(T("Bu geçerli bir Solana token adresi gibi görünmüyor. Adresi kontrol edip tekrar deneyin.",
        "This doesn't look like a valid Solana token address. Please check it and try again."));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.ANALYZE_TIMEOUT_MS || 65000);
    let res;
    try {
      res = await fetch(cfg.API_BASE + cfg.ANALYZE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, lang: L.lang }), // backend şu an sadece Türkçe yazıyor; lang ileride kullanılabilir
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw new UserError(T("Analiz çok uzun sürdü. Biraz sonra tekrar deneyin.", "The analysis took too long. Please try again shortly."));
      throw new UserError(T("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.", "Couldn't reach the server. Check your connection and try again."));
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      // Backend 400/500'de Türkçe { error } döndürür (bkz. API.md)
      if (data && typeof data.error === "string" && data.error.trim()) throw new UserError(data.error);
      if (res.status === 400) throw new UserError(T("Geçersiz adres ya da bu adres bir token değil.", "Invalid address, or this address is not a token."));
      if (res.status === 429) throw new UserError(T("Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.", "Too many requests. Please wait a moment and try again."));
      throw new UserError(T("Sunucuda bir hata oluştu. Biraz sonra tekrar deneyin.", "Something went wrong on the server. Please try again shortly."));
    }
    if (!data || typeof data.score !== "number" || !Array.isArray(data.checks)) {
      throw new UserError(T("Sunucudan beklenmeyen bir yanıt geldi. Biraz sonra tekrar deneyin.", "Unexpected response from the server. Please try again shortly."));
    }
    lastRaw = { data, address };
    return toView(data, address);
  }
  let lastRaw = null; // son TokenReport; dil değişince yeniden istek atmadan tekrar çizmek için

  // ---------- Analiz adımları (yükleniyor durumu; analiz 5–25 sn sürebilir) ----------
  // Adımlar bu zamanlarda (ms) ilerler; son adım ("Rapor yazılıyor") yanıt gelene kadar döner.
  const STEP_AT = [0, 1200, 3000, 5500, 9000];
  async function runSteps(promise) {
    const steps = [...document.querySelectorAll(".step")];
    steps.forEach((s) => s.classList.remove("active", "done"));
    let current = -1;
    const advance = (i) => {
      if (i <= current) return;
      for (let k = 0; k <= current; k++) { steps[k].classList.remove("active"); steps[k].classList.add("done"); }
      for (let k = current + 1; k < i; k++) steps[k].classList.add("done");
      current = i;
      steps[i].classList.add("active");
    };
    const timers = [
      ...STEP_AT.slice(0, steps.length).map((t, i) => setTimeout(() => advance(i), t)),
      // Uzun beklemede Ekspi kullanıcıyı bilgilendirir
      setTimeout(() => window.Mascot.say(T("Hâlâ bakıyorum, bu işlem 25 saniyeye kadar sürebilir…", "Still checking, this can take up to 25 seconds…")), 12000),
      setTimeout(() => window.Mascot.say(T("Beklenenden uzun sürdü, az kaldı…", "Taking longer than expected, almost there…")), 26000),
    ];
    try {
      const result = await promise;
      steps.forEach((s) => { s.classList.remove("active"); s.classList.add("done"); });
      await sleep(350);
      return result;
    } catch (e) {
      steps.forEach((s) => s.classList.remove("active"));
      throw e;
    } finally {
      timers.forEach(clearTimeout);
    }
  }

  // ---------- Rapor ----------
  const ICON = { danger: "✕", warn: "!", ok: "✓" };
  const COLOR = { danger: "var(--danger)", warn: "var(--warn)", ok: "var(--ok)" };

  // ---------- Peak Chart sonuç kartları ----------
  const TONE = { danger: "#ff4d5e", warn: "#f0a020", ok: "#2ec99a" };
  let charts = [];
  const chartWidth = () => {
    const row = $("#peak-row"), w = row.clientWidth || 1000;
    if (w < 640) return Math.min(380, w);            // telefonda alt alta
    if (w < 1000) return Math.floor((w - 24) / 2);   // tablette 2'li
    return Math.min(380, Math.floor((w - 48) / 3));  // masaüstünde 3'lü
  };
  function chartOpts(c) {
    const h = c.hover || {}, loc = L.lang === "en" ? "en-US" : "tr-TR";
    return {
      data: c.data || [0, 0], labels: c.labels || null, value: +c.value || 0,
      prefix: c.prefix || "", suffix: c.suffix || "", decimals: c.decimals | 0,
      title: c.title || "", caption: c.caption || "", status: c.status || "", badge: c.badge || "",
      trend: c.trend || "none", accent: TONE[c.tone] || c.accent || "#4f8ef7", locale: loc, width: chartWidth(),
      formatValue: (v) => (h.prefix || "") + v.toLocaleString(loc, { minimumFractionDigits: h.decimals | 0, maximumFractionDigits: h.decimals | 0 }) + (h.suffix || ""),
    };
  }
  function renderCharts(list) {
    const row = $("#peak-row");
    row.classList.toggle("hidden", !list.length);
    if (!window.PeakChart) return;
    // aynı sayıda grafik varsa yeniden kurmak yerine güncelle: çizgi yumuşakça yeni veriye geçer
    if (charts.length === list.length && charts.length) { list.forEach((c, i) => charts[i].update(chartOpts(c))); return; }
    charts.forEach((c) => c.destroy()); charts = [];
    list.forEach((c) => charts.push(window.PeakChart.mount(row, chartOpts(c))));
  }
  window.addEventListener("resize", () => { const w = chartWidth(); charts.forEach((c) => c.resize(w)); });

  function render(r) {
    $("#report").classList.remove("hidden"); // grafik genişliği doğru ölçülsün diye önce görünür yap
    const score = Math.max(0, Math.min(100, r.riskScore | 0));
    const verdict = r.verdict || (score >= 66 ? "danger" : score >= 33 ? "warn" : "ok");
    const label = r.verdictLabel || L.t("verdict." + verdict);

    // gösterge
    const fill = $("#gauge-fill");
    fill.style.stroke = COLOR[verdict];
    requestAnimationFrame(() => { fill.style.strokeDashoffset = 252 - (252 * score) / 100; });
    const t0 = performance.now();
    const count = (t) => { const k = Math.min(1, (t - t0) / 1400); $("#score").textContent = Math.round(score * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(count); };
    requestAnimationFrame(count);

    const v = $("#verdict"); v.textContent = label; v.className = "verdict " + verdict;
    $("#summary").textContent = r.summary || "";

    // "unknown": bir kontrol verisi alınamadığında (backend "bilinmiyor")
    const STATUS = { danger: T("Riskli", "Risky"), warn: T("Dikkat", "Caution"), ok: T("Temiz", "Clear"), unknown: T("Bilinmiyor", "Unknown") };
    $("#checks").innerHTML = (r.checks || []).map((c) => `
      <article class="check ${esc(c.status)}">
        <header>
          <span class="check-pill"><i></i>${esc(STATUS[c.status] || "")}</span>
          <span class="check-ico" aria-hidden="true">${ICON[c.status] || "•"}</span>
        </header>
        <h4>${esc(c.label)}</h4>
        <p>${esc(c.detail)}</p>
        ${c.raw ? `<details><summary>${esc(L.t("rep.tech"))}</summary><code>${esc(c.raw)}</code></details>` : ""}
      </article>`).join("");

    renderCharts(r.charts || []);

    // Site bulguları: kontrol kartlarıyla aynı kart yapısı (rozet + ikon + metin)
    const FLAG = { warn: T("Şüpheli", "Suspicious"), danger: T("Tehlikeli", "Dangerous"), ok: T("Temiz", "Clear") };
    const flags = (r.siteFlags || []).length ? r.siteFlags : [{ text: L.t("rep.noSite"), level: "ok" }];
    $("#flags").innerHTML = flags.map((f) => {
      const lv = ["warn", "danger", "ok"].includes(f.level) ? f.level : "warn";
      const quote = /^["“]/.test(f.text || "");
      return `
      <article class="check flag ${lv}">
        <header>
          <span class="check-pill"><i></i>${esc(FLAG[lv])}</span>
          <span class="check-ico" aria-hidden="true">${ICON[lv] || "!"}</span>
        </header>
        <p class="flag-text${quote ? " quote" : ""}">${esc(f.text)}</p>
      </article>`;
    }).join("");

    window.Mascot.setReport(r.summary, r.audioUrl);
    window.Mascot.say(verdict === "danger"
      ? T("Bu tokendan uzak durun! 'Raporu dinle' butonuna basın, anlatayım.", "Stay away from this token! Press 'Listen to the report' and I'll explain.")
      : T("Rapor hazır. 'Raporu dinle' butonuna basın, anlatayım.", "The report is ready. Press 'Listen to the report' and I'll explain."));
    window.SolReveal && window.SolReveal.scan();
    window.__lastReport = r;
  }

  // ---------- Akış ----------
  let busy = false;
  async function analyze(address) {
    address = address.trim();
    if (!address || busy) return;
    busy = true;
    $("#analysis").classList.remove("hidden");
    $("#report").classList.add("hidden");
    $("#analysis").scrollIntoView({ behavior: "smooth", block: "start" });
    window.Mascot.say(T("Usta işbaşında! Zinciri okuyorum…", "On it! Reading the chain…"));
    const url = new URL(location.href); url.searchParams.set("address", address); history.replaceState(null, "", url);
    try {
      const report = await runSteps(fetchReport(address));
      render(report);
    } catch (e) {
      console.error("[analyze]", e);
      const msg = e instanceof UserError ? e.message
        : T("Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin.", "An unexpected error occurred. Please reload the page and try again.");
      window.Mascot.say(T("Bir şeyler ters gitti: ", "Something went wrong: ") + msg);
    } finally {
      busy = false;
    }
  }

  $("#scan-form").addEventListener("submit", (e) => { e.preventDefault(); analyze($("#address").value); });
  document.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => {
    // Gerçek token adresleri config.js → DEMO_ADDRESSES
    const addr = ((cfg.DEMO_ADDRESSES || {})[b.dataset.demo] || "").trim();
    if (!addr) { window.Mascot.say(T("Bu örnek için henüz bir token adresi eklenmedi.", "No token address has been added for this example yet.")); return; }
    $("#address").value = addr; analyze(addr);
  }));
  // "Raporu dinle": summary metni POST /api/voice ile okunur (voice.js; anahtar yoksa tarayıcı sesi)
  $("#listen").addEventListener("click", () => {
    const r = window.__lastReport; if (!r) return;
    if (!r.summary) { window.Mascot.say(T("Bu raporda okunacak bir özet yok.", "This report has no summary to read.")); return; }
    window.Mascot.say(r.summary, { speak: true, audioUrl: r.audioUrl });
  });
  $("#share").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); $("#share").textContent = L.t("rep.copied"); }
    catch (_) { $("#share").textContent = location.href; }
    setTimeout(() => ($("#share").textContent = L.t("rep.share")), 2000);
  });

  window.SolExpert = { analyze };

  // Dil değişince: partnerler, sayaçlar ve açık rapor yeni dilde yeniden çizilir
  L.onChange(async () => {
    renderPartners();
    counters.forEach((c) => { cio.unobserve(c); cio.observe(c); });
    const r = window.__lastReport;
    // Kartlar ve paneller iki dilde gelir: hemen yeni dilde çiz. AI özeti tek dilde gelir:
    // yeni dilde iste (backend analizi önbellekten verir, sadece özeti yazar) ve gelince güncelle.
    if (r && lastRaw && !busy && !$("#report").classList.contains("hidden")) {
      const { address } = lastRaw, lang = L.lang;
      render(toView(lastRaw.data, address));
      try {
        const v = await fetchReport(address);
        if (L.lang === lang && lastRaw && lastRaw.address === address && !busy) render(v);
      } catch (_) {}
    }
  });

  // Paylaşılan link: ?address=... ile açılırsa doğrudan analiz et
  const shared = new URLSearchParams(location.search).get("address");
  if (shared) { $("#address").value = shared; setTimeout(() => analyze(shared), 400); }
})();
