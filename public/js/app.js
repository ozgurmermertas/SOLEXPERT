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
  const pl = $("#partner-list");
  cfg.PARTNERS.forEach((p) => {
    const a = document.createElement("a");
    a.className = "partner"; a.href = p.url; a.target = "_blank"; a.rel = "noopener";
    a.innerHTML = `<img class="logo-img" src="${esc(p.logo)}" alt="${esc(p.name)}" /><small>${esc(p.role)}</small>`;
    pl.appendChild(a);
    bindLogo(a.querySelector("img"), p.name.toUpperCase());
  });

  // ---------- Sayaçlar ----------
  const counters = document.querySelectorAll(".stat-num");
  const fmt = (el, v) => {
    const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    let n;
    if (el.dataset.format === "dec") n = v.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    else n = Math.round(v).toLocaleString("tr-TR");
    el.textContent = pre + n + suf;
  };
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, end = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1600;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        fmt(el, end * e);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      cio.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach((c) => cio.observe(c));

  // ---------- Veri katmanı ----------
  async function fetchReport(address) {
    if (cfg.USE_MOCK) {
      const file = address === "DEMO_TEMIZ_TOKEN" ? "safe" : "risky";
      const res = await fetch(`mocks/${file}.json`);
      const data = await res.json();
      return { ...data, address };
    }
    const res = await fetch(cfg.API_BASE + cfg.ANALYZE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) throw new Error((await res.text()) || "Analiz başarısız");
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

  function render(r) {
    const score = Math.max(0, Math.min(100, r.riskScore | 0));
    const verdict = r.verdict || (score >= 66 ? "danger" : score >= 33 ? "warn" : "ok");
    const label = r.verdictLabel || { danger: "UZAK DUR", warn: "DİKKATLİ OL", ok: "TEMİZ GÖRÜNÜYOR" }[verdict];

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
        ${c.raw ? `<details><summary>Teknik detay</summary><code>${esc(c.raw)}</code></details>` : ""}
      </div>`).join("");

    $("#holders").innerHTML = (r.holders || []).map((h) => `
      <div class="hbar ${h.pct >= 25 && !/diğer/i.test(h.label) ? "big" : ""}">
        <span>${esc(h.label)}</span><div class="track"><div class="fill" data-w="${+h.pct}"></div></div><b>%${+h.pct}</b>
      </div>`).join("");
    setTimeout(() => document.querySelectorAll(".hbar .fill").forEach((f) => (f.style.width = f.dataset.w + "%")), 100);

    $("#flags").innerHTML = (r.siteFlags || []).map((f) => `<li class="${f.level === "ok" ? "clean" : ""}">${esc(f.text)}</li>`).join("")
      || `<li class="clean">Web sitesi bulunamadı veya incelenemedi.</li>`;

    $("#report").classList.remove("hidden");
    window.Mascot.setReport(r.summary, r.audioUrl);
    window.Mascot.say(label === "UZAK DUR" ? "Bu tokendan uzak dur! Raporu dinle butonuna bas, anlatayım." : "Rapor hazır. Raporu dinle butonuna bas, anlatayım.");
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
    window.Mascot.say("Usta işbaşında! Zinciri okuyorum…");
    const url = new URL(location.href); url.searchParams.set("address", address); history.replaceState(null, "", url);
    try {
      const report = await runSteps(fetchReport(address));
      render(report);
    } catch (e) {
      window.Mascot.say("Bir şeyler ters gitti: " + e.message);
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
    try { await navigator.clipboard.writeText(location.href); $("#share").textContent = "Kopyalandı ✓"; }
    catch (_) { $("#share").textContent = location.href; }
    setTimeout(() => ($("#share").textContent = "Linki kopyala"), 2000);
  });

  window.SolExpert = { analyze };

  // Paylaşılan link: ?address=... ile açılırsa doğrudan analiz et
  const shared = new URLSearchParams(location.search).get("address");
  if (shared) { $("#address").value = shared; setTimeout(() => analyze(shared), 400); }
})();
