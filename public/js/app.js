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
  const GROUP_ORDER = ["anahtarlar", "dagilim", "alim_satim", "proje"]; // API.md'deki grup sırası
  function toView(tr, address) {
    const score = Math.max(0, Math.min(100, Math.round(tr.score) || 0));
    const rank = (g) => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? GROUP_ORDER.length : i; };
    const checks = [...tr.checks]
      .sort((a, b) => rank(a.group) - rank(b.group))
      .map((c) => ({ id: c.id, label: c.title, status: STATUS[c.status] || "unknown", detail: c.detail }));
    // Olumlu sinyaller mevcut kart tasarımıyla yeşil kart olarak eklenir
    (tr.positiveSignals || []).filter(Boolean).forEach((s, i) =>
      checks.push({ id: "positive_" + i, label: T("Olumlu sinyal", "Positive signal"), status: "ok", detail: s }));
    return {
      address: (tr.token && tr.token.address) || address,
      riskScore: score,
      // level yoksa CLAUDE.md aralıkları: 0–30 düşük, 31–60 dikkat, 61–100 yüksek
      verdict: LEVEL[tr.level] || (score >= 61 ? "danger" : score >= 31 ? "warn" : "ok"),
      summary: typeof tr.summary === "string" ? tr.summary.trim() : "",
      checks,
      holders: [],   // backend henüz vermiyor → panelde "veri yok"
      siteFlags: [], // backend henüz vermiyor → panelde "veri yok"
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

    // Backend cüzdan dağılımı / site alıntısı vermiyorsa panel yerinde kalır, "veri yok" yazar.
    const NO_DATA = T("— Veri yok", "— No data");
    $("#holders").innerHTML = (r.holders || []).map((h) => `
      <div class="hbar ${h.pct >= 25 && !/diğer|other|everyone/i.test(h.label) ? "big" : ""}">
        <span>${esc(h.label)}</span><div class="track"><div class="fill" data-w="${+h.pct}"></div></div><b>${L.lang === "en" ? +h.pct + "%" : "%" + +h.pct}</b>
      </div>`).join("") || esc(NO_DATA);
    setTimeout(() => document.querySelectorAll(".hbar .fill").forEach((f) => (f.style.width = f.dataset.w + "%")), 100);

    $("#flags").innerHTML = (r.siteFlags || []).map((f) => `<li class="${f.level === "ok" ? "clean" : ""}">${esc(f.text)}</li>`).join("")
      || esc(NO_DATA);

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
    // Backend raporu tek dilde döndürür; analizi tekrar çalıştırmadan (5–25 sn, API kotası) yeniden çiz.
    if (r && lastRaw && !busy && !$("#report").classList.contains("hidden")) {
      render(toView(lastRaw.data, lastRaw.address));
    }
  });

  // Paylaşılan link: ?address=... ile açılırsa doğrudan analiz et
  const shared = new URLSearchParams(location.search).get("address");
  if (shared) { $("#address").value = shared; setTimeout(() => analyze(shared), 400); }
})();
