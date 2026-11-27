// Arka planda yavaşça süzülen, kendi ekseninde dönen coinler (yıldızların yerine).
// Performans: her coin türü bir kez küçük bir resme (sprite) çizilir; her karede sadece o resim
// ölçeklenerek kopyalanır. Eskiden her coin için her karede degrade + yazı çiziliyordu.
(() => {
  const canvas = document.getElementById("coin-bg");
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SYMBOLS = ["◎", "$", "◎", "₿", "◎", "¤"];
  const PALETTES = [
    ["#9945ff", "#14f195"], // Solana tonları
    ["#f7c948", "#b7791f"], // altın
    ["#c9ccd1", "#6b7280"], // gümüş
  ];
  const SPRITE_R = 24; // sprite yarıçapı (px); coinler bundan küçük çizilir
  let coins = [], w = 0, h = 0, dpr = 1, scrollY = 0, sprites = new Map(), raf = 0, running = true;

  function sprite(pi, sym) {
    const key = pi + sym;
    if (sprites.has(key)) return sprites.get(key);
    const R = SPRITE_R * dpr, c = document.createElement("canvas");
    c.width = c.height = Math.ceil(R * 2 + 2);
    const g = c.getContext("2d"), m = R + 1, pal = PALETTES[pi];
    const grad = g.createLinearGradient(m - R, m - R, m + R, m + R);
    grad.addColorStop(0, pal[0]); grad.addColorStop(1, pal[1]);
    g.fillStyle = grad; g.beginPath(); g.arc(m, m, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = dpr;
    g.beginPath(); g.arc(m, m, R * 0.78, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(0,0,0,.55)"; g.font = `${Math.round(R)}px sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(sym, m, m + dpr);
    sprites.set(key, c);
    return c;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sprites = new Map();
    const count = Math.round(Math.min(45, (w * h) / 30000));
    coins = Array.from({ length: count }, () => makeCoin(Math.random() * h));
  }

  function makeCoin(y) {
    const depth = Math.random();
    const pi = Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2;
    return {
      x: Math.random() * w, y, r: 3 + depth * 13, depth,
      vy: 0.08 + depth * 0.35, vx: (Math.random() - 0.5) * 0.15,
      spin: Math.random() * Math.PI * 2, vspin: 0.01 + Math.random() * 0.03,
      pi, sym: SYMBOLS[(Math.random() * SYMBOLS.length) | 0], alpha: 0.25 + depth * 0.55,
    };
  }

  function drawCoin(c) {
    const py = c.y - scrollY * c.depth * 0.25; // parallax
    const y = ((py % (h + 40)) + h + 40) % (h + 40) - 20;
    const sx = Math.max(0.12, Math.abs(Math.cos(c.spin))); // dönme efekti
    ctx.globalAlpha = c.alpha;
    if (c.r > 4) {
      const img = sprite(c.pi, c.sym), d = c.r * 2;
      ctx.drawImage(img, c.x - c.r * sx, y - c.r, d * sx, d);
    } else {
      ctx.fillStyle = PALETTES[c.pi][0];
      ctx.beginPath(); ctx.ellipse(c.x, y, Math.max(0.5, c.r * sx), c.r, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function frame() {
    raf = 0;
    ctx.clearRect(0, 0, w, h);
    for (const c of coins) {
      if (!reduce) {
        c.y += c.vy; c.x += c.vx; c.spin += c.vspin;
        if (c.x < -20) c.x = w + 20;
        if (c.x > w + 20) c.x = -20;
      }
      drawCoin(c);
    }
    ctx.globalAlpha = 1;
    if (!reduce && running) raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };

  window.addEventListener("resize", () => { resize(); start(); });
  window.addEventListener("scroll", () => { scrollY = window.scrollY; if (reduce) start(); }, { passive: true });
  // Sekme arka plandayken tamamen dur
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) start(); });
  resize();
  start();
})();
