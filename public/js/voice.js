// Seslendirme katmanı.
// Sıra: 1) raporun audioUrl'i  2) backend /api/tts (ElevenLabs)  3) tarayıcı sesi (seçilebilir).
// Konuşurken onLevel(0..1) ile ağız açıklığını bildirir.
window.SolVoice = (() => {
  const cfg = window.SOLEXPERT_CONFIG;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("solexpert." + k); return v === null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("solexpert." + k, v); } catch (_) {} },
  };
  const settings = {
    voiceName: store.get("voice", ""),
    rate: parseFloat(store.get("rate", "1")),
    pitch: parseFloat(store.get("pitch", "1.15")), // baykuş için biraz ince ses
  };
  let current = null;

  // ---- Tarayıcı sesleri: en doğal olanı öne al ----
  function quality(v) {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural|online/.test(n)) s += 50; // Edge'in doğal sesleri (Emel, Ahmet)
    if (/google/.test(n)) s += 30;
    if (/premium|enhanced/.test(n)) s += 25; // macOS/iOS gelişmiş sesler (Yelda)
    if (!v.localService) s += 5;
    return s;
  }
  function turkishVoices() {
    if (!("speechSynthesis" in window)) return [];
    return speechSynthesis.getVoices()
      .filter((v) => v.lang && v.lang.toLowerCase().startsWith("tr"))
      .sort((a, b) => quality(b) - quality(a));
  }
  function allVoices() {
    if (!("speechSynthesis" in window)) return [];
    const tr = turkishVoices();
    const rest = speechSynthesis.getVoices().filter((v) => !tr.includes(v)).sort((a, b) => quality(b) - quality(a));
    return { tr, rest };
  }
  function pickVoice() {
    const list = speechSynthesis.getVoices();
    return list.find((v) => v.name === settings.voiceName) || turkishVoices()[0] || null;
  }
  function onVoicesReady(cb) {
    if (!("speechSynthesis" in window)) return cb();
    if (speechSynthesis.getVoices().length) cb();
    speechSynthesis.addEventListener("voiceschanged", cb);
  }

  function stop() { if (current) { try { current.stop(); } catch (_) {} current = null; } }

  async function playUrl(url, { onStart, onEnd, onLevel }) {
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    let raf, actx;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaElementSource(audio);
      const an = actx.createAnalyser();
      an.fftSize = 256;
      src.connect(an); an.connect(actx.destination);
      const data = new Uint8Array(an.frequencyBinCount);
      const loop = () => {
        an.getByteTimeDomainData(data);
        let sum = 0; for (const v of data) sum += Math.abs(v - 128);
        onLevel && onLevel(Math.min(1, sum / data.length / 18));
        raf = requestAnimationFrame(loop);
      };
      audio.addEventListener("play", loop, { once: true });
    } catch (_) {}
    const finish = () => { cancelAnimationFrame(raf); onLevel && onLevel(0); onEnd && onEnd(); if (actx) actx.close(); };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    current = { stop: () => { audio.pause(); finish(); } };
    onStart && onStart();
    await audio.play();
  }

  function browserSpeak(text, { onStart, onEnd, onLevel }) {
    if (!("speechSynthesis" in window)) { onEnd && onEnd(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "tr-TR";
    u.rate = settings.rate;
    u.pitch = settings.pitch;
    let t;
    const flap = () => { onLevel && onLevel(0.3 + Math.random() * 0.7); t = setTimeout(flap, 85 + Math.random() * 70); };
    u.onstart = () => { onStart && onStart(); flap(); };
    u.onboundary = () => onLevel && onLevel(1); // kelime başlarında gaga daha çok açılır
    const end = () => { clearTimeout(t); onLevel && onLevel(0); onEnd && onEnd(); };
    u.onend = end; u.onerror = end;
    current = { stop: () => { speechSynthesis.cancel(); end(); } };
    speechSynthesis.speak(u);
  }

  async function speak(text, handlers = {}, audioUrl = null) {
    stop();
    if (audioUrl) { try { return await playUrl(audioUrl, handlers); } catch (_) {} }
    if (!cfg.USE_MOCK) {
      try {
        const res = await fetch(cfg.API_BASE + cfg.TTS_PATH, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
        });
        if (res.ok) return await playUrl(URL.createObjectURL(await res.blob()), handlers);
      } catch (_) {}
    }
    browserSpeak(text, handlers);
  }

  return {
    speak, stop, settings, allVoices, onVoicesReady,
    setVoice(name) { settings.voiceName = name; store.set("voice", name); },
    setRate(r) { settings.rate = r; store.set("rate", r); },
    setPitch(p) { settings.pitch = p; store.set("pitch", p); },
    usingElevenLabs: () => !cfg.USE_MOCK,
  };
})();
