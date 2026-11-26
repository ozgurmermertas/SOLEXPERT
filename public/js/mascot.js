// Ekspi: sayfayla birlikte aşağı inen, konuşan ekspertiz baykuşu.
// Tıklayınca panel açılır: adres yapıştır + taranır, ses seçilir.
window.Mascot = (() => {
  const el = document.getElementById("mascot");
  const owl = document.getElementById("owl");
  const bubble = document.getElementById("bubble");
  const beak = document.getElementById("beak-low");
  const pupils = el.querySelector(".pupils");
  const eyes = el.querySelector(".eyes");
  const panel = document.getElementById("owl-panel");
  const V = window.SolVoice;

  // ---- Kaydırmayı takip eden yay hareketi ----
  let y = window.innerHeight * 0.55, vy = 0, lastScroll = window.scrollY, lag = 0;
  function physics() {
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
    const tilt = Math.max(-12, Math.min(12, vy * 0.6));
    el.style.transform = `translateY(${y}px)`;
    owl.style.rotate = `${tilt}deg`;
    // hızlı hareket ederken kanat çırpar
    el.classList.toggle("flying", Math.abs(vy) > 2.5);
    requestAnimationFrame(physics);
  }
  requestAnimationFrame(physics);

  // ---- Gözler fareyi izler ----
  window.addEventListener("mousemove", (e) => {
    const r = owl.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 3);
    const d = Math.hypot(dx, dy) || 1;
    pupils.style.transform = `translate(${(dx / d) * 3}px, ${(dy / d) * 3}px)`;
  });

  // ---- Göz kırpma ----
  (function blink() {
    eyes.classList.add("blink");
    setTimeout(() => eyes.classList.remove("blink"), 140);
    setTimeout(blink, 2500 + Math.random() * 3500);
  })();

  // ---- Gaga ----
  const setMouth = (level) => { beak.style.transform = `translateY(${(level * 6).toFixed(1)}px)`; };

  // ---- Konuşma balonu ----
  let hideT;
  function show(text, ms = 5000) {
    if (!panel.classList.contains("hidden")) return; // panel açıkken balon yok
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(hideT);
    if (ms) hideT = setTimeout(() => bubble.classList.remove("show"), ms);
  }

  function say(text, opts = {}) {
    show(text, opts.speak ? 0 : 5000);
    if (!opts.speak) return;
    V.speak(text, {
      onStart: () => el.classList.add("talking"),
      onEnd: () => { el.classList.remove("talking"); setMouth(0); hideT = setTimeout(() => bubble.classList.remove("show"), 1500); },
      onLevel: setMouth,
    }, opts.audioUrl || null);
  }

  // ---- Bölüme göre replik ----
  const LINES = {
    top: "Selam! Ben Ekspi. Bana tıkla, adresi yapıştır, ekspertizini yapayım.",
    nasil: "Ben de araba ustası gibiyim: motora, kaportaya, evraklara bakarım.",
    neden: "Bu rakamlar gerçek: her 4 yeni tokenın 3'ü rug pull adayı çıktı!",
    partners: "Bu ekip sayesinde çalışıyorum!",
  };
  let lastSection = null;
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting && en.target.id !== lastSection && LINES[en.target.id]) {
        lastSection = en.target.id;
        show(LINES[en.target.id]);
      }
    });
  }, { threshold: 0.45 });
  Object.keys(LINES).forEach((id) => { const s = document.getElementById(id); if (s) sectionIO.observe(s); });

  // ---- Panel ----
  const $ = (id) => document.getElementById(id);
  function openPanel() {
    bubble.classList.remove("show");
    panel.classList.remove("hidden");
    $("owl-address").focus();
    V.speak("Adresi yapıştır, hemen bakayım!", { onLevel: setMouth, onStart: () => el.classList.add("talking"), onEnd: () => { el.classList.remove("talking"); setMouth(0); } });
  }
  function closePanel() { panel.classList.add("hidden"); }
  function togglePanel() { panel.classList.contains("hidden") ? openPanel() : closePanel(); }

  owl.addEventListener("click", togglePanel);
  owl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePanel(); } });
  $("owl-close").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  $("owl-paste").addEventListener("click", async () => {
    try { $("owl-address").value = (await navigator.clipboard.readText()).trim(); }
    catch (_) { $("owl-address").focus(); $("owl-hint").textContent = "Pano izni yok: Ctrl+V ile yapıştır."; }
  });
  const scan = () => {
    const a = $("owl-address").value.trim();
    if (!a) { $("owl-address").focus(); return; }
    closePanel();
    window.SolExpert.analyze(a);
  };
  $("owl-scan").addEventListener("click", scan);
  $("owl-address").addEventListener("keydown", (e) => { if (e.key === "Enter") scan(); });

  // ---- Ses seçimi ----
  const sel = $("owl-voice");
  function fillVoices() {
    const { tr = [], rest = [] } = V.allVoices() || {};
    const opt = (v) => `<option value="${v.name.replace(/"/g, "&quot;")}">${v.name.replace(/</g, "&lt;")}${/natural|neural|online|premium|enhanced|google/i.test(v.name) ? " ★" : ""}</option>`;
    sel.innerHTML =
      (tr.length ? `<optgroup label="Türkçe">${tr.map(opt).join("")}</optgroup>` : "") +
      (rest.length ? `<optgroup label="Diğer diller">${rest.map(opt).join("")}</optgroup>` : "");
    const chosen = V.settings.voiceName && [...sel.options].some((o) => o.value === V.settings.voiceName) ? V.settings.voiceName : (tr[0] && tr[0].name);
    if (chosen) { sel.value = chosen; V.setVoice(chosen); }
    $("owl-hint").textContent = V.usingElevenLabs()
      ? "ElevenLabs sesi aktif; bu ayarlar sadece yedek ses için."
      : tr.length
        ? "★ = daha doğal ses. En iyisi Edge'deki 'Emel/Ahmet (Natural)'. Asıl ses yarın ElevenLabs'tan gelecek."
        : "Bu tarayıcıda Türkçe ses yok. Edge veya Chrome dene; asıl ses yarın ElevenLabs'tan gelecek.";
  }
  V.onVoicesReady(fillVoices);
  sel.addEventListener("change", () => V.setVoice(sel.value));
  $("owl-rate").value = V.settings.rate;
  $("owl-pitch").value = V.settings.pitch;
  $("owl-rate").addEventListener("input", (e) => V.setRate(parseFloat(e.target.value)));
  $("owl-pitch").addEventListener("input", (e) => V.setPitch(parseFloat(e.target.value)));
  $("owl-test").addEventListener("click", () => V.speak("Merhaba, ben Ekspi. Bu tokendan uzak dur, çünkü arzın çoğu birkaç cüzdanda.", {
    onLevel: setMouth, onStart: () => el.classList.add("talking"), onEnd: () => { el.classList.remove("talking"); setMouth(0); },
  }));

  setTimeout(() => show(LINES.top), 900);

  return {
    say,
    setReport(text, audioUrl) { el.dataset.reportText = text; el.dataset.audioUrl = audioUrl || ""; },
  };
})();
