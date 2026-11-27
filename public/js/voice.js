// Seslendirme katmanı.
// Öncelik: 1) raporun audioUrl'i  2) ElevenLabs (/api/tts, seçilen voiceId ile)  3) tarayıcı sesi (yedek).
// Ses seçimi "eleven:<voiceId>" ya da "browser:<sesAdı>" olarak saklanır.
//
// Önemli davranışlar:
// - Yeni konuşma ya da ses değişimi eskisini HEMEN durdurur (çalan ses + bekleyen ElevenLabs isteği iptal).
// - Geç gelen eski bir ElevenLabs cevabı asla çalınmaz (istek numarası kontrolü).
// - Aynı ses + aynı metin tekrar istenmez, önbellekten çalınır (hızlı ve kredi harcamaz).
// - ElevenLabs bağlı değilse bu açıkça bildirilir; seçilen ElevenLabs sesi sessizce başka bir sese dönmez.
window.SolVoice = (() => {
  const cfg = window.SOLEXPERT_CONFIG;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("solexpert." + k); return v === null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("solexpert." + k, v); } catch (_) {} },
  };
  const settings = {
    voice: store.get("voice2", "eleven:" + (cfg.ELEVEN_VOICES[0] && cfg.ELEVEN_VOICES[0].id)),
    rate: parseFloat(store.get("rate", "1")),
    pitch: parseFloat(store.get("pitch", "1.15")),
  };
  let elevenVoices = cfg.ELEVEN_VOICES.slice();
  let elevenOk = null; // null: kontrol ediliyor, true: bağlı, false: /api/tts yok
  const listeners = [];
  const changed = () => listeners.forEach((f) => f());
  const lang = () => (window.I18N && window.I18N.lang === "en" ? "en" : "tr");

  // ---- Açılışta ElevenLabs bağlı mı, kontrol et ----
  (async () => {
    try {
      const r = await fetch(cfg.API_BASE + cfg.VOICES_PATH);
      if (r.ok) {
        const list = await r.json();
        if (Array.isArray(list) && list.length) elevenVoices = list;
        elevenOk = true;
      } else {
        // /api/voices yoksa /api/tts var mı? Next.js'te route varsa HEAD 405 döner, yoksa 404.
        const h = await fetch(cfg.API_BASE + cfg.TTS_PATH, { method: "HEAD" });
        elevenOk = h.status !== 404;
      }
    } catch (_) { elevenOk = false; }
    changed();
  })();

  // ---- Tarayıcı sesleri (yedek) ----
  function quality(v) {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural|online/.test(n)) s += 50;
    if (/google/.test(n)) s += 30;
    if (/premium|enhanced/.test(n)) s += 25;
    return s;
  }
  function browserVoices() {
    if (!("speechSynthesis" in window)) return [];
    return speechSynthesis.getVoices()
      .filter((v) => v.lang && v.lang.toLowerCase().startsWith(lang()))
      .sort((a, b) => quality(b) - quality(a));
  }
  if ("speechSynthesis" in window) speechSynthesis.addEventListener("voiceschanged", changed);

  // ---- Durdurma: her şeyi kesin olarak keser ----
  let reqId = 0;        // her konuşmada artar; eski işler kendini iptal eder
  let current = null;   // { stop() }
  let aborter = null;   // bekleyen ElevenLabs isteği
  function stop() {
    reqId++;
    if (aborter) { aborter.abort(); aborter = null; }
    if (current) { const c = current; current = null; try { c.stop(); } catch (_) {} }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  // ---- mp3 çalma (ağız hareketi ses seviyesinden) ----
  let actx = null;
  function playUrl(url, { onStart, onEnd, onLevel }, id) {
    return new Promise((resolve) => {
      if (id !== reqId) return resolve();
      const audio = new Audio(url);
      let raf, done = false;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === "suspended") actx.resume();
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
      const finish = () => {
        if (done) return; done = true;
        cancelAnimationFrame(raf); audio.pause();
        onLevel && onLevel(0); onEnd && onEnd(); resolve();
      };
      audio.addEventListener("ended", finish);
      audio.addEventListener("error", finish);
      current = { stop: finish };
      onStart && onStart();
      audio.play().catch(finish);
    });
  }

  // ---- ElevenLabs (önbellekli) ----
  const cache = new Map(); // "voiceId|metin" -> blob URL
  async function elevenSpeak(text, handlers, id) {
    const voiceId = settings.voice.slice(7);
    const key = voiceId + "|" + text;
    let url = cache.get(key);
    if (!url) {
      aborter = new AbortController();
      const res = await fetch(cfg.API_BASE + cfg.TTS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
        signal: aborter.signal,
      });
      if (!res.ok) throw new Error("tts " + res.status);
      const blob = await res.blob();
      if (id !== reqId) return; // bu sırada başka konuşma başladıysa eskisini çalma
      url = URL.createObjectURL(blob);
      cache.set(key, url);
      if (cache.size > 40) { const [k, u] = cache.entries().next().value; URL.revokeObjectURL(u); cache.delete(k); }
    }
    if (elevenOk !== true) { elevenOk = true; changed(); }
    return playUrl(url, handlers, id);
  }

  // ---- Tarayıcı sesi: cümle cümle okur (Chrome uzun metinde yarıda kesiyor) ----
  function browserSpeak(text, { onStart, onEnd, onLevel }, id) {
    if (!("speechSynthesis" in window)) { onEnd && onEnd(); return; }
    const name = settings.voice.startsWith("browser:") ? settings.voice.slice(8) : "";
    const v = speechSynthesis.getVoices().find((x) => x.name === name);
    const voice = v && v.lang.toLowerCase().startsWith(lang()) ? v : browserVoices()[0];
    const parts = text.match(/[^.!?;]+[.!?;]*/g) || [text];
    let t, i = 0, started = false, ended = false;
    const flap = () => { onLevel && onLevel(0.3 + Math.random() * 0.7); t = setTimeout(flap, 85 + Math.random() * 70); };
    const end = () => { if (ended) return; ended = true; clearTimeout(t); onLevel && onLevel(0); onEnd && onEnd(); };
    current = { stop: () => { speechSynthesis.cancel(); end(); } };
    const next = () => {
      if (id !== reqId) return end();
      if (i >= parts.length) return end();
      const u = new SpeechSynthesisUtterance(parts[i++].trim());
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = lang() === "en" ? "en-US" : "tr-TR";
      u.rate = settings.rate; u.pitch = settings.pitch;
      u.onstart = () => { if (!started) { started = true; onStart && onStart(); flap(); } };
      u.onend = next;
      u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? end() : next());
      speechSynthesis.speak(u);
    };
    // cancel() hemen ardından speak() Chrome'da bazen yutuluyor; kısa bekleme
    setTimeout(next, 60);
  }

  async function speak(text, handlers = {}, audioUrl = null) {
    stop();
    const id = reqId;
    if (audioUrl) { try { return await playUrl(audioUrl, handlers, id); } catch (_) {} }
    if (settings.voice.startsWith("eleven:") && elevenOk !== false) {
      try { return await elevenSpeak(text, handlers, id); }
      catch (e) {
        if (e && e.name === "AbortError") return; // kullanıcı durdurdu / yeni ses seçti
        elevenOk = false; changed();
      }
    }
    if (id !== reqId) return;
    browserSpeak(text, handlers, id);
  }

  return {
    speak, stop, settings,
    elevenVoices: () => elevenVoices,
    browserVoices,
    status: () => elevenOk,
    onChange: (f) => listeners.push(f),
    setVoice(v) {
      stop(); // eski ses anında kesilir
      settings.voice = v; store.set("voice2", v);
      changed();
    },
    setRate(r) { settings.rate = r; store.set("rate", r); },
    setPitch(p) { settings.pitch = p; store.set("pitch", p); },
  };
})();
