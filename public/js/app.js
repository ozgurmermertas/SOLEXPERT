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

  function toCard(card, byId) {
    const [primary, ...rest] = card.checks.map((id) => byId[id]).filter(Boolean);
    if (!primary) return null;
    // Ana kontrol + sorunlu yan kontroller; en ciddi olan önce (bundle tehlikeliyse metin onunla başlar)
    const shown = [primary, ...rest.filter((c) => SEVERITY[c.status] >= 2)]
      .map((c, i) => ({ c, i }))
      .sort((a, b) => SEVERITY[b.c.status] - SEVERITY[a.c.status] || a.i - b.i)
      .map((x) => x.c);
    const worst = shown[0];
    const text = (c) => (L.lang === "en" && c.detailEn) || c.detail;
    return {
      id: card.id,
      label: T(card.tr, card.en),
      status: STATUS[worst.status] || "unknown",
      detail: shown.map(text).join(" "),
      raw: shown.map((c) => c.technical).filter(Boolean).join(" · "),
    };
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

  function toView(tr, address) {
    const score = Math.max(0, Math.min(100, Math.round(tr.score) || 0));
    const byId = Object.fromEntries(tr.checks.map((c) => [c.id, c]));
    return {
      address: (tr.token && tr.token.address) || address,
      riskScore: score,
      // level yoksa CLAUDE.md aralıkları: 0–30 düşük, 31–60 dikkat, 61–100 yüksek
      verdict: LEVEL[tr.level] || (score >= 61 ? "danger" : score >= 31 ? "warn" : "ok"),
      summary: typeof tr.summary === "string" ? tr.summary.trim() : "",
      checks: CARDS.map((card) => toCard(card, byId)).filter(Boolean),
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

  function render(r) {
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

    $("#checks").innerHTML = (r.checks || []).map((c) => `
      <div class="check ${esc(c.status)}">
        <h4><span>${ICON[c.status] || "•"}</span>${esc(c.label)}</h4>
        <p>${esc(c.detail)}</p>
        ${c.raw ? `<details><summary>${esc(L.t("rep.tech"))}</summary><code>${esc(c.raw)}</code></details>` : ""}
      </div>`).join("");

    // Cüzdan dağılımı alınamadıysa panel yerinde kalır, "veri yok" yazar.
    const NO_DATA = T("— Veri yok", "— No data");
    $("#holders").innerHTML = (r.holders || []).map((h) => `
      <div class="hbar ${h.pct >= 25 && !/diğer|other|everyone|havuz|pool/i.test(h.label) ? "big" : ""}">
        <span>${esc(h.label)}</span><div class="track"><div class="fill" data-w="${+h.pct}"></div></div><b>${L.lang === "en" ? +h.pct + "%" : "%" + +h.pct}</b>
      </div>`).join("") || esc(NO_DATA);
    setTimeout(() => document.querySelectorAll(".hbar .fill").forEach((f) => (f.style.width = f.dataset.w + "%")), 100);

    // Site incelenmediyse (site yok / AI kapalı) Rojin'in "site bulunamadı" satırı gösterilir.
    $("#flags").innerHTML = (r.siteFlags || []).map((f) => `<li class="${f.level === "ok" ? "clean" : ""}">${esc(f.text)}</li>`).join("")
      || `<li class="clean">${esc(L.t("rep.noSite"))}</li>`;

    $("#report").classList.remove("hidden");
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
