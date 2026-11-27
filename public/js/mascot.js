// Ekspi: sayfayla birlikte aşağı inen, konuşan ekspertiz baykuşu.
// Tıklayınca panel açılır: adres yapıştır + tara, ses seç, bilgi dinle.
// Boşta kalınca makalelerdeki önemli rakamları balonla anlatır.
window.Mascot = (() => {
  const el = document.getElementById("mascot");
  const owl = document.getElementById("owl");
  const bubble = document.getElementById("bubble");
  const bText = document.getElementById("bubble-text");
  const bSrc = document.getElementById("bubble-src");
  const beak = document.getElementById("beak-low");
  const pupils = el.querySelector(".pupils");
  const eyes = el.querySelector(".eyes");
  const panel = document.getElementById("owl-panel");
  const V = window.SolVoice;
  const FACTS = window.SOLEXPERT_FACTS || [];
  const $ = (id) => document.getElementById(id);
  const L = window.I18N;
  const T = (tr, en) => (L.lang === "en" ? en : tr);

  // ---- Kaydırmayı takip eden yay hareketi ----
  // Hareket bitince döngü durur; kaydırma, pencere boyutu ya da panel değişince yeniden başlar.
  let y = window.innerHeight * 0.55, vy = 0, lastScroll = window.scrollY, lag = 0, physRaf = 0, lastTilt = "";
  function physics() {
    physRaf = 0;
    const s = window.scrollY;
    lag += (lastScroll - s) * 0.6;
    lastScroll = s;
    lag *= 0.9;
    lag = Math.max(-180, Math.min(180, lag));
    const base = panel.classList.contains("hidden") ? 0.55 : 0.62;
    const target = window.innerHeight * base + lag;
    vy += (target - y) * 0.08;
    vy *= 0.78;
    y += vy;
    el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    const tilt = `${Math.max(-12, Math.min(12, vy * 0.6)).toFixed(1)}deg`;
    if (tilt !== lastTilt) { owl.style.rotate = tilt; lastTilt = tilt; }
    el.classList.toggle("flying", Math.abs(vy) > 2.5);
    const settled = Math.abs(vy) < 0.03 && Math.abs(target - y) < 0.3 && Math.abs(lag) < 0.3;
    if (!settled) physRaf = requestAnimationFrame(physics);
  }
  const wake = () => { if (!physRaf) physRaf = requestAnimationFrame(physics); };
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", wake);
  new MutationObserver(wake).observe(panel, { attributes: true, attributeFilter: ["class"] });
  wake();

  // ---- Gözler fareyi izler, göz kırpar ----
  window.addEventListener("mousemove", (e) => {
    const r = owl.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 3);
    const d = Math.hypot(dx, dy) || 1;
    pupils.style.transform = `translate(${(dx / d) * 3}px, ${(dy / d) * 3}px)`;
  });
  (function blink() {
    eyes.classList.add("blink");
    setTimeout(() => eyes.classList.remove("blink"), 140);
    setTimeout(blink, 2500 + Math.random() * 3500);
  })();
  const setMouth = (level) => { beak.style.transform = `translateY(${(level * 6).toFixed(1)}px)`; };

  // ---- Balon: yazı daktilo gibi akar, altında kaynak görünür ----
  // Balon okunacak kadar ekranda kalır: en az 8 sn, uzun metinde kelime başına daha fazla.
  // Fare balonun üstündeyken kapanmaz; tıklayınca kapanır.
  let hideT, typeT, lastHidden = Date.now(), minUntil = 0, hovering = false;
  const readTime = (text) => Math.max(8000, 4000 + text.length * 70);
  function show(text, { autoHide = true, source = "", kind = "" } = {}) {
    if (!panel.classList.contains("hidden")) return;
    clearTimeout(hideT); clearTimeout(typeT);
    bubble.className = "bubble show" + (kind ? " " + kind : "");
    bSrc.textContent = source ? L.t("bubble.src") + source : "";
    bText.textContent = "";
    let i = 0;
    const type = () => {
      i = Math.min(text.length, i + 2);
      bText.textContent = text.slice(0, i);
      if (i < text.length) typeT = setTimeout(type, 16);
    };
    type();
    minUntil = Date.now() + readTime(text);
    if (autoHide) hideT = setTimeout(hide, readTime(text));
  }
  function hide() {
    if (hovering) return;
    bubble.classList.remove("show");
    lastHidden = Date.now();
  }
  const hideLater = (min = 3000) => { clearTimeout(hideT); hideT = setTimeout(hide, Math.max(min, minUntil - Date.now())); };
  bubble.addEventListener("mouseenter", () => { hovering = true; clearTimeout(hideT); });
  bubble.addEventListener("mouseleave", () => { hovering = false; if (!el.classList.contains("talking")) hideLater(2500); });
  bubble.addEventListener("click", () => { hovering = false; clearTimeout(hideT); hide(); });

  const talk = (text, audioUrl = null) => V.speak(text, {
    onStart: () => el.classList.add("talking"),
    onEnd: () => { el.classList.remove("talking"); setMouth(0); if (bubble.classList.contains("show")) hideLater(); },
    onLevel: setMouth,
  }, audioUrl);

  function say(text, opts = {}) {
    show(text, { autoHide: !opts.speak, source: opts.source, kind: opts.kind });
    if (opts.speak) talk(text, opts.audioUrl || null);
  }

  // ---- Bilgi modu ----
  let factIdx = 0;
  function nextFact(speak = false) {
    if (!FACTS.length) return;
    const f = FACTS[factIdx % FACTS.length];
    factIdx++;
    say(L.lang === "en" ? f.textEn || f.text : f.text, { speak, source: f.source, kind: "fact" });
  }
  // Boşta kalınca (balon kapalı, panel kapalı, 18 sn sessizlik) kendiliğinden bir bilgi gösterir
  setInterval(() => {
    const idle = !bubble.classList.contains("show") && panel.classList.contains("hidden") && !el.classList.contains("talking");
    if (idle && Date.now() - lastHidden > 18000) nextFact(false);
  }, 4000);

  // ---- Bölüme göre replik ----
  const LINES = {
    tr: {
      top: "Merhaba, ben Ekspi. Bana tıklayın, token adresini yapıştırın; ekspertizini hemen yapayım.",
      nasil: "Zincire, cüzdanlara ve projenin sitesine bakarım. Sonucu size sade bir dille anlatırım.",
      partners: "Arka planda bu teknolojiler çalışıyor.",
    },
    en: {
      top: "Hi, I'm Ekspi. Click me and paste a token address; I'll inspect it right away.",
      nasil: "I check the chain, the wallets and the project's website, then explain the result in plain language.",
      partners: "These are the technologies working behind the scenes.",
    },
  };
  const line = (k) => (LINES[L.lang] || LINES.tr)[k];
  let lastSection = null;
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting || en.target.id === lastSection) return;
      lastSection = en.target.id;
      if (en.target.id === "neden") nextFact(false); // istatistik bölümünde bilgi verir
      else if (line(en.target.id)) show(line(en.target.id));
    });
  }, { threshold: 0.45 });
  ["top", "nasil", "neden", "partners"].forEach((id) => { const s = $(id); if (s) sectionIO.observe(s); });

  // ---- Panel ----
  function openPanel() {
    hide();
    panel.classList.remove("hidden");
    $("owl-address").focus();
    talk(T("Adresi yapıştırın, hemen bakayım!", "Paste the address and I'll take a look!"));
  }
  function closePanel() { panel.classList.add("hidden"); }
  const togglePanel = () => (panel.classList.contains("hidden") ? openPanel() : closePanel());

  // Tıklama: konuşuyorsa susar (ve panel kapanır); konuşmuyorsa panel açılır/kapanır.
  const stopBtn = $("owl-stop");
  function silence() {
    V.stop();
    el.classList.remove("talking"); setMouth(0);
    stopBtn.classList.add("hidden");
    if (bubble.classList.contains("show")) hideLater(2500);
  }
  function onOwl() {
    if (el.classList.contains("talking")) { silence(); closePanel(); return; }
    togglePanel();
  }
  owl.addEventListener("click", onOwl);
  owl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOwl(); } });
  stopBtn.addEventListener("click", (e) => { e.stopPropagation(); silence(); });
  // Konuşurken küçük "durdur" düğmesi görünür
  new MutationObserver(() => stopBtn.classList.toggle("hidden", !el.classList.contains("talking")))
    .observe(el, { attributes: true, attributeFilter: ["class"] });
  $("owl-close").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closePanel(); if (el.classList.contains("talking")) silence(); } });

  $("owl-paste").addEventListener("click", async () => {
    try { $("owl-address").value = (await navigator.clipboard.readText()).trim(); }
    catch (_) { $("owl-address").focus(); $("owl-hint").textContent = T("Pano izni yok: Cmd+V ile yapıştırın.", "No clipboard access: paste with Cmd+V."); }
  });
  const scan = () => {
    const a = $("owl-address").value.trim();
    if (!a) { $("owl-address").focus(); return; }
    closePanel();
    window.SolExpert.analyze(a);
  };
  $("owl-scan").addEventListener("click", scan);
  $("owl-address").addEventListener("keydown", (e) => { if (e.key === "Enter") scan(); });
  $("owl-fact").addEventListener("click", () => { closePanel(); nextFact(true); });

  // ---- Ses seçimi: önce ElevenLabs, sonra tarayıcı (yedek) ----
  const sel = $("owl-voice");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function fillVoices() {
    const ev = V.elevenVoices(), bv = V.browserVoices(), st = V.status();
    const off = st === false; // ElevenLabs bağlı değil
    const offTag = off ? T(" (bağlı değil)", " (not connected)") : "";
    sel.innerHTML =
      `<optgroup label="ElevenLabs${offTag}">${ev.map((v) => `<option value="eleven:${esc(v.id)}"${off ? " disabled" : ""}>${esc(v.name)}${v.desc ? " · " + esc(T(v.desc, v.descEn || v.desc)) : ""}</option>`).join("")}</optgroup>` +
      (bv.length ? `<optgroup label="${T("Tarayıcı sesi (yedek)", "Browser voice (fallback)")}">${bv.map((v) => `<option value="browser:${esc(v.name)}">${esc(v.name)}</option>`).join("")}</optgroup>` : "");

    // ElevenLabs yoksa seçili ElevenLabs sesi sessizce aynı tarayıcı sesine düşmesin: görünür şekilde tarayıcı sesine geç
    let want = V.settings.voice;
    if (off && want.startsWith("eleven:") && bv.length) want = "browser:" + bv[0].name;
    const opt = [...sel.options].find((o) => o.value === want && !o.disabled) || [...sel.options].find((o) => !o.disabled);
    if (opt) { sel.value = opt.value; V.settings.voice = opt.value; }

    const isEleven = sel.value.startsWith("eleven:");
    $("owl-sliders").classList.toggle("hidden", isEleven);
    $("owl-hint").textContent = off
      ? T("ElevenLabs bağlı değil (/api/tts bulunamadı), bu yüzden şu an sadece tarayıcı sesleri çalışıyor. Bağlamak için README'deki adımları izleyin.",
          "ElevenLabs is not connected (/api/tts not found), so only browser voices work right now. Follow the README steps to connect it.")
      : st === true
        ? (isEleven ? T("ElevenLabs bağlı. Ses değiştirince kısa bir örnek çalar.", "ElevenLabs is connected. Changing the voice plays a short sample.")
                    : T("Tarayıcı sesi yedektir; en doğal sonuç için ElevenLabs seslerinden birini seçin.", "The browser voice is a fallback; pick an ElevenLabs voice for the most natural result."))
        : T("ElevenLabs bağlantısı kontrol ediliyor…", "Checking the ElevenLabs connection…");
  }
  V.onChange(fillVoices);
  fillVoices();
  // Ses değişince eskisi anında susar ve yeni ses kısa bir örnek söyler
  sel.addEventListener("change", () => {
    V.setVoice(sel.value);
    talk(T("Merhaba, ben Ekspi.", "Hi, I'm Ekspi."));
  });
  $("owl-rate").value = V.settings.rate;
  $("owl-pitch").value = V.settings.pitch;
  $("owl-rate").addEventListener("input", (e) => V.setRate(parseFloat(e.target.value)));
  $("owl-pitch").addEventListener("input", (e) => V.setPitch(parseFloat(e.target.value)));
  $("owl-test").addEventListener("click", () => talk(T(
    "Merhaba, ben Ekspi. Bu tokendan uzak durun; arzın yüzde yetmiş dördü yalnızca on cüzdanda.",
    "Hi, I'm Ekspi. Stay away from this token; seventy-four percent of the supply sits in just ten wallets.")));

  // Dil değişince ses listesi ve karşılama yeni dilde
  L.onChange(() => { V.stop(); fillVoices(); show(line("top")); });

  setTimeout(() => show(line("top")), 900);

  return {
    say,
    setReport(text, audioUrl) { el.dataset.reportText = text; el.dataset.audioUrl = audioUrl || ""; },
  };
})();
