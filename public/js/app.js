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

  // ---------- Veri katmanı ----------
  async function fetchReport(address) {
    if (cfg.USE_MOCK) {
      const file = address === "DEMO_TEMIZ_TOKEN" ? "safe" : "risky";
      const res = await fetch(`mocks/${file}${L.lang === "en" ? "-en" : ""}.json`);
      const data = await res.json();
      return { ...data, address };
    }
    const res = await fetch(cfg.API_BASE + cfg.ANALYZE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, lang: L.lang }), // backend raporu bu dilde yazsın
    });
    if (!res.ok) throw new Error((await res.text()) || T("Analiz başarısız", "Analysis failed"));
    return res.json();
  }

  // ---------- Analiz adımları ----------
  async function runSteps(promise) {
    const steps = [...document.querySelectorAll(".step")];
    steps.forEach((s) => s.classList.remove("active", "done"));
    for (const s of steps) {
      s.classList.add("active");
      await sleep(650 + Math.random() * 450);
      s.classList.remove("active"); s.classList.add("done");
    }
    return promise; // backend daha uzun sürerse burada bekler
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

    const STATUS = { danger: T("Riskli", "Risky"), warn: T("Dikkat", "Caution"), ok: T("Temiz", "Clear") };
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
      window.Mascot.say(T("Bir şeyler ters gitti: ", "Something went wrong: ") + e.message);
    } finally {
      busy = false;
    }
  }

  $("#scan-form").addEventListener("submit", (e) => { e.preventDefault(); analyze($("#address").value); });
  document.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => {
    const addr = b.dataset.demo === "safe" ? "DEMO_TEMIZ_TOKEN" : "DEMO_RISKLI_TOKEN";
    $("#address").value = addr; analyze(addr);
  }));
  $("#listen").addEventListener("click", () => {
    const r = window.__lastReport; if (!r) return;
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
    if (r && !busy && !$("#report").classList.contains("hidden")) {
      try { render(await fetchReport(r.address)); } catch (_) {}
    }
  });

  // Paylaşılan link: ?address=... ile açılırsa doğrudan analiz et
  const shared = new URLSearchParams(location.search).get("address");
  if (shared) { $("#address").value = shared; setTimeout(() => analyze(shared), 400); }
})();
